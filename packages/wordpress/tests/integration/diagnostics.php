<?php
/**
 * CA server connection check with intercepted communication.
 *
 * @package Profile
 */

if ( ! defined( 'WP_CLI' ) || ! WP_CLI ) {
	return;
}

// phpcs:disable WordPress.PHP.DiscouragedPHPFunctions.obfuscation_base64_encode, WordPress.WP.AlternativeFunctions.json_encode_json_encode -- Fixtures build dummy credentials and JWTs.

/**
 * Check a diagnostics assertion.
 *
 * @param bool   $condition Condition.
 * @param string $message Failure message.
 * @throws RuntimeException When the condition fails.
 */
function profile_diagnostics_assert( bool $condition, string $message ): void {
	if ( ! $condition ) {
		throw new RuntimeException( esc_html( $message ) );
	}
}

/**
 * Unsigned JWT that has not expired.
 *
 * @param string $subject Subject.
 */
function profile_diagnostics_jwt( string $subject ): string {
	$encode = static fn ( $value ) => rtrim( strtr( base64_encode( json_encode( $value ) ), '+/', '-_' ), '=' );
	return $encode( array( 'alg' => 'RS256' ) ) . '.' . $encode(
		array(
			'sub' => $subject,
			'exp' => time() + 3600,
		)
	) . '.signature';
}

/**
 * Intercepted HTTP response.
 *
 * @param int    $code HTTP status.
 * @param string $body Response body.
 */
function profile_diagnostics_response( int $code, string $body = '' ): array {
	return array(
		'headers'  => array(),
		'body'     => $body,
		'response' => array( 'code' => $code ),
		'cookies'  => array(),
	);
}

$token_options = array( 'profile_ca_server_access_token', 'profile_ca_server_id_token', 'profile_ca_server_refresh_token' );
$original      = array();
foreach ( $token_options as $name ) {
	$original[ $name ] = get_option( $name, null );
	delete_option( $name );
}

$secret         = '';
$id_token       = null;
$id_token_error = false;
$requests       = array();
$responses      = array();
$unexpected     = array();
$filters        = array(
	'pre_option_profile_ca_server_hostname'     => static fn () => 'ca.example.net',
	'pre_option_profile_ca_server_admin_secret' => static function () use ( &$secret ) {
		return $secret;
	},
	'pre_option_profile_ca_server_id_token'     => static function ( $value ) use ( &$id_token, &$id_token_error ) {
		if ( $id_token_error ) {
			throw new RuntimeException( 'Token storage failure.' );
		}
		return null === $id_token ? $value : $id_token;
	},
	// Exceptions here would be swallowed by the auth clients, so unexpected requests are recorded and checked after each run.
	'pre_http_request'                          => static function ( $pre, $args, $url ) use ( &$requests, &$responses, &$unexpected ) {
		$requests[] = array(
			'url'  => $url,
			'args' => $args,
		);
		$next = array_shift( $responses );
		if ( null === $next || $next[0] !== $url ) {
			$unexpected[] = $url;
			return new WP_Error( 'http_request_failed', 'Unexpected HTTP request.' );
		}
		return $next[1];
	},
);
foreach ( $filters as $hook => $callback ) {
	add_filter( $hook, $callback, 10, 3 );
}

$anonymous = profile_diagnostics_response( 401, '{"statusCode":401,"error":"Unauthorized"}' );
$run       = static function ( string $admin_secret, array $mocked ) use ( &$secret, &$requests, &$responses, &$unexpected ) {
	$secret     = $admin_secret;
	$requests   = array();
	$responses  = $mocked;
	$unexpected = array();
	$result     = \Profile\Diagnostics\diagnose();
	profile_diagnostics_assert( empty( $unexpected ), 'Unexpected HTTP request: ' . implode( ', ', $unexpected ) );
	profile_diagnostics_assert( empty( $responses ), 'Expected HTTP requests were not sent.' );
	return $result;
};

