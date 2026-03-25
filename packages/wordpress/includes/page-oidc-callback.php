<?php
/**
 * CA Server OIDC Authentication Page
 *
 * @package Profile\CasAuth
 */

namespace Profile\CasAuth;

require_once __DIR__ . '/class-casapiauthclient.php';
use Profile\CasApiAuthClient\CasApiAuthClient;

// OIDC Authentication.
$admin_secret = \get_option( 'profile_ca_server_admin_secret', null );
$auth = new CasApiAuthClient( $admin_secret );
// Initialize the OIDC client.
if ( ! $auth->init_oidc( $admin_secret ) ) {
	\wp_die( 'Failed to initialize. Please check the CA Manager plugin settings.' );
}

// Authenticate the user.
// phpcs:ignore WordPress.Security.NonceVerification.Recommended
if ( ! ( $auth->authenticate() && isset( $_REQUEST['code'] ) ) ) {
	\wp_die( 'OIDC API authentication failed' );
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