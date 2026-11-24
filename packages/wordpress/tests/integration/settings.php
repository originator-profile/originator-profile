<?php
/**
 * Saved setting values: defaults, use in CA issuance and output on the settings page.
 *
 * @package Profile
 */

if ( ! defined( 'WP_CLI' ) || ! WP_CLI ) {
	return;
}

use Profile\Uca\Uca;
use const Profile\Config\PROFILE_DEFAULT_CA_SERVER_HOSTNAME;
use const Profile\Config\PROFILE_DEFAULT_CA_TARGET_CSS_SELECTOR;
use const Profile\Config\PROFILE_DEFAULT_CA_TARGET_HTML;
use const Profile\Config\PROFILE_DEFAULT_CA_TARGET_TYPE;

/**
 * Check a settings assertion.
 *
 * @param bool   $condition Condition.
 * @param string $message Failure message.
 * @throws RuntimeException When the condition fails.
 */
function profile_settings_assert( bool $condition, string $message ): void {
	if ( ! $condition ) {
		throw new RuntimeException( esc_html( $message ) );
	}
}

/**
 * Capture the output of a settings field.
 *
 * @param callable $field Field callback.
 * @return string Output.
 */
function profile_settings_render( callable $field ): string {
	ob_start();
	try {
		$field();
	} finally {
		$output = ob_get_clean();
	}
	return (string) $output;
}

$previous_user = get_current_user_id();
$post_ids      = array();
$bodies        = array();
$filters       = array(
	'pre_option_profile_ca_server_hostname'     => static fn () => 'ca.example.net',
	'pre_option_profile_ca_issuer_id'           => static fn () => 'dns:example.test',
	'pre_option_profile_ca_server_admin_secret' => static fn () => 'test:secret',
	'pre_option_profile_ca_excluded_urls'       => static fn () => array(),
);
foreach ( $filters as $hook => $callback ) {
	add_filter( $hook, $callback );
}
// 発行リクエストの本文を記録し、発行済みの応答を返す.
$http_filter = static function ( $preempt, array $args ) use ( &$bodies ) {
	if ( isset( $args['body'] ) && is_string( $args['body'] ) ) {
		$bodies[] = $args['body'];
	}
	return array(
		'headers'  => array(),
		'body'     => '["test-ca"]',
		'response' => array( 'code' => 200 ),
		'cookies'  => array(),
	);
};
add_filter( 'pre_http_request', $http_filter, 10, 2 );
$sign_priority = has_action( 'transition_post_status', '\Profile\Issue\sign_post' );
remove_action( 'transition_post_status', '\Profile\Issue\sign_post', $sign_priority );

// 保存済みの設定を控え、未保存の状態から始める.
$missing  = new stdClass();
$options  = array(
	'profile_ca_target_type',
	'profile_ca_target_css_selector',
	'profile_ca_target_html',
	'profile_ca_embedded_or_external',
);
$previous = array();
foreach ( $options as $option ) {
	$previous[ $option ] = get_option( $option, $missing );
	delete_option( $option );
}

// 直近の発行リクエストの検証対象 (target の先頭) を返す.
$issued_target = static function ( int $test_post_id ) use ( &$bodies ): array {
	$bodies = array();
	$result = \Profile\Issue\issue_post( get_post( $test_post_id ) );
	profile_settings_assert( 'success' === $result['status'], 'Issuance should succeed.' );
	profile_settings_assert( 1 === count( $bodies ), 'A single-page post should send one CA request.' );
	$uca = json_decode( $bodies[0], true );
	profile_settings_assert( isset( $uca['target'][0]['content'] ) && str_starts_with( $uca['target'][0]['content'], Uca::DATA_URL_PREFIX ), 'The request should contain the target as a data URL.' );
	$target = $uca['target'][0];
	// phpcs:ignore WordPress.PHP.DiscouragedPHPFunctions.obfuscation_base64_decode
	$target['html'] = (string) base64_decode( substr( $target['content'], strlen( Uca::DATA_URL_PREFIX ) ), true );
	return $target;
};

