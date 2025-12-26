<?php
/** CA-Server Authentication Class */

namespace Profile\CasApiAuthClient;

require_once __DIR__ . '/debug.php';
use function Profile\Debug\debug;

// composer require jumbojett/openid-connect-php
use Jumbojett\OpenIDConnectClient;

const CA_SERVER_ID_TOKEN      = 'profile_ca_server_id_token';
const CA_SERVER_REFRESH_TOKEN = 'profile_ca_server_refresh_token';

/**
 * Class CasApiAuthClient
 *
 * This class extends OpenIDConnectClient to handle OIDC authentication for the CA Server.
 * It initializes the client with the provided secret, stores tokens, and handles token refresh.
 */
final class CasApiAuthClient extends OpenIDConnectClient {

	/**
	 * Time leeway for token validation
	 *
	 * @var int leeway (seconds)
	 */
	private $leeway = 300;

	/**
	 * Initialize the OIDC client with the provided secret
	 *
	 * @param string $secret The secret containing OIDC configuration
	 * @return bool True if initialization is successful, false otherwise
	 */
	public function init_oidc( $secret ): bool {
		if ( null === $secret ) {
			debug( 'No secret provided for OIDC initialization' );
			return false;
		}
		// Extract the secret parts
		$secret_arr = explode( ':', $secret );
		// Decode the secret
		// phpcs:ignore WordPress.PHP.DiscouragedPHPFunctions.obfuscation_base64_decode
		$sec = \base64_decode( $secret_arr[1], true );
		if ( false === $sec ) {
			debug( 'Failed to decode base64 secret(OIDC)' );
			return false;
		}
		$s_ar = \json_decode( $sec, true );
		if ( null === $s_ar ) {
			debug( 'Failed to decode json secret(OIDC)' );
			return false;
		} elseif ( ! array_key_exists( 'providerUrl', $s_ar )
				|| ! array_key_exists( 'provider', $s_ar )
				|| ! array_key_exists( 'authorizeUrl', $s_ar )
				|| ! array_key_exists( 'tokenUrl', $s_ar )
				|| ! array_key_exists( 'redirectUrl', $s_ar )
				|| ! array_key_exists( 'clientId', $s_ar )
				|| ! array_key_exists( 'clientSec', $s_ar )
				|| ! array_key_exists( 'jwksUri', $s_ar ) ) {
			debug( 'Invalid secret format(OIDC)' );
			return false;
		}

		// Initialize the OIDC client
		$this->setProviderURL( $s_ar['providerUrl'] );
		$this->setIssuer( $s_ar['provider'] );    // id_token issuer
		$this->setClientID( $s_ar['clientId'] );
		$this->setClientSecret( $s_ar['clientSec'] );
		$this->providerConfigParam(
			array(
				'authorization_endpoint'                => $s_ar['authorizeUrl'],
				'token_endpoint'                        => $s_ar['tokenUrl'],
				'jwks_uri'                              => $s_ar['jwksUri'],
				'token_endpoint_auth_methods_supported' => array( 'client_secret_post' ),
			)
		);
		$this->setRedirectURL( $s_ar['redirectUrl'] );
		$this->setCodeChallengeMethod( 'S256' ); // Use PKCE with S256

		return true;
	}

	/**
	 * Store the id_token in WordPress options
	 *
	 * @param string|null $id_token The ID token to store.
	 * @return void
	 */
	private function storeIdToken( $id_token ) {
		// Store it in the WordPress options
		\update_option( CA_SERVER_ID_TOKEN, $id_token );
	}

	/**
	 * Store the refresh token in WordPress options
	 *
	 * @param string|null $refresh_token The refresh token to store.
	 * @return void
	 */
	private function storeRefreshToken( $refresh_token ) {
		// Store it in the WordPress options
		\update_option( CA_SERVER_REFRESH_TOKEN, $refresh_token );
	}

