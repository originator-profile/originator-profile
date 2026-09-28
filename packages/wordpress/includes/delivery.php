<?php
/** CAの配信可否と外部配信 */

namespace Profile\Delivery;

require_once __DIR__ . '/exclusion.php';
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/debug.php';

use function Profile\Exclusion\is_excluded;
use function Profile\Debug\debug;
use const Profile\Config\PROFILE_DEFAULT_CA_EXTERNAL_DIR;

const BLOCKED_META   = '_profile_ca_delivery_blocked';
const PENDING_PREFIX = 'profile_ca_delivery_pending_';
const RETRY_HOOK     = 'profile_ca_delivery_retry';

/** 配信の初期化。設定の初回保存と更新の両方を処理する。 */
function init() {
	\add_action( 'add_option_profile_ca_excluded_urls', '\Profile\Delivery\rules_changed', 10, 0 );
	\add_action( 'update_option_profile_ca_excluded_urls', '\Profile\Delivery\rules_changed', 10, 0 );
	\add_action( 'init', '\Profile\Delivery\migrate' );
	\add_action( RETRY_HOOK, '\Profile\Delivery\retry_suspend' );
	\add_action( 'rest_api_init', '\Profile\Delivery\register_routes' );
	\add_action( 'admin_notices', '\Profile\Delivery\migration_notice' );
}

/**
 * 保存済みCAを保持して配信を停止する。
 *
 * @param int  $post_id 記事ID。
 * @param bool $renew 設定変更時は新しいトークンに更新する。
 * @return bool 停止状態を保存できた場合は true。
 */
function suspend( int $post_id, bool $renew = false ): bool {
	$pending_key = PENDING_PREFIX . $post_id;
	$pending     = \get_option( $pending_key );
	if ( ! $renew && \get_post_meta( $post_id, BLOCKED_META, true ) ) {
		return true;
	}
	$token = \wp_generate_uuid4();
	if ( $renew ) {
		\update_post_meta( $post_id, BLOCKED_META, $token );
	} else {
		\add_post_meta( $post_id, BLOCKED_META, $token, true );
	}
	\clean_post_cache( $post_id );
	$stored  = \get_post_meta( $post_id, BLOCKED_META, true );
	$success = $renew ? $token === $stored : (bool) $stored;
	if ( ! $success ) {
		\update_option( $pending_key, $token, false );
		schedule_retry( $post_id );
	} elseif ( $pending ) {
		// 保存中に発生した新しい失敗の記録は消さない。
		global $wpdb;
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery -- 値を比較して削除し、options APIと同じキャッシュを無効化する。
		$wpdb->query( $wpdb->prepare( "DELETE FROM {$wpdb->options} WHERE option_name = %s AND option_value = %s", $pending_key, $pending ) );
		\wp_cache_delete( $pending_key, 'options' );
	}
	return $success;
}

/**
 * 全記事の再走査をせず、失敗した記事だけを遅延して再試行する。
 *
 * @param int $post_id 記事ID。
 */
function schedule_retry( int $post_id ) {
	$args = array( $post_id );
	if ( ! \wp_next_scheduled( RETRY_HOOK, $args ) ) {
		\wp_schedule_single_event( time() + MINUTE_IN_SECONDS, RETRY_HOOK, $args );
	}
}

/**
 * 停止状態が未保存の記事だけを再試行する。
 *
 * @param int $post_id 記事ID。
 */
function retry_suspend( int $post_id ) {
	if ( ! \get_option( PENDING_PREFIX . $post_id ) ) {
		return;
	}
	// 発行処理と同じロックで、再発行完了直後のCAを再停止する競合を防ぐ。
	global $wpdb;
	$lock = hash( 'sha256', DB_NAME . ':' . $wpdb->prefix . ':ca:' . $post_id );
	// phpcs:ignore WordPress.DB.DirectDatabaseQuery -- 発行処理と共有する接続単位の排他ロック。
	$acquired = $wpdb->get_var( $wpdb->prepare( 'SELECT GET_LOCK(%s, 0)', $lock ) );
	if ( 1 !== (int) $acquired ) {
		schedule_retry( $post_id );
		return;
	}
	try {
		\wp_cache_delete( PENDING_PREFIX . $post_id, 'options' );
		// 正常な再発行後に残った古いイベントで配信を停止しない。
		if ( \get_option( PENDING_PREFIX . $post_id ) ) {
			suspend( $post_id, true );
		}
	} finally {
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery -- 取得した接続のロックを必ず解放する。
		$wpdb->get_var( $wpdb->prepare( 'SELECT RELEASE_LOCK(%s)', $lock ) );
	}
}