try {
	$admins = get_users(
		array(
			'role'   => 'administrator',
			'number' => 1,
		)
	);
	profile_settings_assert( ! empty( $admins ), 'An administrator is required.' );
	wp_set_current_user( $admins[0]->ID );
	$test_post_id = wp_insert_post(
		array(
			'post_status'  => 'publish',
			'post_title'   => 'Settings integration',
			'post_content' => '<!-- wp:paragraph --><p>Settings test content.</p><!-- /wp:paragraph -->',
		),
		true
	);
	$post_ids[]   = $test_post_id;
	profile_settings_assert( is_int( $test_post_id ) && $test_post_id > 0, 'Could not create test post.' );

	// 未保存のときは、初期値で発行する.
	$target = $issued_target( $test_post_id );
	profile_settings_assert( PROFILE_DEFAULT_CA_TARGET_TYPE === $target['type'], 'The default target type should be used.' );
	profile_settings_assert( PROFILE_DEFAULT_CA_TARGET_CSS_SELECTOR === $target['cssSelector'], 'The default CSS selector should be used.' );
	profile_settings_assert( str_contains( $target['html'], '<h1 class="wp-block-post-title">Settings integration</h1>' ), 'The default HTML should contain the title.' );
	profile_settings_assert( 1 === preg_match( '#<div class="wp-block-post-content">\s*<p[^>]*>Settings test content\.</p>\s*</div>#', $target['html'] ), 'The default HTML should contain the content.' );

	// 保存した値で発行する.
	update_option( 'profile_ca_target_type', 'HtmlTargetIntegrity' );
	update_option( 'profile_ca_target_css_selector', 'article.custom > *' );
	update_option( 'profile_ca_target_html', '<main><h2>%TITLE%</h2><article class="custom">%CONTENT%</article></main>' );
	$target = $issued_target( $test_post_id );
	profile_settings_assert( 'HtmlTargetIntegrity' === $target['type'], 'The saved target type should be used.' );
	profile_settings_assert( 'article.custom > *' === $target['cssSelector'], 'The saved CSS selector should be used.' );
	profile_settings_assert( 1 === preg_match( '#^<main><h2>Settings integration</h2><article class="custom">\s*<p[^>]*>Settings test content\.</p>\s*</article></main>$#', $target['html'] ), 'The saved HTML should be filled with the title and content.' );

	// プレースホルダーの無い HTML は、そのまま検証対象になる.
	update_option( 'profile_ca_target_html', '<p>fixed</p>' );
	$target = $issued_target( $test_post_id );
	profile_settings_assert( '<p>fixed</p>' === $target['html'], 'HTML without placeholders should be used as is.' );

	// 設定画面で保存できるよう、全項目を同じグループに登録する.
	require_once ABSPATH . 'wp-admin/includes/template.php';
	\Profile\Admin\register_settings();
	$registered = get_registered_settings();
	$saved      = array(
		'profile_ca_server_hostname',
		'profile_ca_issuer_id',
		'profile_ca_server_admin_secret',
		'profile_ca_target_type',
		'profile_ca_target_css_selector',
		'profile_ca_target_html',
		'profile_ca_embedded_or_external',
		'profile_ca_log_option',
	);
	foreach ( $saved as $option ) {
		profile_settings_assert( isset( $registered[ $option ] ) && 'ca-manager' === $registered[ $option ]['group'], "{$option} should be registered in the ca-manager group." );
	}
	profile_settings_assert( 'ca-manager-exclusion' === $registered['profile_ca_excluded_urls']['group'], 'Excluded URLs should be saved by their own form.' );

	// 未保存の項目は、登録した初期値を返す.
	foreach ( $options as $option ) {
		delete_option( $option );
	}
	foreach ( $filters as $hook => $callback ) {
		remove_filter( $hook, $callback );
	}
	$had_hostname = get_option( 'profile_ca_server_hostname', $missing );
	$had_log      = get_option( 'profile_ca_log_option', $missing );
	if ( $missing === $had_hostname ) {
		profile_settings_assert( PROFILE_DEFAULT_CA_SERVER_HOSTNAME === get_option( 'profile_ca_server_hostname' ), 'The default CA server hostname should be returned.' );
	}
	if ( $missing === $had_log ) {
		profile_settings_assert( '0' === get_option( 'profile_ca_log_option' ), 'Logging should be disabled by default.' );
	}
	profile_settings_assert( PROFILE_DEFAULT_CA_TARGET_TYPE === get_option( 'profile_ca_target_type' ), 'The default target type should be returned.' );
	profile_settings_assert( PROFILE_DEFAULT_CA_TARGET_CSS_SELECTOR === get_option( 'profile_ca_target_css_selector' ), 'The default CSS selector should be returned.' );
	profile_settings_assert( PROFILE_DEFAULT_CA_TARGET_HTML === get_option( 'profile_ca_target_html' ), 'The default HTML should be returned.' );
	profile_settings_assert( 'embedded' === get_option( 'profile_ca_embedded_or_external' ), 'Embedded should be the default presentation type.' );

	// 設定画面は初期値を表示し、Embedded を選択する.
	$output = profile_settings_render( '\Profile\Admin\profile_ca_target_type_field' );
	profile_settings_assert( str_contains( $output, 'value="' . PROFILE_DEFAULT_CA_TARGET_TYPE . '"' ), 'The settings page should show the default target type.' );
	$output = profile_settings_render( '\Profile\Admin\profile_ca_embedded_or_external_field' );
	profile_settings_assert( 1 === preg_match( '/<input[^>]*value="embedded"[^>]*checked/s', $output ) && 0 === preg_match( '/<input[^>]*value="external"[^>]*checked/s', $output ), 'Embedded should be selected by default.' );

	// 保存した値は、HTML として解釈されない形で設定画面に表示する.
	update_option( 'profile_ca_target_css_selector', 'a[title="x"] > b' );
	update_option( 'profile_ca_target_html', '</textarea><script>alert(1)</script>%CONTENT%' );
	update_option( 'profile_ca_embedded_or_external', 'external' );
	$output = profile_settings_render( '\Profile\Admin\profile_ca_target_css_selector_field' );
	profile_settings_assert( str_contains( $output, 'value="a[title=&quot;x&quot;] &gt; b"' ), 'The saved CSS selector should be escaped in the attribute.' );
	$output = profile_settings_render( '\Profile\Admin\profile_ca_target_html_field' );
	profile_settings_assert( str_contains( $output, '&lt;/textarea&gt;&lt;script&gt;alert(1)&lt;/script&gt;%CONTENT%</textarea>' ) && ! str_contains( $output, '<script>' ), 'The saved HTML should be escaped in the textarea.' );
	$output = profile_settings_render( '\Profile\Admin\profile_ca_embedded_or_external_field' );
	profile_settings_assert( 1 === preg_match( '/<input[^>]*value="external"[^>]*checked/s', $output ) && 0 === preg_match( '/<input[^>]*value="embedded"[^>]*checked/s', $output ), 'The saved presentation type should be selected.' );

	WP_CLI::success( 'Settings checks passed: defaults used for issuance, saved values used for issuance, HTML without placeholders, registration, registered defaults, escaped output, presentation type selection.' );
} finally {
	foreach ( $post_ids as $created_id ) {
		if ( is_int( $created_id ) && $created_id > 0 ) {
			wp_delete_post( $created_id, true );
		}
	}
	foreach ( $previous as $option => $value ) {
		if ( $missing === $value ) {
			delete_option( $option );
		} else {
			update_option( $option, $value );
		}
	}
	foreach ( $filters as $hook => $callback ) {
		remove_filter( $hook, $callback );
	}
	remove_filter( 'pre_http_request', $http_filter, 10 );
	if ( false !== $sign_priority ) {
		add_action( 'transition_post_status', '\Profile\Issue\sign_post', $sign_priority, 3 );
	}
	wp_set_current_user( $previous_user );
}