	/**
	 * Get the stored id_token from WordPress options
	 *
	 * @return string|null The stored id_token or null if not set
	 */
	private function getStoredIdToken() {
		return \get_option( CA_SERVER_ID_TOKEN, null );
	}

	/**
	 * Get the stored refresh token from WordPress options
	 *
	 * @return string|null The stored refresh_token or null if not set
	 */
	private function getStoredRefreshToken() {
		return \get_option( CA_SERVER_REFRESH_TOKEN, null );
	}

	/**
	 * Store tokens after successful authentication
	 *
	 * @return void
	 */
	private function storeTokens() {
		// Store the id_token and refresh_token in WordPress options
		$id_token = $this->getIdToken();
		if ( $id_token ) {
			$this->storeIdToken( $id_token );
		} else {
			debug( 'No id_token received(OIDC)' );
		}
		$refresh_token = $this->getRefreshToken();
		if ( $refresh_token ) {
			$this->storeRefreshToken( $refresh_token );
		} else {
			debug( 'No refresh_token received(OIDC)' );
		}
	}

	/**
	 * Verify JWT claims
	 *
	 * @param object      $claims The JWT claims to verify.
	 * @param string|null $access_token The access token (optional).
	 * @return bool True if the claims are valid, false otherwise
	 */
	protected function verifyJWTClaims( $claims, ?string $access_token = null ): bool {
		// Verify that sub is set
		if ( ! isset( $claims->sub ) ) {
			debug( 'JWT claims verification failed: sub claim is missing(OIDC)' );
			return false;
		}

		if ( isset( $claims->at_hash, $access_token ) ) {
			if ( isset( $this->getIdTokenHeader()->alg ) && $this->getIdTokenHeader()->alg !== 'none' ) {
				$bit = substr( $this->getIdTokenHeader()->alg, 2, 3 );
			} else {
				// TODO: Error case. throw exception???
				$bit = '256';
			}
			$len              = ( (int) $bit ) / 16;
			$expected_at_hash = $this->urlEncode( substr( hash( 'sha' . $bit, $access_token, true ), 0, $len ) );
		}
		$auds = $claims->aud;
		$auds = is_array( $auds ) ? $auds : array( $auds );

		if ( isset( $claims->firebase ) ) {
			// Override the JWT claims verification for firebase authentication.
			debug( 'Firebase authentication detected, using custom claims verification(OIDC)' );
			return ( ( $this->validateIssuer( $claims->iss ) )
				&& ( $claims->sub === $this->getIdTokenPayload()->sub )
				&& ( ! isset( $claims->exp ) || ( ( is_int( $claims->exp ) ) && ( $claims->exp >= time() - $this->leeway ) ) )
				&& ( ! isset( $claims->nbf ) || ( ( is_int( $claims->nbf ) ) && ( $claims->nbf <= time() + $this->leeway ) ) )
			);
		} else {
			debug( 'Standard OIDC authentication detected, using original claims verification' );
			$client_id = $this->getClientID();
			// Original the JWT claims verification
			return ( ( $this->validateIssuer( $claims->iss ) )
				&& ( in_array( $client_id, $auds, true ) )
				&& ( $claims->sub === $this->getIdTokenPayload()->sub )
				&& ( ! isset( $claims->nonce ) || $claims->nonce === $this->getNonce() )
				&& ( ! isset( $claims->exp ) || ( ( is_int( $claims->exp ) ) && ( $claims->exp >= time() - $this->leeway ) ) )
				&& ( ! isset( $claims->nbf ) || ( ( is_int( $claims->nbf ) ) && ( $claims->nbf <= time() + $this->leeway ) ) )
				&& ( ! isset( $claims->at_hash ) || ! isset( $access_token ) || $claims->at_hash === $expected_at_hash )
			);
		}
	}

