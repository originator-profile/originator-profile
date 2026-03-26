<?php
/** Content Attestation の発行 */

namespace Profile\Issue;

require_once __DIR__ . '/class-uca.php';
use Profile\Uca\Uca;

require_once __DIR__ . '/config.php';
use const Profile\Config\PROFILE_DEFAULT_CA_SERVER_HOSTNAME;
use const Profile\Config\PROFILE_DEFAULT_CA_SERVER_REQUEST_TIMEOUT;
use const Profile\Config\PROFILE_DEFAULT_CA_TARGET_TYPE;
use const Profile\Config\PROFILE_DEFAULT_CA_TARGET_CSS_SELECTOR;
use const Profile\Config\PROFILE_DEFAULT_CA_TARGET_HTML;

require_once __DIR__ . '/class-casapiauthclient.php';
use Profile\CasApiAuthClient\CasApiAuthClient;

require_once __DIR__ . '/class-casapiauthccsp.php';
use Profile\CasApiAuthClient\CasApiAuthCCSP;

require_once __DIR__ . '/debug.php';
use function Profile\Debug\debug;

require_once __DIR__ . '/url.php';
use function Profile\Url\add_page_query;

/** 投稿への署名処理の初期化
 * transition_post_status について
 * sign_post: 公開への遷移時のみの処理。非公開遷移時は何もしない。
 * private_post: 公開から非公開など公開以外の状態への遷移時の処理。
 */
function init() {
	\add_action( 'transition_post_status', '\Profile\Issue\sign_post', 10, 3 );
	\add_action( 'transition_post_status', '\Profile\Issue\private_post', 20, 3 );
	\add_action( 'before_delete_post', '\Profile\Issue\delete_post', 10, 1 );
	\add_filter( 'wp_generate_attachment_metadata', '\Profile\Issue\update_attachment_integrity_metadata', 10, 2 );
}

/**
 * 投稿への署名
 *
 * @param string   $new_status New post status.
 * @param string   $old_status Old post status.
 * @param \WP_Post $post Post object.
 */
function sign_post( string $new_status, string $old_status, \WP_Post $post ) {
	if ( 'publish' !== $new_status ) {
		debug( "Post status is '{$new_status}', not 'publish'. Skipping CA signing." );
		return;
	}

	foreach ( \get_attached_media( 'image', $post->ID ) as $attachment ) {
		$metadata = \wp_get_attachment_metadata( $attachment->ID );
		update_attachment_integrity_metadata( $metadata, $attachment->ID );
	}

	$admin_secret = \get_option( 'profile_ca_server_admin_secret' );
	$issuer_id    = \get_option( 'profile_ca_issuer_id' );

	if ( ! $admin_secret || ! $issuer_id ) {
		debug( 'Missing required CA server configuration (admin_secret or issuer_id)' );
		return;
	}

	$uuid = extract_uuid_from_cas( $post );

	if ( false === $uuid ) {
		debug( "UUID not available or failed to decode UUID for post ID {$post->ID}. Continuing with new UCA issuance" );
		$uca_list = create_uca_list( $post, $issuer_id ); // UUIDなしで新規発行
	} else {
		$uca_list = create_uca_list( $post, $issuer_id, $uuid );
	}

	if ( empty( $uca_list ) ) {
		debug( "UCA list is empty for post ID: {$post->ID}" );
	}
	$post_cas = array();

	foreach ( $uca_list as $page => $uca ) {
		++$page;

		if ( defined( 'WP_DEBUG' ) && WP_DEBUG ) {
			require_once ABSPATH . 'wp-admin/includes/file.php';

			if ( \WP_Filesystem() ) {
				global $wp_filesystem;

				$wp_filesystem->put_contents( \get_temp_dir() . "/profile-test-snapshots/{$post->ID}.{$page}.snapshot.json", $uca->to_json() );
			}
		}

		$cas = issue_ca( $uca, $admin_secret );
		if ( false === $cas || empty( $cas ) ) {
			debug( "Failed to issue CA for post ID: {$post->ID}, page: {$page}" );
		}
		$cas = is_array( $cas ) ? $cas : array();
		array_push( $post_cas, $cas );
	}

	\update_post_meta( $post->ID, '_profile_post_cas', $post_cas );
}

/**
 * 投稿が公開状態から非公開状態になった場合
 *
 * @param string   $new_status New post status.
 * @param string   $old_status Old post status.
 * @param \WP_Post $post Post object.
 */
function private_post( string $new_status, string $old_status, \WP_Post $post ) {
	if ( 'publish' === $old_status && 'publish' !== $new_status ) {
		$admin_secret = \get_option( 'profile_ca_server_admin_secret' );
		if ( ! $admin_secret ) {
			debug( 'Missing CA server admin secret for deletion' );
			return;
		}
		delete_ca( $admin_secret, $post );
		\delete_post_meta( $post->ID, '_profile_post_cas' );
	}
}

