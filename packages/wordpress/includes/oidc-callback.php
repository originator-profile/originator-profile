<?php
/** OIDC認証用コールバックページ設定 */

namespace Profile\CasApiOidcCallback;

// OIDC callback page name.
const OIDC_CALLBACK_ENDPOINT = 'oidc-callback';

// OIDC callback page.
const OIDC_CALLBACK_PAGE = 'page-oidc-callback.php';

/**
 * Add rewrite endpoint for the OIDC callback page.
 *
 * @return void
 */
function add_callback_page() {
	\add_rewrite_endpoint( OIDC_CALLBACK_ENDPOINT, EP_ROOT );
}

/**
 * Remove rewrite endpoint for the OIDC callback page.
 *
 * @return void
 */
function remove_callback_page() {
	\add_rewrite_endpoint( OIDC_CALLBACK_ENDPOINT, EP_NONE );
}

/**
 * Activation hook.
 *  add_callback_page() - Add rewrite endpoint for the OIDC callback page.
 * flush_rewrite_rules() - Flush rewrite rules to apply the new endpoint.
 */
function activation() {
	add_callback_page();
	\flush_rewrite_rules();
}

/**
 * Deactivation hook.
 *   remove_callback_page() - Remove rewrite endpoint for the OIDC callback page.
 *   flush_rewrite_rules() - Flush rewrite rules to remove the endpoint.
 */
function deactivation() {
	remove_callback_page();
	\flush_rewrite_rules();
}

/**
 * Initialize OIDC callback page handling.
 *   add_callback_page() - Add rewrite endpoint for the OIDC callback page.
 *   oidc_callback_page() - Handle OIDC callback page requests.
 *
 * @return void
 */
function init() {
	\add_action( 'init', '\Profile\CasApiOidcCallback\add_callback_page' );
	\add_action( 'template_redirect', '\Profile\CasApiOidcCallback\oidc_callback_page' );
}

/**
 * Handle OIDC callback page requests.
 *   Check if the request is for the OIDC callback endpoint, and if so, verify the user's authentication and permissions.
 *   If the user is authenticated and has the necessary permissions, include the OIDC callback page.
 *   Otherwise, display a 404 error page.
 */
function oidc_callback_page() {
	global $wp_query;

	// Check if the current request is for the OIDC callback endpoint.
	if ( isset( $wp_query->query_vars[ OIDC_CALLBACK_ENDPOINT ] ) ) {

		// Check if the user is logged in.
		if ( ! \is_user_logged_in() ) {
			\wp_die( 'Page not found.', '404 Not Found', array( 'response' => 404 ) );
		}

		// Check if the user is an administrator.
		if ( ! \current_user_can( 'manage_options' ) ) {
			\wp_die( 'Page not found.', '404 Not Found', array( 'response' => 404 ) );
		}

		// Check if the admin secret is set.
		$admin_secret = \get_option( 'profile_ca_server_admin_secret', null );
		if ( ! $admin_secret ) {
			\wp_die( 'Page not found.', '404 Not Found', array( 'response' => 404 ) );
		}
		// Check if the authentication type is OIDC.
		$secret_arr = explode( ':', $admin_secret );
		$auth_type  = $secret_arr[0] ?? '';
		if ( 'OIDC' !== $auth_type ) {
			\wp_die( 'Page not found.', '404 Not Found', array( 'response' => 404 ) );
		}

		// OIDC Authentication page.
		include __DIR__ . '/' . OIDC_CALLBACK_PAGE;
		exit;
	}
}
