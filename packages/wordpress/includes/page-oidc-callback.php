<?php
/**
 * CA Server OIDC Authentication Page
 *
 * @package Profile\CasAuth
 */

namespace Profile\CasAuth;

require_once __DIR__ . '/class-casapiauthclient.php';
use Profile\CasApiAuthClient\CasApiAuthClient;

// Exit if accessed directly.
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

// Check if the user is logged in.
if ( ! \is_user_logged_in() ) {
	// Fake 404 error if the user is not logged in.
	\wp_die( 'Page not found.', '404 Not Found', array( 'response' => 404 ) );
}

// Check if the user is an administrator.
if ( ! \current_user_can( 'manage_options' ) ) {
	// Fake 404 error if the user is not an administrator.
	\wp_die( 'Page not found.', '404 Not Found', array( 'response' => 404 ) );
}

// OIDC Authentication.
$admin_secret = \get_option( 'profile_ca_server_admin_secret', null );
$auth         = new CasApiAuthClient();
// Initialize the OIDC client.
if ( ! $auth->init_oidc( $admin_secret ) ) {
	\wp_die( 'Failed to initialize. Please check the CA Manager plugin settings.', 'Authentication Failed', array( 'response' => 403 ) );
}

// Authenticate the user.
// phpcs:ignore WordPress.Security.NonceVerification.Recommended
if ( ! ( $auth->authenticate() && isset( $_REQUEST['code'] ) ) ) {
	\wp_die( 'OIDC API authentication failed', 'Authentication Failed', array( 'response' => 403 ) );
}
?>
<html>
	<head>
		<title>OIDC API Authentication</title>
	</head>
	<body>
		<br>
		<hr>
		<center>
			<h1>OIDC API Authentication</h1>
			<h2>Successfully authenticated.</h2>
		</center>
		<hr>
		<button onclick="window.close();">close</button>
	</body>
</html>