/**
 * 投稿が削除された場合
 *
 * @param int $post_id Post ID.
 */
function delete_post( int $post_id ) {
	$post = \get_post( $post_id );
	if ( ! $post ) {
		debug( "Post not found for ID: {$post_id}" );
		return;
	}

	$admin_secret = \get_option( 'profile_ca_server_admin_secret' );
	if ( ! $admin_secret ) {
		debug( 'Missing CA server admin secret for deletion' );
		return;
	}
	delete_ca( $admin_secret, $post );
}

/**
 * 添付ファイルの整合性メタデータの更新
 *
 * @param array $metadata Attachment metadata.
 * @param int   $attachment_id Attachment ID.
 * @return array Attachment metadata.
 */
function update_attachment_integrity_metadata( array $metadata, int $attachment_id ): array {
	$original_file = WP_CONTENT_DIR . "/uploads/{$metadata['file']}";
	$integrity     = array();

	// 'full' は画像のオリジナルサイズ
	$integrity['full'] = create_integrity( $original_file );

	foreach ( $metadata['sizes'] as $size => $data ) {
		if ( ! isset( $data['file'] ) ) {
			debug( "Size '{$size}' has no file data for attachment ID: {$attachment_id}" );
			continue;
		}

		$file               = \dirname( $original_file ) . "/{$data['file']}";
		$integrity[ $size ] = create_integrity( $file );
	}

	\update_post_meta( $attachment_id, '_profile_attachment_integrity', $integrity );

	return $metadata;
}

/**
 * JWTを受け取り、CA ID を返す関数。
 *
 * @param string $jwt JWT
 * @return string CA ID
 */
function extract_uuid_from_jwt( string $jwt ) {
	if ( '' === $jwt ) {
		debug( 'extract_uuid_from_jwt: empty JWT string' );
		return false;
	}

	$parts = explode( '.', $jwt );
	if ( count( $parts ) !== 3 ) {
		debug( 'extract_uuid_from_jwt: invalid JWT format (expected 3 parts)' );
		return false;
	}

	$payload_encoded = $parts[1];
	$base64          = strtr( $payload_encoded, '-_', '+/' );
	$padding         = strlen( $base64 ) % 4;
	if ( $padding > 0 ) {
		$base64 .= str_repeat( '=', 4 - $padding );
	}

	// phpcs:ignore WordPress.PHP.DiscouragedPHPFunctions.obfuscation_base64_decode
	$payload_json = \base64_decode( $base64, true );
	if ( false === $payload_json ) {
		debug( 'extract_uuid_from_jwt: base64_decode failed' );
		return false;
	}

	$payload = json_decode( $payload_json, true );
	if ( ! is_array( $payload ) ) {
		debug( 'extract_uuid_from_jwt: json_decode failed (not an array)' );
		return false;
	}

	if (
		! isset( $payload['credentialSubject'] ) ||
		! is_array( $payload['credentialSubject'] ) ||
		! isset( $payload['credentialSubject']['id'] ) ||
		! is_string( $payload['credentialSubject']['id'] ) ||
		'' === $payload['credentialSubject']['id']
	) {
		debug( 'extract_uuid_from_jwt: credentialSubject.id not found' );
		return false;
	}

	return $payload['credentialSubject']['id'];
}

/**
 * CAS から UUID を抽出する関数
 *
 * @param \WP_Post $post Post object.
 * @return string|false UUID(取得できなければ false)
 */
function extract_uuid_from_cas( \WP_Post $post ) {
	$cas  = \get_post_meta( $post->ID, '_profile_post_cas', true );
	$page = \max( 1, \get_query_var( 'page' ) );
	$cas  = is_array( $cas ) ? $cas[ $page - 1 ] : $cas;

	if ( is_array( $cas ) && isset( $cas[0] ) && is_string( $cas[0] ) ) {
		$jwt = $cas[0];
	} elseif ( is_string( $cas ) ) {
		$jwt = $cas;
	} else {
		// CAS が存在しないか、予期した形式でない場合はここで処理される
		debug( "No CAS found for post ID {$post->ID}, page {$page}" );
		$jwt = null;
	}

	if ( null !== $jwt ) {
		$uuid = extract_uuid_from_jwt( $jwt );
	} else {
		$uuid = false;
	}

	return $uuid;
}

/**
 * Integrity の計算
 *
 * @param string $file ファイルパス
 * @return string Integrity Metadata
 */
function create_integrity( string $file ): string {
	$alg  = 'sha256';
	$hash = \hash_file( $alg, $file, true );
	// phpcs:ignore WordPress.PHP.DiscouragedPHPFunctions.obfuscation_base64_encode
	$val = \base64_encode( $hash );
	return "{$alg}-{$val}";
}