	/**
	 * Authenticate the user using OIDC
	 *
	 * @return bool True if authentication is successful, false otherwise
	 */
	public function authenticate(): bool {
		try {
			$result = parent::authenticate();
			// phpcs:ignore WordPress.Security.NonceVerification.Recommended
			if ( $result && isset( $_REQUEST['code'] ) ) {
				// Store the id_token and refresh_token after successful authentication
				$this->storeTokens();
				$msg = 'API authentication successful(OIDC)';
				debug( $msg );
				return true;
			} else {
				debug( 'Authentication result did not include authorization code(OIDC)' );
			}
		} catch ( \Exception $e ) {
			$err = $e->getMessage();
			$msg = 'API authentication failed(OIDC): ' . $err;
			debug( $msg );
			return false;
		}
		return $result;
	}

	/**
	 * Check if the id_token is expired
	 *
	 * @param string $id_token The id_token to check
	 * @return bool True if the token is expired, false otherwise
	 */
	private function expiredToken( $id_token ) {
		// Decode the JWT id_token to check expiration
		$parts = explode( '.', $id_token );
		if ( count( $parts ) !== 3 ) {
			debug( 'Invalid id_token format(OIDC)' );
			return true; // Treat as expired if invalid
		}
		// phpcs:ignore WordPress.PHP.DiscouragedPHPFunctions.obfuscation_base64_decode
		$payload = \base64_decode( strtr( $parts[1], '-_', '+/' ) );
		if ( false === $payload ) {
			debug( 'Failed to decode id_token payload(OIDC)' );
			return true;
		}
		$data = \json_decode( $payload, true );
		if ( ! isset( $data['exp'] ) ) {
			debug( 'No exp field in id_token(OIDC)' );
			return true;
		}
		// If the token is expired or will expire within allowed seconds
		$now = \time();
		if ( $data['exp'] < $now + $this->leeway ) { // Allow buffer time
			debug( 'id_token has expired(OIDC)' );
			return true;
		}
		return false;
	}

	/**
	 * Refresh the id_token using the refresh token
	 *
	 * @return bool True if the token was refreshed successfully, false otherwise
	 */
	private function refreshIdToken() {
		// Get the current refresh_token
		$refresh_token = $this->getStoredRefreshToken();
		if ( null === $refresh_token ) {
			debug( 'No refreshToken available(OIDC). Please authenticate again!!!' );
			return false;
		}
		// Refresh the id_token using the refresh token
		$json = $this->refreshToken( $refresh_token );
		if ( isset( $json->id_token ) ) {
			debug( 'Id token refreshed successfully(OIDC)' );
			// Store the new id_token
			$this->storeIdToken( $json->id_token );
			// Also store the new refresh_token
			if ( isset( $json->refresh_token ) ) {
				$this->storeRefreshToken( $json->refresh_token );
			} else {
				// If no new refresh token is provided, keep the old one
				debug( 'No new refresh token provided, keeping the old one(OIDC)' );
			}
		} else {
			debug( 'Failed to refresh id token(OIDC)' );
			return false;
		}
		return true; // Token is refreshed successfully
	}

	/**
	 * Get the API token (id_token) and refresh it if necessary
	 *
	 * @return string|null The id_token if available, null if not
	 */
	public function getApiToken() {
		$id_token = $this->getStoredIdToken();
		if ( null === $id_token || $this->expiredToken( $id_token ) ) {
			debug( 'Id token is not available, refreshing(OIDC)...' );
			if ( $this->refreshIdToken() ) {
				// Get the refreshed id_token
				$id_token = $this->getStoredIdToken();
			} else {
				// Failed refresh, set id_token to null
				$id_token = null;
			}
		}
		return $id_token;
	}
}

