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
		// Validate secret format
		if ( ! isset( $secret_arr[1] ) || '' === $secret_arr[1] ) {
			debug( 'Invalid secret format(OIDC): missing encoded part' );
			return false;
		}
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
	private function store_id_token( $id_token ) {
		// Store it in the WordPress options
		\update_option( CA_SERVER_ID_TOKEN, $id_token );
	}

	/**
	 * Store the refresh token in WordPress options
	 *
	 * @param string|null $refresh_token The refresh token to store.
	 * @return void
	 */
	private function store_refresh_token( $refresh_token ) {
		// Store it in the WordPress options
		\update_option( CA_SERVER_REFRESH_TOKEN, $refresh_token );
	}

	/**
	 * Get the stored id_token from WordPress options
	 *
	 * @return string|null The stored id_token or null if not set
	 */
	private function get_stored_id_token() {
		return \get_option( CA_SERVER_ID_TOKEN, null );
	}

	/**
	 * Get the stored refresh token from WordPress options
	 *
	 * @return string|null The stored refresh_token or null if not set
	 */
	private function get_stored_refresh_token() {
		return \get_option( CA_SERVER_REFRESH_TOKEN, null );
	}

	/**
	 * Store tokens after successful authentication
	 *
	 * @return void
	 */
	private function store_tokens() {
		// Store the id_token and refresh_token in WordPress options
		$id_token = $this->getIdToken();
		if ( $id_token ) {
			$this->store_id_token( $id_token );
		} else {
			debug( 'No id_token received(OIDC)' );
		}
		$refresh_token = $this->getRefreshToken();
		if ( $refresh_token ) {
			$this->store_refresh_token( $refresh_token );
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
				$this->store_tokens();
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
	private function expired_token( $id_token ) {
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
	private function refresh_id_token() {
		// Get the current refresh_token
		$refresh_token = $this->get_stored_refresh_token();
		if ( null === $refresh_token ) {
			debug( 'No refreshToken available(OIDC). Please authenticate again!!!' );
			return false;
		}
		// Refresh the id_token using the refresh token
		$json = $this->refreshToken( $refresh_token );
		if ( isset( $json->id_token ) ) {
			debug( 'Id token refreshed successfully(OIDC)' );
			// Store the new id_token
			$this->store_id_token( $json->id_token );
			// Also store the new refresh_token
			if ( isset( $json->refresh_token ) ) {
				$this->store_refresh_token( $json->refresh_token );
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
	public function get_api_token() {
		$id_token = $this->get_stored_id_token();
		if ( null === $id_token || $this->expired_token( $id_token ) ) {
			debug( 'Id token is not available, refreshing(OIDC)...' );
			if ( $this->refresh_id_token() ) {
				// Get the refreshed id_token
				$id_token = $this->get_stored_id_token();
			} else {
				// Failed refresh, set id_token to null
				$id_token = null;
			}
		}
		return $id_token;
	}
}
