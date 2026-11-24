<?php
/**
 * Plugin log output and the files prepared on activation.
 *
 * @package Profile
 */

if ( ! defined( 'WP_CLI' ) || ! WP_CLI ) {
	return;
}

use const Profile\Config\PROFILE_DEFAULT_CA_LOG_DIR;

/**
 * Check a log assertion.
 *
 * @param bool   $condition Condition.
 * @param string $message Failure message.
 * @throws RuntimeException When the condition fails.
 */
function profile_log_assert( bool $condition, string $message ): void {
	if ( ! $condition ) {
		throw new RuntimeException( esc_html( $message ) );
	}
}

global $wp_filesystem;
if ( ! $wp_filesystem ) {
	require_once ABSPATH . 'wp-admin/includes/file.php';
	WP_Filesystem();
}

// 実際のログを消さないよう、アップロード先をテスト用ディレクトリに差し替える.
$real_uploads  = wp_upload_dir( null, false );
$test_basedir  = $real_uploads['basedir'] . '/profile-log-test-' . strtolower( wp_generate_password( 12, false ) );
$upload_filter = static function ( array $uploads ) use ( $test_basedir ): array {
	$uploads['basedir'] = $test_basedir;
	$uploads['path']    = $test_basedir . $uploads['subdir'];
	return $uploads;
};
$log_dir       = $test_basedir . '/' . PROFILE_DEFAULT_CA_LOG_DIR . '/';
$log_file      = $log_dir . 'ca-manager-debug.log';
$index_file    = $log_dir . 'index.php';
$htaccess_file = $log_dir . '.htaccess';

$missing         = new stdClass();
$previous_option = get_option( 'profile_ca_log_option', $missing );

add_filter( 'upload_dir', $upload_filter );

try {
	profile_log_assert( $wp_filesystem->mkdir( $test_basedir ), 'Could not create the test upload directory.' );

	// 有効化すると、ログ用ディレクトリとアクセス制御のファイルを用意する.
	\Profile\Activator\ca_manager_activate();
	profile_log_assert( $wp_filesystem->is_dir( $log_dir ), 'Activation should create the log directory.' );
	profile_log_assert( $wp_filesystem->exists( $index_file ), 'Activation should create index.php.' );
	profile_log_assert( str_starts_with( $wp_filesystem->get_contents( $index_file ), '<?php' ), 'index.php should be a PHP file that outputs nothing.' );
	$rules = $wp_filesystem->get_contents( $htaccess_file );
	profile_log_assert( is_string( $rules ), 'Activation should create .htaccess.' );
	profile_log_assert( 1 === preg_match( '/<FilesMatch "(.+)">\s+Require all denied\s+<\/FilesMatch>/', $rules, $matches ), '.htaccess should deny access to the matched files.' );
	profile_log_assert( 1 === preg_match( '/' . $matches[1] . '/', 'ca-manager-debug.log' ), '.htaccess should deny access to the log file.' );
	profile_log_assert( ! $wp_filesystem->exists( $log_file ), 'Activation should not create the log file.' );

	// 再度有効化しても、既存のファイルは上書きしない.
	$wp_filesystem->put_contents( $index_file, "<?php\n// custom\n" );
	$wp_filesystem->put_contents( $htaccess_file, "# custom\n" );
	\Profile\Activator\ca_manager_activate();
	profile_log_assert( "<?php\n// custom\n" === $wp_filesystem->get_contents( $index_file ), 'Activation should keep an existing index.php.' );
	profile_log_assert( "# custom\n" === $wp_filesystem->get_contents( $htaccess_file ), 'Activation should keep an existing .htaccess.' );

	// ログの出力設定が無効のときは、ログファイルに書き出さない.
	update_option( 'profile_ca_log_option', '0' );
	\Profile\Debug\debug( 'log integration disabled' );
	profile_log_assert( ! $wp_filesystem->exists( $log_file ), 'Nothing should be logged while the log option is disabled.' );

	// 有効にすると、日時付きで追記する.
	update_option( 'profile_ca_log_option', '1' );
	\Profile\Debug\debug( 'log integration first' );
	\Profile\Debug\debug( 'log integration second' );
	$lines = explode( PHP_EOL, trim( (string) $wp_filesystem->get_contents( $log_file ) ) );
	profile_log_assert( 2 === count( $lines ), 'Each message should be appended as one line.' );
	profile_log_assert( 1 === preg_match( '/^\[Date:\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\+00:00\] log integration first$/', $lines[0] ), 'A log line should start with the date in UTC.' );
	profile_log_assert( str_ends_with( $lines[1], '] log integration second' ), 'The second message should follow the first.' );

	// ログ用ディレクトリが無くても、作成して書き出す.
	$wp_filesystem->delete( $log_dir, true );
	\Profile\Debug\debug( 'log integration recreated' );
	profile_log_assert( str_contains( (string) $wp_filesystem->get_contents( $log_file ), 'log integration recreated' ), 'Logging should recreate the log directory.' );

	// 無効にすると、ログファイルを削除する（アクセス制御のファイルは残す）.
	\Profile\Activator\ca_manager_activate();
	update_option( 'profile_ca_log_option', '0' );
	profile_log_assert( ! $wp_filesystem->exists( $log_file ), 'Disabling the log option should delete the log file.' );
	profile_log_assert( $wp_filesystem->exists( $htaccess_file ), 'Disabling the log option should keep .htaccess.' );

	// ログファイルが無い状態で無効にしてもエラーにならない.
	update_option( 'profile_ca_log_option', '1' );
	update_option( 'profile_ca_log_option', '0' );
	profile_log_assert( ! $wp_filesystem->exists( $log_file ), 'Disabling without a log file should leave nothing behind.' );

	WP_CLI::success( 'Log checks passed: activation files, existing files kept, disabled writes nothing, enabled appends, directory recreated, disabling deletes the log.' );
} finally {
	// 設定を戻すときも実際のログに触れないよう、差し替えを外す前に戻す.
	if ( $missing === $previous_option ) {
		delete_option( 'profile_ca_log_option' );
	} else {
		update_option( 'profile_ca_log_option', $previous_option );
	}
	$wp_filesystem->delete( $test_basedir, true );
	remove_filter( 'upload_dir', $upload_filter );
}