/**
 * Class CA-Server Authentication for Client (client secret post)
 *
 * This class handle authentication for the CA Server.
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
	 * ID Token
	 *
	 * @var string | null
	 */
	private $idToken = null;

	/**
	 * Client ID
	 *
	 * @var string
	 */
	private $clientID;

	/**
	 * Client Secret
	 *
	 * @var string
	 */
	private $clientSecret;

	/**
	 * Token URL
	 *
	 * @var string
	 */
	private $tokenUrl;

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
		$this->clientID     = $s_ar['clientId'];
		$this->clientSecret = $s_ar['clientSec'];
		$this->tokenUrl     = $s_ar['tokenUrl'];

		return true;
	}

	/**
	 * Store the id_token in WordPress options
	 *
	 * @param string|null $id_token The ID token to store.
	 * @return void
	 */
	private function storeIdToken( $idToken ) {
		// Store it in the WordPress options
		\update_option( CA_SERVER_ID_TOKEN, $idToken );
		// No refresh token in CCSP
		\update_option( CA_SERVER_REFRESH_TOKEN, null );
	}

	/**
	 * Get the stored id_token from WordPress options
	 *
	 * @return string|null The stored id_token or null if not set
	 */
	private function getStoredIdToken() {
		return \get_option( CA_SERVER_ID_TOKEN, null );
	}

	/**
	 * Store tokens after successful authentication
	 *
	 * @return void
	 */
	private function storeTokens( $idToken ) {
		$this->idToken = $idToken;
		// Store the idToken in WordPress options
		if ( $this->idToken ) {
			$this->storeIdToken( $this->idToken );
		} else {
			debug( 'No idToken received(CCSP)' );
		}
	}

	protected function requestToken() {
		// Prepare token request
		$tokenEndpoint = $this->tokenUrl;
		$tokenParams = [
			'grant_type'    => 'client_credentials',
			'client_id'     => $this->clientID,
			'client_secret' => $this->clientSecret,
		];

		// Convert parameters to URL-encoded query string
		$postData = http_build_query( $tokenParams, '', '&' );
		$args = array(
			'method'  => 'POST',
			'headers' => array(
				'content-type' => 'application/x-www-form-urlencoded',
			),
			'body'    => $postData,
		);

		$res = \wp_remote_request( $tokenEndpoint, $args );

		if ( \is_wp_error( $res ) ) {
			$error_message = $res->get_error_message();
			debug( 'Failed to request error(CCSP): ' . $error_message );
			return null;
		}

		if ( 200 !== $res['response']['code'] ) {
			debug( 'requestToken() HTTP error(CCSP): ' . $res['response']['code'] );
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
			$result = $this->requestToken();
			if ( $result && isset( $result['access_token'] ) ) {
				// Store the id_token after successful authentication
				$this->storeTokens($result['access_token']);
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
	 * Check if the idToken is expired
	 *
	 * @param string $idToken The idToken to check
	 * @return bool True if the token is expired, false otherwise
	 */
	private function expiredToken( $idToken ) {
		// Decode the JWT idToken to check expiration
		$parts = explode( '.', $idToken );
		if ( count( $parts ) !== 3 ) {
			debug( 'Invalid idToken format(CCSP)' );
			return true; // Treat as expired if invalid
		}
		$payload = \base64_decode( strtr( $parts[1], '-_', '+/' ) );
		if ( false === $payload ) {
			debug( 'Failed to decode idToken payload(CCSP)' );
			return true;
		}
		$data = \json_decode( $payload, true );
		if ( ! isset( $data['exp'] ) ) {
			debug( 'No exp field in idToken(CCSP)' );
			return true;
		}
		// If the token is expired or will expire within allowed seconds
		$now = \time();
		if ( $data['exp'] < $now + $this->leeway ) { // Allow buffer time
			debug( 'id_token has expired(CCSP)' );
			return true;
		}
		return false;
	}

	/**
	 * Get the API token (idToken) and refresh it if necessary
	 *
	 * @return string|null The idToken if available, null if not
	 */
	public function getApiToken() {
		$this->idToken = $this->getStoredIdToken();
		if ( null === $this->idToken || $this->expiredToken( $this->idToken ) ) {
			debug( 'Id token is not available, refreshing(CCSP)...' );
			if ( $this->authenticate() ) {
				// Get the idToken
				$this->getStoredIdToken();
			} else {
				// Failed refresh, set id_token to null
				$this->idToken = null;
			}
		}
		return $this->idToken;
	}
}