/**
 * 未署名 Content Attestation の一覧の作成
 *
 * @param \WP_Post $post Post object.
 * @param string   $issuer_id CA 発行者 ID
 * @param ?string  $uuid CA ID uuid
 * @return list<Uca> 未署名 Content Attestation の一覧
 */
function create_uca_list( \WP_Post $post, string $issuer_id, ?string $uuid = null ): array {
	global $wp_rewrite;

	/**
	 * 未署名 Content Attestation の一覧
	 *
	 * @var list<Uca>
	 */
	$uca_list = array();

	$postdata = \generate_postdata( $post );

	if ( ! $postdata ) {
		debug( "Failed to generate postdata for post ID: {$post->ID}" );
		return $uca_list;
	}

	$pages = $postdata['pages'];
	$title = \esc_html( \get_the_title( $post ) );

	foreach ( $pages as $page => $content ) {
		++$page;

		$content            = \apply_filters( 'the_content', $content );
		$html               = content_to_html( $content, \get_option( 'profile_ca_target_html', PROFILE_DEFAULT_CA_TARGET_HTML ), $title );
		$external_resources = external_resources_from_html( $html, '//*[contains(@class, "wp-block-image")]//img[@integrity]' );

		if ( defined( 'WP_DEBUG' ) && WP_DEBUG ) {
			require_once ABSPATH . 'wp-admin/includes/file.php';

			if ( \WP_Filesystem() ) {
				global $wp_filesystem;
				$wp_filesystem->put_contents( \get_temp_dir() . "/profile-test-snapshots/{$post->ID}.{$page}.snapshot.html", $html );
			}
		}

		$uri       = $post->guid;
		$permalink = \get_permalink( $post );

		if ( $page > 1 ) {
			$uri = add_page_query( $uri, $page );

			// ページのパーマリンクの形式は設定によって異なる.
			if ( $wp_rewrite->using_permalinks() ) {
				$permalink .= $wp_rewrite->use_trailing_slashes ? '' : '/';
				$permalink .= \user_trailingslashit( $page );
			} else {
				$permalink = add_page_query( $permalink, $page );
			}
		}

		$locale = \str_replace( '_', '-', \get_locale() );

		$uca = new Uca(
			issuer: $issuer_id,
			subject: $uuid,
			url: $permalink,
			locale: $locale,
			html: $html,
			target_type: \get_option( 'profile_ca_target_type', PROFILE_DEFAULT_CA_TARGET_TYPE ),
			target_css_selector: \get_option( 'profile_ca_target_css_selector', PROFILE_DEFAULT_CA_TARGET_CSS_SELECTOR ),
			external_resources: $external_resources,
			headline: $post->post_title,
			description: \has_excerpt( $post ) ? \get_the_excerpt( $post ) : '',
			image: \has_post_thumbnail( $post ) ? \get_the_post_thumbnail_url( $post ) : null,
			author: \get_the_author_meta( 'display_name', $post->post_author ),
			date_published: \get_the_date( \DateTimeInterface::RFC3339, $post ),
			date_modified: \get_the_modified_date( \DateTimeInterface::RFC3339, $post ),
		);

		\array_push( $uca_list, $uca );
	}

	return $uca_list;
}

/**
 * WordPress post contentからHTMLへの変換
 *
 * @param string $content WordPress post content
 * @param string $template テンプレート (%TITLE% を置換、%CONTENT% を置換)
 * @param string $title 投稿タイトル
 * @return string HTML
 */
function content_to_html( string $content, string $template, string $title = '' ): string {
	return \strtr(
		$template,
		array(
			'%TITLE%'   => $title,
			'%CONTENT%' => $content,
		)
	);
}

/**
 * HTMLから外部リソースのIntegrityを取得
 *
 * @param string $html HTML
 * @param string $xpath_query XPathクエリ
 * @return array<string> 外部リソースのIntegrity一覧
 */
function external_resources_from_html( string $html, string $xpath_query ): array {
	$document = new \DOMDocument();
	$document->loadHTML( $html );
	$xpath     = new \DOMXpath( $document );
	$elements  = $xpath->query( $xpath_query );
	$resources = array();

	if ( $elements ) {
		foreach ( $elements as $element ) {
			if ( $element->attributes['integrity']->value ) {
				array_push( $resources, $element->attributes['integrity']->value );
			}
		}
	} else {
		debug( "No external resources found matching Xpath query: {$xpath_query}" );
	}

	return $resources;
}

/**
 * Content Attestation サーバーのベース URL を返す
 *
 * @return string ベース URL
 */
