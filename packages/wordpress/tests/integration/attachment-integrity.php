<?php
/**
 * Real WordPress checks for attachment integrity metadata.
 *
 * @package Profile
 */

if ( ! defined( 'WP_CLI' ) || ! WP_CLI ) {
	return;
}

// These checks create and remove image files directly.
// phpcs:disable WordPress.WP.AlternativeFunctions

function profile_integrity_assert( bool $condition, string $message ): void {
	if ( ! $condition ) {
		throw new RuntimeException( esc_html( $message ) );
	}
}

/**
 * Create a PNG file large enough to have sub sizes.
 *
 * @param string $file File path.
 */
function profile_integrity_create_png( string $file ): void {
	$image = imagecreatetruecolor( 400, 300 );
	imagefill( $image, 0, 0, imagecolorallocate( $image, 30, 120, 200 ) );
	imagepng( $image, $file );
	imagedestroy( $image );
}

require_once ABSPATH . 'wp-admin/includes/image.php';

$previous_user   = get_current_user_id();
$basedir         = WP_CONTENT_DIR . '/profile-integrity-uploads-' . wp_generate_password( 8, false );
$baseurl         = content_url( basename( $basedir ) );
$attachment_id   = 0;
$document_id     = 0;
$parent_id       = 0;
$fixture_post_id = 0;
$request_body    = null;
$filters         = array();
$options         = array(
	'profile_ca_server_hostname'     => 'example.test',
	'profile_ca_issuer_id'           => 'dns:example.test',
	'profile_ca_server_admin_secret' => 'test:secret',
	'profile_ca_excluded_urls'       => array(),
);
foreach ( $options as $name => $value ) {
	$filters[ 'pre_option_' . $name ] = static fn () => $value;
}
// UPLOADS 定数や upload_path オプションでアップロード先を変えたサイトを再現する (WP_CONTENT_DIR/uploads 以外).
$filters['upload_dir']       = static function ( array $uploads ) use ( $basedir, $baseurl ) {
	$uploads['basedir'] = $basedir;
	$uploads['baseurl'] = $baseurl;
	$uploads['path']    = $basedir . $uploads['subdir'];
	$uploads['url']     = $baseurl . $uploads['subdir'];
	return $uploads;
};
$filters['pre_http_request'] = static function ( $preempt, array $args ) use ( &$request_body ) {
	$request_body = $args['body'] ?? null;
	return array(
		'headers'  => array(),
		'body'     => '["test-ca"]',
		'response' => array( 'code' => 200 ),
		'cookies'  => array(),
	);
};
foreach ( $filters as $hook => $callback ) {
	add_filter( $hook, $callback, 10, 2 );
}
$sign_priority = has_action( 'transition_post_status', '\Profile\Issue\sign_post' );
remove_action( 'transition_post_status', '\Profile\Issue\sign_post', $sign_priority );