try {
	// Valid Basic credentials make the empty CA request fail body validation with 400.
	$result = $run(
		'user:password',
		array(
			array( 'https://ca.example.net/ca', $anonymous ),
			array( 'https://ca.example.net/ca', profile_diagnostics_response( 400, '{"statusCode":400}' ) ),
		)
	);
	profile_diagnostics_assert( 'success' === $result['state'], 'Basic: state should be success.' );
	profile_diagnostics_assert( 2 === count( $requests ), 'Basic: two requests are expected.' );
	profile_diagnostics_assert( 'POST' === $requests[0]['args']['method'] && '{}' === $requests[0]['args']['body'], 'Basic: reachability must send an empty body.' );
	profile_diagnostics_assert( ! isset( $requests[0]['args']['headers']['authorization'] ), 'Basic: reachability must be anonymous.' );
	profile_diagnostics_assert( 'POST' === $requests[1]['args']['method'] && '{}' === $requests[1]['args']['body'], 'Basic: authentication must send an empty body.' );
	profile_diagnostics_assert( 'Basic ' . base64_encode( 'user:password' ) === $requests[1]['args']['headers']['authorization'], 'Basic: authorization header.' );
	profile_diagnostics_assert( 0 === $requests[1]['args']['redirection'], 'Basic: redirects must not be followed.' );

	$result = $run(
		'user:wrong',
		array(
			array( 'https://ca.example.net/ca', $anonymous ),
			array( 'https://ca.example.net/ca', profile_diagnostics_response( 401, '{"statusCode":401}' ) ),
		)
	);
	profile_diagnostics_assert( 'error' === $result['state'] && 'ng' === $result['stages']['authentication']['status'], 'Basic: 401 should be ng.' );

	// Authentication is skipped when the server is unreachable.
	$result = $run(
		'user:password',
		array( array( 'https://ca.example.net/ca', new WP_Error( 'http_request_failed', 'Could not resolve host' ) ) )
	);
	profile_diagnostics_assert( 'ng' === $result['stages']['reachability']['status'], 'Unreachable: reachability should be ng.' );
	profile_diagnostics_assert( 'unverified' === $result['stages']['authentication']['status'] && 1 === count( $requests ), 'Unreachable: authentication should be skipped.' );

	// A server that validates the body before authentication cannot tell whether credentials are valid.
	$result = $run(
		'user:wrong',
		array(
			array( 'https://ca.example.net/ca', profile_diagnostics_response( 400, '{"statusCode":400}' ) ),
			array( 'https://ca.example.net/ca', profile_diagnostics_response( 400, '{"statusCode":400}' ) ),
		)
	);
	profile_diagnostics_assert( 'ok' === $result['stages']['reachability']['status'], 'Body first: reachability should be ok.' );
	profile_diagnostics_assert( 'unverified' === $result['stages']['authentication']['status'], 'Body first: authentication should be unverified.' );

	// Credentials are not sent to a host that is not judged to be a CA server.
	$result = $run( 'user:password', array( array( 'https://ca.example.net/ca', profile_diagnostics_response( 200, '<html></html>' ) ) ) );
	profile_diagnostics_assert( 'ng' === $result['stages']['reachability']['status'], 'Not a CA server: reachability should be ng.' );
	profile_diagnostics_assert( 'unverified' === $result['stages']['authentication']['status'] && 1 === count( $requests ), 'Not a CA server: credentials must not be sent.' );

	// Authentication is skipped without credentials.
	$result = $run( '', array( array( 'https://ca.example.net/ca', $anonymous ) ) );
	profile_diagnostics_assert( 'warning' === $result['state'] && 1 === count( $requests ), 'Empty secret: authentication should be skipped.' );

	// CCSP requests a token and sends it as a bearer token.
	$ccsp_secret  = 'CCSP:' . base64_encode(
		json_encode(
			array(
				'authType'  => 'client_secret_post',
				'clientId'  => 'client',
				'clientSec' => 'secret',
				'tokenUrl'  => 'https://idp.example.net/token',
			)
		)
	);
	$access_token = profile_diagnostics_jwt( 'ccsp' );
	$result       = $run(
		$ccsp_secret,
		array(
			array( 'https://ca.example.net/ca', $anonymous ),
			array( 'https://idp.example.net/token', profile_diagnostics_response( 200, json_encode( array( 'access_token' => $access_token ) ) ) ),
			array( 'https://ca.example.net/ca', profile_diagnostics_response( 400 ) ),
		)
	);
	profile_diagnostics_assert( 'success' === $result['state'], 'CCSP: state should be success.' );
	profile_diagnostics_assert( 'https://idp.example.net/token' === $requests[1]['url'], 'CCSP: token must be requested.' );
	profile_diagnostics_assert( 'Bearer ' . $access_token === $requests[2]['args']['headers']['authorization'], 'CCSP: bearer header.' );
	profile_diagnostics_assert( get_option( 'profile_ca_server_access_token' ) === $access_token, 'CCSP: token should be stored like normal issuance.' );

	$result = $run(
		$ccsp_secret,
		array(
			array( 'https://ca.example.net/ca', $anonymous ),
			array( 'https://idp.example.net/token', profile_diagnostics_response( 401 ) ),
		)
	);
	profile_diagnostics_assert( 'ng' === $result['stages']['authentication']['status'] && 2 === count( $requests ), 'CCSP: token failure should be ng without CA request.' );

	// An opaque (non-JWT) CCSP token is requested once and sent as is.
	$result = $run(
		$ccsp_secret,
		array(
			array( 'https://ca.example.net/ca', $anonymous ),
			array( 'https://idp.example.net/token', profile_diagnostics_response( 200, json_encode( array( 'access_token' => 'opaque-token' ) ) ) ),
			array( 'https://ca.example.net/ca', profile_diagnostics_response( 400 ) ),
		)
	);
	profile_diagnostics_assert( 'success' === $result['state'], 'CCSP opaque token: state should be success.' );
	profile_diagnostics_assert( 'Bearer opaque-token' === $requests[2]['args']['headers']['authorization'], 'CCSP opaque token: bearer header.' );

	// OIDC uses the stored ID token while it has not expired.
	$id_token    = profile_diagnostics_jwt( 'oidc' );
	$oidc_secret = 'OIDC:' . base64_encode(
		json_encode(
			array(
				'providerUrl'  => 'https://idp.example.net',
				'provider'     => 'https://idp.example.net',
				'authorizeUrl' => 'https://idp.example.net/authorize',
				'tokenUrl'     => 'https://idp.example.net/token',
				'redirectUrl'  => 'https://wp.example.net/oidc-callback',
				'clientId'     => 'client',
				'clientSec'    => 'secret',
				'jwksUri'      => 'https://idp.example.net/jwks',
			)
		)
	);
	$result      = $run(
		$oidc_secret,
		array(
			array( 'https://ca.example.net/ca', $anonymous ),
			array( 'https://ca.example.net/ca', profile_diagnostics_response( 401 ) ),
		)
	);
	profile_diagnostics_assert( 'Bearer ' . $id_token === $requests[1]['args']['headers']['authorization'], 'OIDC: bearer header.' );
	profile_diagnostics_assert( 'ng' === $result['stages']['authentication']['status'], 'OIDC: rejected token should be ng.' );

	// Exceptions from the auth clients are reported as ng without sending credentials.
	$id_token_error = true;
	$result         = $run( $oidc_secret, array( array( 'https://ca.example.net/ca', $anonymous ) ) );
	$id_token_error = false;
	profile_diagnostics_assert( 'ng' === $result['stages']['authentication']['status'] && 1 === count( $requests ), 'OIDC exception: authentication should be ng.' );

	WP_CLI::success( 'Diagnostics checks passed: Basic, body-first server, non-CA host, CCSP (JWT and opaque token), OIDC, exceptions, unreachable server, empty secret.' );
} finally {
	foreach ( $filters as $hook => $callback ) {
		remove_filter( $hook, $callback, 10 );
	}
	foreach ( $original as $name => $value ) {
		if ( null === $value ) {
			delete_option( $name );
		} else {
			update_option( $name, $value );
		}
	}
}
