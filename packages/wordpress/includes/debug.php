<?php
/** Debug */

namespace Profile\Debug;

require_once __DIR__ . '/config.php';
use const Profile\Config\PROFILE_DEFAULT_CA_LOG_DIR;

/**
 * Debug function
 *
 * @param string $message The message to log.
 */
function debug( string $message ) {
	$date = gmdate( 'c' );
	// WordPress 全体のデバッグログ
	if ( defined( 'WP_DEBUG' ) && WP_DEBUG ) {
		\error_log( $message );
	}
	// プラグイン専用ログ
	if ( function_exists( 'get_option' ) && \get_option( 'profile_ca_log_option' ) === '1' ) {
		global $wp_filesystem;
		if ( ! $wp_filesystem ) {
			require_once ABSPATH . 'wp-admin/includes/file.php';
			WP_Filesystem();
		}
		$dir_name   = PROFILE_DEFAULT_CA_LOG_DIR;
		$upload_dir = wp_upload_dir();
		$dir        = trailingslashit( $upload_dir['basedir'] . '/' . $dir_name );
		if ( ! $wp_filesystem->exists( $dir ) ) {
			if ( ! $wp_filesystem->mkdir( $dir, 0750 ) ) {
				\error_log( "Failed to create directory: {$dir}" );
				return;
			}
		}
		$log_file = "{$dir}ca-manager-debug.log";
		\error_log( "[Date:{$date}] " . $message . PHP_EOL, 3, $log_file );
	}
}
