<?php
/** CA 発行結果の競合を検出して保存する。 */

namespace Profile\Issue;

// ロック付きの最新読み取りと private meta の原子的な保存には直接 SQL が必要。
// phpcs:disable WordPress.DB.DirectDatabaseQuery

/**
 * CA メタの存在、行 ID、保存値を取得する。
 *
 * @param int  $post_id 投稿 ID.
 * @param bool $lock 範囲ロックを取得するか.
 * @return array|null DB エラーの場合は null.
 */
function read_ca_snapshot( int $post_id, bool $lock = false ): ?array {
	global $wpdb;

	if ( $lock ) {
		$rows = $wpdb->get_results(
			$wpdb->prepare( "SELECT meta_id, meta_value FROM {$wpdb->postmeta} WHERE post_id = %d AND meta_key = %s ORDER BY meta_id FOR UPDATE", $post_id, '_profile_post_cas' ),
			ARRAY_A
		);
	} else {
		$rows = $wpdb->get_results(
			$wpdb->prepare( "SELECT meta_id, meta_value FROM {$wpdb->postmeta} WHERE post_id = %d AND meta_key = %s ORDER BY meta_id", $post_id, '_profile_post_cas' ),
			ARRAY_A
		);
	}

	return '' === $wpdb->last_error && is_array( $rows ) ? $rows : null;
}

/**
 * ネットワーク処理後、短いトランザクションで投稿と CA の変更を検査する。
 *
 * @param int   $post_id 投稿 ID.
 * @param array $initial_state 発行前の投稿状態.
 * @param array $initial_cas 発行前の CA メタ行.
 * @param array $post_cas 発行結果.
 * @return bool 保存完了したか.
 */
function store_post_cas( int $post_id, array $initial_state, array $initial_cas, array $post_cas ): bool {
	global $wpdb;

	foreach ( array( $wpdb->posts, $wpdb->postmeta ) as $table ) {
		$engine = $wpdb->get_var(
			$wpdb->prepare( 'SELECT ENGINE FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = %s', $table )
		);
		if ( 'InnoDB' !== $engine || '' !== $wpdb->last_error ) {
			return false;
		}
	}

	$connection_id = $wpdb->get_var( 'SELECT CONNECTION_ID()' );
	if ( ! $connection_id || '' !== $wpdb->last_error ) {
		return false;
	}

	// 実行中のトランザクションがあれば失敗する。呼び出し元の処理を暗黙 commit しない。
	if ( false === $wpdb->query( 'SET TRANSACTION ISOLATION LEVEL REPEATABLE READ' ) ) {
		return false;
	}
	if ( false === $wpdb->query( 'START TRANSACTION' ) ) {
		return false;
	}

	$committed = false;
	try {
		$row = $wpdb->get_row( $wpdb->prepare( "SELECT * FROM {$wpdb->posts} WHERE ID = %d AND CONNECTION_ID() = %d FOR UPDATE", $post_id, $connection_id ) );
		if ( ! $row || '' !== $wpdb->last_error ) {
			return false;
		}
		$current_cas = read_ca_snapshot( $post_id, true );
		if ( null === $current_cas || count( $current_cas ) > 1 || $current_cas !== $initial_cas ) {
			return false;
		}

		$current_post = new \WP_Post( $row );
		$fields       = array(
			'status'       => 'post_status',
			'content'      => 'post_content',
			'title'        => 'post_title',
			'excerpt'      => 'post_excerpt',
			'author'       => 'post_author',
			'date'         => 'post_date',
			'modified'     => 'post_modified',
			'modified_gmt' => 'post_modified_gmt',
		);
		foreach ( $fields as $key => $field ) {
			if ( $current_post->$field !== $initial_state[ $key ] ) {
				return false;
			}
		}
		if ( \get_permalink( $current_post ) !== $initial_state['permalink'] ) {
			return false;
		}

		// update_post_meta の空の prev_value とメタフックによる再入を避ける。
		$value = \maybe_serialize( $post_cas );
		if ( empty( $current_cas ) ) {
			$result = $wpdb->query(
				$wpdb->prepare( "INSERT INTO {$wpdb->postmeta} (post_id, meta_key, meta_value) SELECT %d, %s, %s WHERE CONNECTION_ID() = %d", $post_id, '_profile_post_cas', $value, $connection_id )
			);
		} else {
			$result = $wpdb->query(
				$wpdb->prepare( "UPDATE {$wpdb->postmeta} SET meta_value = %s WHERE meta_id = %d AND CONNECTION_ID() = %d", $value, $current_cas[0]['meta_id'], $connection_id )
			);
		}
		if ( false === $result || ( 0 === $result && ( empty( $current_cas ) || $current_cas[0]['meta_value'] !== $value ) ) ) {
			return false;
		}
		if ( false === $wpdb->query( 'COMMIT' ) || $connection_id !== $wpdb->get_var( 'SELECT CONNECTION_ID()' ) || '' !== $wpdb->last_error ) {
			return false;
		}
		$committed = true;
	} finally {
		if ( ! $committed && false === $wpdb->query( 'ROLLBACK' ) ) {
			\Profile\Debug\debug( "Post ID {$post_id}: CA storage rollback failed." );
		}
		\wp_cache_delete( $post_id, 'post_meta' );
	}

	return $committed;
}