try {
	$admins = get_users(
		array(
			'role'   => 'administrator',
			'number' => 1,
		)
	);
	profile_integrity_assert( ! empty( $admins ), 'An administrator is required.' );
	wp_set_current_user( $admins[0]->ID );

	$uploads = wp_upload_dir();
	profile_integrity_assert( $basedir === $uploads['basedir'], 'The custom upload directory was not applied.' );
	wp_mkdir_p( $uploads['path'] );
	$file = $uploads['path'] . '/profile-integrity.png';
	profile_integrity_create_png( $file );

	// 他の投稿に添付された画像を再利用するケース.
	$parent_id = wp_insert_post(
		array(
			'post_title'  => 'Integrity parent fixture',
			'post_status' => 'draft',
		),
		true
	);
	profile_integrity_assert( ! is_wp_error( $parent_id ), 'Could not create the parent post.' );
	$attachment_id = wp_insert_attachment(
		array(
			'post_mime_type' => 'image/png',
			'post_title'     => 'Integrity fixture',
			'post_status'    => 'inherit',
		),
		$file,
		$parent_id,
		true
	);
	profile_integrity_assert( ! is_wp_error( $attachment_id ), 'Could not create the attachment.' );

	// wp_generate_attachment_metadata フィルター経由で integrity が保存される.
	$metadata = wp_generate_attachment_metadata( $attachment_id, $file );
	wp_update_attachment_metadata( $attachment_id, $metadata );
	profile_integrity_assert( ! empty( $metadata['sizes'] ), 'The fixture image has no sub sizes.' );
	$integrity = get_post_meta( $attachment_id, '_profile_attachment_integrity', true );
	profile_integrity_assert( is_array( $integrity ), 'Integrity metadata was not saved.' );
	profile_integrity_assert( \Profile\Issue\create_integrity( $file ) === ( $integrity['full'] ?? null ), 'The full size integrity does not match the original file.' );
	profile_integrity_assert( count( $metadata['sizes'] ) + 1 === count( $integrity ), 'Some sub size integrity values are missing.' );
	profile_integrity_assert( \Profile\Issue\valid_integrity_values( $integrity ) === array_values( $integrity ), 'Invalid integrity values were saved.' );

	// 以前のバージョンで保存された不正な値は出力しない.
	$valid = $integrity['full'];
	update_post_meta(
		$attachment_id,
		'_profile_attachment_integrity',
		array(
			'full'      => 'sha256-',
			'thumbnail' => $valid,
		)
	);
	$block = array(
		'blockName' => 'core/image',
		'attrs'     => array( 'id' => $attachment_id ),
	);
	$html  = \Profile\Post\block_image( '<figure class="wp-block-image"><img src="x.png" /></figure>', $block );
	profile_integrity_assert( str_contains( $html, 'integrity="' . esc_attr( $valid ) . '"' ), 'The valid integrity value was not rendered.' );
	profile_integrity_assert( ! str_contains( $html, 'sha256- ' ) && ! str_contains( $html, 'sha256-"' ), 'An empty integrity value was rendered.' );

	// CA 発行時に、本文の画像ブロックが参照する他の投稿の添付画像の integrity も再計算する.
	$fixture_post_id = wp_insert_post(
		array(
			'post_title'   => 'Integrity post fixture',
			'post_status'  => 'publish',
			'post_content' => '<!-- wp:image {"id":' . $attachment_id . ',"sizeSlug":"full"} --><figure class="wp-block-image size-full"><img src="' . esc_url( wp_get_attachment_url( $attachment_id ) ) . '" alt="" class="wp-image-' . $attachment_id . '"/></figure><!-- /wp:image -->',
		),
		true
	);
	profile_integrity_assert( ! is_wp_error( $fixture_post_id ), 'Could not create the post.' );
	profile_integrity_assert( in_array( $attachment_id, \Profile\Issue\collect_image_attachment_ids( get_post( $fixture_post_id ) ), true ), 'The reused image was not collected.' );
	$result = \Profile\Issue\issue_post( get_post( $fixture_post_id ) );
	profile_integrity_assert( 'success' === $result['status'], 'CA issuance failed: ' . ( $result['message'] ?? '' ) );
	profile_integrity_assert( get_post_meta( $attachment_id, '_profile_attachment_integrity', true ) === $integrity, 'Integrity metadata was not recomputed during CA issuance.' );
	$request   = is_string( $request_body ) ? json_decode( $request_body, true ) : null;
	$resources = array_values(
		array_filter(
			$request['target'] ?? array(),
			static fn ( $target ) => 'ExternalResourceTargetIntegrity' === ( $target['type'] ?? null )
		)
	);
	profile_integrity_assert( 1 === count( $resources ), 'The CA request does not contain the image as an external resource.' );
	profile_integrity_assert( implode( ' ', $integrity ) === $resources[0]['integrity'], 'The CA request does not contain the recomputed image integrity.' );

	// 一部のサイズのファイルを読み込めない場合は、そのサイズだけを保存しない.
	$thumbnail = dirname( $file ) . '/' . $metadata['sizes']['thumbnail']['file'];
	unlink( $thumbnail );
	\Profile\Issue\update_attachment_integrity_metadata( wp_get_attachment_metadata( $attachment_id ), $attachment_id );
	$partial = $integrity;
	unset( $partial['thumbnail'] );
	profile_integrity_assert( get_post_meta( $attachment_id, '_profile_attachment_integrity', true ) === $partial, 'Integrity metadata for a missing size was saved.' );

	// ファイルを読み込めない場合は不正な値を保存せず、メタデータを削除する.
	foreach ( glob( $uploads['path'] . '/profile-integrity*.png' ) as $image ) {
		unlink( $image );
	}
	\Profile\Issue\update_attachment_integrity_metadata( wp_get_attachment_metadata( $attachment_id ), $attachment_id );
	profile_integrity_assert( '' === get_post_meta( $attachment_id, '_profile_attachment_integrity', true ), 'Integrity metadata was kept for missing files.' );

	// 画像以外の添付ファイルは対象外とする.
	$document_file = $uploads['path'] . '/profile-integrity.txt';
	file_put_contents( $document_file, 'not an image' );
	$document_id = wp_insert_attachment(
		array(
			'post_mime_type' => 'text/plain',
			'post_title'     => 'Integrity document fixture',
			'post_status'    => 'inherit',
		),
		$document_file,
		0,
		true
	);
	profile_integrity_assert( ! is_wp_error( $document_id ), 'Could not create the document attachment.' );
	\Profile\Issue\update_attachment_integrity_metadata( array(), $document_id );
	profile_integrity_assert( '' === get_post_meta( $document_id, '_profile_attachment_integrity', true ), 'Integrity metadata was saved for a non-image attachment.' );

	WP_CLI::success( 'Attachment integrity checks passed.' );
} finally {
	if ( $fixture_post_id && ! is_wp_error( $fixture_post_id ) ) {
		wp_delete_post( $fixture_post_id, true );
	}
	if ( $attachment_id && ! is_wp_error( $attachment_id ) ) {
		wp_delete_attachment( $attachment_id, true );
	}
	if ( $document_id && ! is_wp_error( $document_id ) ) {
		wp_delete_attachment( $document_id, true );
	}
	if ( $parent_id && ! is_wp_error( $parent_id ) ) {
		wp_delete_post( $parent_id, true );
	}
	foreach ( $filters as $hook => $callback ) {
		remove_filter( $hook, $callback, 10 );
	}
	add_action( 'transition_post_status', '\Profile\Issue\sign_post', $sign_priority, 3 );
	wp_set_current_user( $previous_user );
	if ( is_dir( $basedir ) ) {
		$iterator = new RecursiveIteratorIterator( new RecursiveDirectoryIterator( $basedir, FilesystemIterator::SKIP_DOTS ), RecursiveIteratorIterator::CHILD_FIRST );
		foreach ( $iterator as $entry ) {
			$entry->isDir() ? rmdir( $entry->getPathname() ) : unlink( $entry->getPathname() );
		}
		rmdir( $basedir );
	}
}
