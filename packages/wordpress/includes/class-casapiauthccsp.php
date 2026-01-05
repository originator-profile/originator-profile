<?php
/** CA-Server Authentication for Client Credentials with Secret Post (CCSP) */

namespace Profile\CasApiAuthClient;

require_once __DIR__ . '/debug.php';
use function Profile\Debug\debug;

const CA_SERVER_ACCESS_TOKEN = 'profile_ca_server_access_token';

/**
 * Class CA-Server Authentication for Client (client secret post)
 *
 * This class handles authentication for the CA Server.
 * It initializes the client with the client_id, client_secret, and handles token refresh.
 */
final class CasApiAuthCCSP {

	/**
	 * Time leeway for token validation
	 *
	 * @var int leeway (seconds)
	 */
	private $leeway = 300;

	/**
	 * Access Token
	 *
	 * @var string|null
	 */
	private $access_token = null;

	/**
	 * Client ID
	 *
	 * @var string
	 */
	private $client_id;

	/**
	 * Client Secret
	 *
	 * @var string
	 */
	private $client_secret;

	/**
	 * Token URL
	 *
	 * @var string
	 */
	private $token_url;

	/**
	 * Initialize class with the provided secret
	 *
	 * @param string $secret The secret containing CCSP configuration
	 * @return bool True if initialization is successful, false otherwise
	 */
	public function init_ccsp( $secret ): bool {
		if ( null === $secret ) {
			debug( 'No secret provided for CCSP initialization' );
			return false;
		}
		// Extract the secret parts
		$secret_arr = explode( ':', $secret );
		// Validate secret format
		if ( ! isset( $secret_arr[1] ) || '' === $secret_arr[1] ) {
			debug( 'Invalid secret format(CCSP): missing encoded part' );
			return false;
		}
		// Decode the secret
		// phpcs:ignore WordPress.PHP.DiscouragedPHPFunctions.obfuscation_base64_decode
		$sec = \base64_decode( $secret_arr[1], true );
		if ( false === $sec ) {
			debug( 'Failed to decode base64 secret(CCSP)' );
			return false;
		}
		$s_ar = \json_decode( $sec, true );
		if ( null === $s_ar ) {
			debug( 'Failed to decode json secret(CCSP)' );
			return false;
		} elseif ( ! array_key_exists( 'authType', $s_ar )
				|| ! array_key_exists( 'clientId', $s_ar )
				|| ! array_key_exists( 'clientSec', $s_ar )
				|| ! array_key_exists( 'tokenUrl', $s_ar ) ) {
			debug( 'Invalid secret format(CCSP)' );
			return false;
		}

		// Initialize the class
		$this->client_id     = $s_ar['clientId'];
		$this->client_secret = $s_ar['clientSec'];
		$this->token_url     = $s_ar['tokenUrl'];

		return true;
	}

	/**
	 * Store the access_token in WordPress options
	 *
	 * @param string|null $access_token The access token to store.
	 * @return void
	 */
	private function store_access_token( $access_token ) {
		// Store it in the WordPress options
		\update_option( CA_SERVER_ACCESS_TOKEN, $access_token );
	}

	/**
	 * Get the stored access_token from WordPress options
	 *
	 * @return string|null The stored access_token or null if not set
	 */
	private function get_stored_access_token() {
		return \get_option( CA_SERVER_ACCESS_TOKEN, null );
	}

	/**
	 * Store tokens after successful authentication
	 *
	 * @param string|null $access_token The access token to store.
	 * @return void
	 */
	private function store_tokens( $access_token ) {
		$this->access_token = $access_token;
		// Store the access_token in WordPress options
		if ( $this->access_token ) {
			$this->store_access_token( $this->access_token );
		} else {
			debug( 'No access_token received(CCSP)' );
		}
	}

	/**
	 * Request token from the token endpoint
	 *
	 * @return array|null The token response or null if failed
	 */
	protected function request_token() {
		// Prepare token request
		$token_endpoint = $this->token_url;
		$token_params   = array(
			'grant_type'    => 'client_credentials',
			'client_id'     => $this->client_id,
			'client_secret' => $this->client_secret,
		);

		// Convert parameters to URL-encoded query string
		$post_data = http_build_query( $token_params, '', '&' );
		$args      = array(
			'method'  => 'POST',
			'headers' => array(
				'content-type' => 'application/x-www-form-urlencoded',
			),
			'body'    => $post_data,
		);

		$res = \wp_remote_request( $token_endpoint, $args );

		if ( \is_wp_error( $res ) ) {
			$error_message = $res->get_error_message();
			debug( 'Failed to request(CCSP): ' . $error_message );
			return null;
		}

		if ( 200 !== $res['response']['code'] ) {
			debug( 'request_token() HTTP error(CCSP): ' . $res['response']['code'] );
			return null;
		}

		return \json_decode( $res['body'], true );
	}

	/**
	 * Authenticate the user using CCSP
	 *
	 * @return bool True if authentication is successful, false otherwise
	 */
	public function authenticate(): bool {
		try {
			$result = $this->request_token();
			if ( $result && isset( $result['access_token'] ) ) {
				// Store the access_token after successful authentication
				$this->store_tokens( $result['access_token'] );
				$msg = 'API token received successfully(CCSP)';
				debug( $msg );
				return true;
			}
		} catch ( \Exception $e ) {
			$err = $e->getMessage();
			$msg = 'API token request failed(CCSP): ' . $err;
			debug( $msg );
			return false;
		}
		return false;
	}

	/**
	 * Check if the access_token is expired
	 *
	 * @param string $access_token The access_token to check
	 * @return bool True if the token is expired, false otherwise
	 */
	private function expired_token( $access_token ) {
		// Decode the JWT access_token to check expiration
		$parts = explode( '.', $access_token );
		if ( count( $parts ) !== 3 ) {
			debug( 'Invalid access_token format(CCSP)' );
			return true; // Treat as expired if invalid
		}
		// phpcs:ignore WordPress.PHP.DiscouragedPHPFunctions.obfuscation_base64_decode
		$payload = \base64_decode( strtr( $parts[1], '-_', '+/' ) );
		if ( false === $payload ) {
			debug( 'Failed to decode access_token payload(CCSP)' );
			return true;
		}
		$data = \json_decode( $payload, true );
		if ( ! isset( $data['exp'] ) ) {
			debug( 'No exp field in access_token(CCSP)' );
			return true;
		}
		// If the token is expired or will expire within allowed seconds
		$now = \time();
		if ( $data['exp'] < $now + $this->leeway ) { // Allow buffer time
			debug( 'access_token has expired(CCSP)' );
			return true;
		}
		return false;
	}

	/**
	 * Get the API token (access_token) and refresh it if necessary
	 *
	 * @return string|null The access_token if available, null if not
	 */
	public function get_api_token() {
		$this->access_token = $this->get_stored_access_token();
		if ( null === $this->access_token || $this->expired_token( $this->access_token ) ) {
			debug( 'Access token is not available, refreshing(CCSP)...' );
			if ( $this->authenticate() ) {
				// Get the access_token
				$this->access_token = $this->get_stored_access_token();
			} else {
				// Failed refresh, set access_token to null
				$this->access_token = null;
			}
		}
		return $this->access_token;
	}
}