function build_ca_base_endpoint(): string {
	$hostname = \get_option( 'profile_ca_server_hostname', PROFILE_DEFAULT_CA_SERVER_HOSTNAME );
	if ( defined( 'WP_DEBUG' ) && WP_DEBUG && 'localhost' === $hostname ) {
		$in_docker = \file_exists( '/.dockerenv' );
		if ( $in_docker ) {
			return 'http://host.docker.internal:8080';
		} else {
			return 'http://localhost:8080';
		}
	}
	return "https://{$hostname}";
}

/**
 * エンドポイントの構築
 *
 * @param string $endpoint_path エンドポイントのパス（例: '/ca' または '/ca/{uuid}'）
 * @return string エンドポイント
 */
function build_ca_endpoint( string $endpoint_path ): string {
	return build_ca_base_endpoint() . $endpoint_path;
}

/**
 * Content Attestation の発行
 *
 * @param Uca    $uca 未署名 Content Attestation オブジェクト
 * @param string $admin_secret Content Attestation サーバー認証情報
 * @return mixed 成功した場合は Content Attestation Set、失敗した場合は false
 */
function issue_ca( Uca $uca, string $admin_secret ): mixed {
	$endpoint = build_ca_endpoint( '/ca' );
	return request_ca( $endpoint, $admin_secret, 'POST', $uca->to_json() );
}

/**
 * Content Attestation の削除
 *
 * @param string   $admin_secret Content Attestation サーバー認証情報
 * @param \WP_Post $post 投稿オブジェクト
 * @return bool
 */
function delete_ca( string $admin_secret, \WP_Post $post ): bool {
	$uuid = extract_uuid_from_cas( $post );
	if ( false === $uuid ) {
		debug( "delete_ca: UUID not found for post ID {$post->ID}. Skipping deletion." );
		return false;
	}
	$endpoint = build_ca_endpoint( "/ca/{$uuid}" );
	$res      = request_ca( $endpoint, $admin_secret, 'DELETE' );

	if ( false === $res ) {
		debug( "Failed to delete CA for post ID {$post->ID}" );
		return false;
	}
	debug( "Successfully deleted CA for post ID {$post->ID}" );
	return true;
}

/**
 * Content Attestation サーバーへのリクエスト
 *
 * @param string  $endpoint Content Attestation サーバー CA 登録・更新・削除エンドポイント
 * @param string  $admin_secret Content Attestation サーバー認証情報
 * @param string  $method Content Attestation サーバーへのリクエストメソッド
 * @param ?string $body (optional) Content Attestation サーバーへのリクエストボディ
 * @return mixed 成功した場合はレスポンスボディをデコードした結果または true 、失敗した場合は false
 */
function request_ca( string $endpoint, string $admin_secret, string $method = 'POST', ?string $body = null ): mixed {
	$args = array(
		'method'  => $method,
		'timeout' => PROFILE_DEFAULT_CA_SERVER_REQUEST_TIMEOUT,
		'headers' => array(),
	);

	if ( null !== $body ) {
		$args['headers']['content-type'] = 'application/json';
		$args['body']                    = $body;
	}

	$secret_arr = explode( ':', $admin_secret );
	$username   = $secret_arr[0] ?? '';
	switch ( $username ) {
		case 'OIDC': // OIDCの場合はCA Server認証(OIDC)を行う
			$api_auth = new CasApiAuthClient();
			if ( ! $api_auth->init_oidc( $admin_secret ) ) {
				debug( 'Failed to initialize OIDC client.' );
				return false;
			}
			$args['headers']['authorization'] = 'Bearer ' . $api_auth->get_api_token();
			break;
		case 'CCSP': // CCSPの場合はCA Server認証(CCSP)を行う
			$api_auth = new CasApiAuthCCSP();
			if ( ! $api_auth->init_ccsp( $admin_secret ) ) {
				debug( 'Failed to initialize CCSP client.' );
				return false;
			}
			$args['headers']['authorization'] = 'Bearer ' . $api_auth->get_api_token();
			break;
		default: // それ以外の場合は、Basic 認証を使う
			$args['headers']['authorization'] = 'Basic ' . \sodium_bin2base64( $admin_secret, SODIUM_BASE64_VARIANT_ORIGINAL );
			break;
	}
	$res = \wp_remote_request( $endpoint, $args );
	if ( \is_wp_error( $res ) ) {
		$error_message = $res->get_error_message();
		debug( 'Failed to request: ' . $error_message );
		return false;
	}

	if ( 200 !== $res['response']['code'] && 204 !== $res['response']['code'] ) {
		debug( "HTTP {$res['response']['code']}: {$res['body']}" );
		return false;
	}

	if ( 204 === $res['response']['code'] ) {
		return true;
	}

	return \json_decode( $res['body'], true );
}
