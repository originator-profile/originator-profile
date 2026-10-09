<?php
/** 投稿閲覧画面 */

namespace Profile\Post;

if ( ! function_exists( 'WP_Filesystem' ) ) {
	require_once ABSPATH . 'wp-admin/includes/file.php';
}
WP_Filesystem();

require_once __DIR__ . '/debug.php';
use function Profile\Debug\debug;

require_once __DIR__ . '/delivery.php';
use function Profile\Delivery\get_cas;
use function Profile\Delivery\external_url;

/** 投稿閲覧画面の初期化 */
function init() {
	\add_action( 'wp_head', '\Profile\Post\cas_script' );
	\add_filter( 'render_block_core/image', '\Profile\Post\block_image', 10, 2 );
}

/**
 * Script要素
 */
function cas_script() {
	if ( ! \is_singular() ) {
		debug( 'Not a singular post, skipping CAS script injection' );
		return;
	}

	$post_id = \get_the_ID();
	$page    = \max( 1, \get_query_var( 'page' ) );
	$cas     = get_cas( $post_id, $page );

	if ( ! $cas ) {
		debug( "No CAS found for post ID: {$post_id}, page: {$page}" );
		return;
	}

	$embedded_or_external = \get_option( 'profile_ca_embedded_or_external', 'embedded' );

	switch ( $embedded_or_external ) {
		case 'embedded':
			echo '<script type="application/cas+json">' . \wp_json_encode( $cas ) . '</script>' . PHP_EOL;
			break;
		case 'external':
			echo '<script src="' . \esc_url( external_url( $post_id, $page ) ) . '" type="application/cas+json"></script>' . PHP_EOL;
			break;
	}
}

/**
 * 画像要素

 * @param string $content ブロックコンテンツ
 * @param array  $block   ブロック
 * @return string ブロックコンテンツ
 */
function block_image( string $content, array $block ): string {
	$id = $block['attrs']['id'] ?? null;

	if ( ! $id ) {
		debug( 'Image block has no ID attribute, skipping integrity injection' );
		return $content;
	}

	$integrity = \get_post_meta( $id, '_profile_attachment_integrity', true );
	$integrity = \is_array( $integrity ) ? \implode( ' ', $integrity ) : null;

	if ( ! $integrity ) {
		debug( "No Integrity metadata found for attachment ID: {$id}" );
		return $content;
	}

	return \str_replace( '<img ', '<img integrity="' . \esc_attr( $integrity ) . '" ', $content );
}