/**
 * 記事の代表URLを保存済みの除外設定で判定する。
 *
 * @param \WP_Post $post 記事。
 * @return bool 除外対象の場合は true。
 * @throws \InvalidArgumentException 設定またはURLを評価できない場合.
 */
function is_post_excluded( \WP_Post $post ): bool {
	$rules = \get_option( 'profile_ca_excluded_urls', array() );
	$url   = \get_permalink( $post );
	if ( ! is_array( $rules ) || ! is_string( $url ) || '' === $url ) {
		throw new \InvalidArgumentException( '公開URLまたは除外設定を取得できません。' );
	}
	return is_excluded( $url, $rules );
}

/**
 * 記事のCAを公開してよいか確認する。
 *
 * @param \WP_Post $post 記事。
 * @return bool 公開可能な場合は true。
 */
function can_deliver( \WP_Post $post ): bool {
	if ( ! \is_post_publicly_viewable( $post ) || '' !== $post->post_password ) {
		return false;
	}
	if ( \get_option( PENDING_PREFIX . $post->ID ) ) {
		// 一時的にイベント登録も失敗していた場合に備える。
		schedule_retry( $post->ID );
		return false;
	}
	try {
		if ( is_post_excluded( $post ) ) {
			suspend( $post->ID );
			return false;
		}
	} catch ( \InvalidArgumentException $error ) {
		suspend( $post->ID );
		debug( "Post ID {$post->ID}: CA delivery stopped: " . $error->getMessage() );
		return false;
	}
	return ! \get_post_meta( $post->ID, BLOCKED_META, true );
}

/**
 * 配信可能なページのCAだけを返す。
 *
 * @param int $post_id 記事ID。
 * @param int $page ページ番号。
 * @return array<string> CA一覧。配信不可なら空配列。
 */
function get_cas( int $post_id, int $page ): array {
	$post = \get_post( $post_id );
	if ( ! $post instanceof \WP_Post || $page < 1 || ! can_deliver( $post ) ) {
		return array();
	}
	$pages = \get_post_meta( $post_id, '_profile_post_cas', true );
	$cas   = is_array( $pages ) ? ( $pages[ $page - 1 ] ?? null ) : null;
	if ( ! is_array( $cas ) || empty( $cas ) ) {
		return array();
	}
	foreach ( $cas as $credential ) {
		if ( ! is_string( $credential ) || '' === $credential ) {
			return array();
		}
	}
	return $cas;
}

/**
 * 設定保存時に、既存CAがある除外対象を再発行待ちにする。
 *
 * @return bool 停止状態をすべて保存できた場合は true。
 */
function rules_changed(): bool {
	$page    = 1;
	$success = true;
	do {
		$query = new \WP_Query(
			array(
				'post_type'      => array_values( \get_post_types() ),
				'post_status'    => array_values( \get_post_stati() ),
				'posts_per_page' => 100,
				'paged'          => $page,
				'orderby'        => 'ID',
				'order'          => 'ASC',
				'no_found_rows'  => true,
				// phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_meta_key -- 設定保存・移行時だけ既存CAのある記事を分割取得する。
				'meta_key'       => '_profile_post_cas',
			)
		);
		foreach ( $query->posts as $post ) {
			try {
				$excluded = is_post_excluded( $post );
			} catch ( \InvalidArgumentException $error ) {
				$excluded = true;
			}
			if ( $excluded && ! suspend( $post->ID, true ) ) {
				$success = false;
			}
		}
		$count = count( $query->posts );
		++$page;
	} while ( 100 === $count );
	return $success;
}

