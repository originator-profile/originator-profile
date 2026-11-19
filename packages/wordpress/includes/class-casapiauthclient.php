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
	 * Firebase Secure Token の ID トークンで aud に入るプロジェクト ID
	 *
	 * @var string|null
	 */
	private $firebase_project_id = null;

	/**
	 * Firebase Secure Token の ID トークンで aud に入るプロジェクト ID を求める
	 *
	 * 認証設定に firebaseProjectId があればそれを使う。無ければ provider が Firebase Secure Token の issuer
	 * (https://securetoken.google.com/<projectId>) と完全に同じ形式の場合に限り、パス末尾をプロジェクト ID とする。
	 * Firebase 以外のプロバイダーで余計な audience を許可しないよう、大文字小文字や末尾の / も含めて厳密に判定する。
	 *
	 * @see https://firebase.google.com/docs/auth/admin/verify-id-tokens
	 *
	 * @param array $config 認証設定
	 * @return ?string プロジェクト ID。Firebase 以外のプロバイダーの場合は null
	 */
	public static function resolve_firebase_project_id( array $config ): ?string {
		if ( isset( $config['firebaseProjectId'] ) && \is_string( $config['firebaseProjectId'] ) && '' !== $config['firebaseProjectId'] ) {
			return $config['firebaseProjectId'];
		}

		if ( isset( $config['provider'] ) && \is_string( $config['provider'] )
			&& \preg_match( '#^https://securetoken\.google\.com/([^/?\#]+)$#', $config['provider'], $matches ) ) {
			return $matches[1];
		}

		return null;
	}

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
		$this->firebase_project_id = self::resolve_firebase_project_id( $s_ar );
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
	 * Firebase Secure Token の ID トークンも含め、すべてのトークンで aud・exp・nonce・at_hash を検証する。
	 * Firebase の ID トークンは aud がクライアント ID ではなくプロジェクト ID になるため、
	 * 認証設定から Firebase のプロジェクト ID が求まる場合はプロジェクト ID を、それ以外はクライアント ID を aud の期待値とする。
	 *
	 * @see https://openid.net/specs/openid-connect-core-1_0.html#IDTokenValidation
	 * @see https://firebase.google.com/docs/auth/admin/verify-id-tokens
	 *
	 * @param object      $claims The JWT claims to verify.
	 * @param string|null $access_token The access token (optional).
	 * @return bool True if the claims are valid, false otherwise
	 */
	protected function verifyJWTClaims( $claims, ?string $access_token = null ): bool {
		if ( ! \is_object( $claims ) ) {
			debug( 'JWT claims verification failed: claims are not an object(OIDC)' );
			return false;
		}

		if ( ! isset( $claims->sub ) ) {
			debug( 'JWT claims verification failed: sub claim is missing(OIDC)' );
			return false;
		}

		if ( ! isset( $claims->iss ) || ! \is_string( $claims->iss ) || ! $this->validateIssuer( $claims->iss ) ) {
			debug( 'JWT claims verification failed: iss claim does not match the provider(OIDC)' );
			return false;
		}

		if ( ! $this->verify_audience( $claims->aud ?? null ) ) {
			debug( 'JWT claims verification failed: aud claim does not contain the expected audience(OIDC)' );
			return false;
		}

		$payload = $this->getIdTokenPayload();
		if ( ! isset( $payload->sub ) || $claims->sub !== $payload->sub ) {
			debug( 'JWT claims verification failed: sub claim does not match the id_token(OIDC)' );
			return false;
		}

		if ( isset( $claims->nonce ) && $claims->nonce !== $this->getNonce() ) {
			debug( 'JWT claims verification failed: nonce claim does not match the authorization request(OIDC)' );
			return false;
		}

		if ( ! isset( $claims->exp ) || ! \is_int( $claims->exp ) ) {
			debug( 'JWT claims verification failed: exp claim is missing or invalid(OIDC)' );
			return false;
		}

		// 時計のずれを考慮して leeway 秒の猶予を設ける
		if ( $claims->exp <= \time() - $this->leeway ) {
			debug( 'JWT claims verification failed: token has expired(OIDC)' );
			return false;
		}

		if ( isset( $claims->nbf ) && ( ! \is_int( $claims->nbf ) || $claims->nbf > \time() + $this->leeway ) ) {
			debug( 'JWT claims verification failed: token is not valid yet(OIDC)' );
			return false;
		}

		if ( isset( $claims->at_hash, $access_token ) ) {
			$expected_at_hash = $this->expected_at_hash( $access_token );
			if ( null === $expected_at_hash || ! \is_string( $claims->at_hash ) || ! \hash_equals( $expected_at_hash, $claims->at_hash ) ) {
				debug( 'JWT claims verification failed: at_hash claim does not match the access token(OIDC)' );
				return false;
			}
		}

		return true;
	}

	/**
	 * Audience (aud クレーム) の検証
	 *
	 * 文字列または配列の aud が期待値を含む場合に有効とする。期待値は次のとおり。
	 * - 認証設定から Firebase のプロジェクト ID が求まる場合: そのプロジェクト ID (Firebase の ID トークンの検証規則)
	 * - それ以外: クライアント ID (OpenID Connect Core 1.0 の ID トークンの検証規則)
	 *
	 * @param mixed $aud aud クレーム
	 * @return bool 有効な場合は true
	 */
	private function verify_audience( mixed $aud ): bool {
		$expected = $this->firebase_project_id ?? $this->getClientID();
		if ( ! \is_string( $expected ) || '' === $expected ) {
			return false;
		}

		$auds = \is_array( $aud ) ? $aud : array( $aud );

		return \in_array( $expected, $auds, true );
	}

	/**
	 * ID トークンの at_hash クレームの期待値
	 *
	 * ID トークンの署名アルゴリズムのハッシュ関数でアクセストークンをハッシュし、左半分を base64url エンコードする。
	 *
	 * @param string $access_token The access token.
	 * @return ?string at_hash。対応していない署名アルゴリズムの場合は null
	 */
	private function expected_at_hash( string $access_token ): ?string {
		$header = $this->getIdTokenHeader();
		$alg    = isset( $header->alg ) && \is_string( $header->alg ) ? $header->alg : '';
		if ( ! \preg_match( '/^(?:RS|ES|PS)(256|384|512)$/', $alg, $matches ) ) {
			debug( "Unsupported id_token alg for at_hash verification: {$alg}(OIDC)" );
			return null;
		}
		$bit = $matches[1];
		$len = ( (int) $bit ) / 16;

		return $this->urlEncode( substr( hash( 'sha' . $bit, $access_token, true ), 0, $len ) );
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