/** 静的JSONを動的配信へ移行する。失敗時は完了にせず、次回再試行する。 */
function migrate() {
	if ( '1' === \get_option( 'profile_ca_delivery_version' ) ) {
		return;
	}
	$success = rules_changed();
	global $wp_filesystem;
	if ( ! $wp_filesystem ) {
		require_once ABSPATH . 'wp-admin/includes/file.php';
		$success = \WP_Filesystem() && $success;
	}
	$success = $success && (bool) $wp_filesystem;
	if ( $success && isset( $wp_filesystem->errors ) && $wp_filesystem->errors->has_errors() ) {
		$success = false;
	}
	// 親ディレクトリを一覧できた場合だけ、「旧ディレクトリが存在しない」と判断する。
	$root    = $success ? $wp_filesystem->abspath() : false;
	$entries = $root ? $wp_filesystem->dirlist( $root, false, false ) : false;
	if ( false === $entries ) {
		$success = false;
	} elseif ( isset( $entries[ PROFILE_DEFAULT_CA_EXTERNAL_DIR ] ) ) {
		$directory = \trailingslashit( $root ) . PROFILE_DEFAULT_CA_EXTERNAL_DIR . '/';
		$files     = $wp_filesystem->dirlist( $directory, true, false );
		if ( false === $files ) {
			$success = false;
		} else {
			foreach ( $files as $filename => $file ) {
				if ( 1 === preg_match( '/\A[0-9]+_cas\.json\z/', $filename ) && ! $wp_filesystem->delete( $directory . $filename, false, 'f' ) ) {
					$success = false;
				}
			}
		}
	}
	if ( $success ) {
		\update_option( 'profile_ca_delivery_version', '1', false );
		\delete_option( 'profile_ca_delivery_error' );
	} else {
		\update_option( 'profile_ca_delivery_error', true, false );
		debug( 'CA delivery migration could not remove legacy static JSON files.' );
	}
}

/** 旧JSONの停止に失敗したことを管理者へ知らせる。 */
function migration_notice() {
	if ( ! \current_user_can( 'manage_options' ) ) {
		return;
	}
	global $wpdb;
	// phpcs:ignore WordPress.DB.DirectDatabaseQuery -- 管理画面で未完了の停止処理の有無だけを確認する。
	$pending = $wpdb->get_var( $wpdb->prepare( "SELECT option_id FROM {$wpdb->options} WHERE option_name LIKE %s LIMIT 1", $wpdb->esc_like( PENDING_PREFIX ) . '%' ) );
	if ( \get_option( 'profile_ca_delivery_error' ) || $pending ) {
		echo '<div class="notice notice-error"><p>' . \esc_html( 'CAの配信停止処理が完了していません。データベースと cas ディレクトリの書き込み・削除権限を確認してください。旧JSONが残っている場合、直接アクセスによる配信が続く可能性があります。' ) . '</p></div>';
	}
}

/** 公開CAの取得エンドポイントを登録する。 */
function register_routes() {
	\register_rest_route(
		'ca-manager/v1',
		'/cas/(?P<post_id>[1-9][0-9]*)/(?P<page>[1-9][0-9]*)',
		array(
			'methods'             => \WP_REST_Server::READABLE,
			'callback'            => '\Profile\Delivery\rest_cas',
			'permission_callback' => '__return_true',
		)
	);
}

/**
 * 最新の配信状態を確認してCAを返す。
 *
 * @param \WP_REST_Request $request 取得リクエスト。
 * @return \WP_REST_Response 公開CAまたは404。
 */
function rest_cas( \WP_REST_Request $request ): \WP_REST_Response {
	$cas = get_cas( (int) $request['post_id'], (int) $request['page'] );
	return new \WP_REST_Response(
		empty( $cas ) ? null : $cas,
		empty( $cas ) ? 404 : 200,
		array(
			'Content-Type'  => 'application/cas+json; charset=utf-8',
			'Cache-Control' => 'no-store, no-cache, must-revalidate, max-age=0',
		)
	);
}

/**
 * ページ別の外部CA配信URL。
 *
 * @param int $post_id 記事ID。
 * @param int $page ページ番号。
 * @return string 配信URL。
 */
function external_url( int $post_id, int $page ): string {
	return \rest_url( "ca-manager/v1/cas/{$post_id}/{$page}" );
}
