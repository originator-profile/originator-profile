<?php declare(strict_types=1);
use PHPUnit\Framework\TestCase;

require_once __DIR__ . '/../includes/class-casapiauthclient.php';
use Profile\CasApiAuthClient\CasApiAuthClient;

final class Oidc_Claims extends TestCase {
	private const CLIENT_ID       = 'test-client';
	private const FIREBASE_ISSUER = 'https://securetoken.google.com/test-project';
	private const ACCESS_TOKEN    = 'test-access-token';
	private const NONCE           = 'test-nonce';

	protected function setUp(): void {
		if ( session_status() === PHP_SESSION_NONE ) {
			ini_set( 'session.use_cookies', '0' ); // phpcs:ignore WordPress.PHP.IniSet.Risky
			@session_start(); // phpcs:ignore WordPress.PHP.NoSilencedErrors.Discouraged
		}
		$_SESSION = array( 'openid_connect_nonce' => self::NONCE );
	}

	private static function json( mixed $value ): string {
		return (string) json_encode( $value ); // phpcs:ignore WordPress.WP.AlternativeFunctions.json_encode_json_encode
	}

	private static function base64url( string $value ): string {
		// phpcs:ignore WordPress.PHP.DiscouragedPHPFunctions.obfuscation_base64_encode
		return rtrim( strtr( base64_encode( $value ), '+/', '-_' ), '=' );
	}

	private static function at_hash( string $access_token ): string {
		return self::base64url( substr( hash( 'sha256', $access_token, true ), 0, 16 ) );
	}

	private static function client( string $provider, array $extra = array() ): CasApiAuthClient {
		$config = array_merge(
			array(
				'providerUrl'  => 'https://provider.example',
				'provider'     => $provider,
				'authorizeUrl' => 'https://provider.example/authorize',
				'tokenUrl'     => 'https://provider.example/token',
				'redirectUrl'  => 'https://wp.example/callback',
				'clientId'     => self::CLIENT_ID,
				'clientSec'    => 'test-secret',
				'jwksUri'      => 'https://provider.example/jwks',
			),
			$extra
		);
		$client = new CasApiAuthClient();
		// phpcs:ignore WordPress.PHP.DiscouragedPHPFunctions.obfuscation_base64_encode
		self::assertTrue( $client->init_oidc( 'OIDC:' . base64_encode( self::json( $config ) ) ) );
		return $client;
	}

	/**
	 * Firebase Secure Token の ID トークンのクレーム
	 *
	 * @param array $overrides 上書きするクレーム.
	 * @return array クレーム
	 */
	private static function firebase_claims( array $overrides = array() ): array {
		return array_merge(
			array(
				'iss'      => self::FIREBASE_ISSUER,
				'aud'      => 'test-project',
				'sub'      => 'user-1',
				'exp'      => time() + 3600,
				'iat'      => time(),
				'firebase' => array( 'sign_in_provider' => 'password' ),
				'nonce'    => self::NONCE,
				'at_hash'  => self::at_hash( self::ACCESS_TOKEN ),
			),
			$overrides
		);
	}

	private static function verify( CasApiAuthClient $client, array $claims, ?string $access_token = self::ACCESS_TOKEN ): bool {
		$header = array(
			'alg' => 'RS256',
			'typ' => 'JWT',
		);
		$client->setIdToken( self::base64url( self::json( $header ) ) . '.' . self::base64url( self::json( $claims ) ) . '.signature' );
		$method = new ReflectionMethod( CasApiAuthClient::class, 'verifyJWTClaims' );
		return $method->invoke( $client, json_decode( self::json( $claims ) ), $access_token );
	}

	public function test_FirebaseのIDトークンはaudがプロジェクトIDなら検証に通る() {
		$this->assertTrue( self::verify( self::client( self::FIREBASE_ISSUER ), self::firebase_claims() ) );
	}

	public function test_FirebaseのIDトークンでもaudが別のプロジェクトなら検証に失敗する() {
		$this->assertFalse( self::verify( self::client( self::FIREBASE_ISSUER ), self::firebase_claims( array( 'aud' => 'other-project' ) ) ) );
	}

	public function test_FirebaseのIDトークンでもaudが無ければ検証に失敗する() {
		$claims = self::firebase_claims();
		unset( $claims['aud'] );
		$this->assertFalse( self::verify( self::client( self::FIREBASE_ISSUER ), $claims ) );
	}

	public function test_FirebaseのIDトークンでもnonceが認可リクエストと異なれば検証に失敗する() {
		$this->assertFalse( self::verify( self::client( self::FIREBASE_ISSUER ), self::firebase_claims( array( 'nonce' => 'other-nonce' ) ) ) );
	}

	public function test_FirebaseのIDトークンでもat_hashがアクセストークンと異なれば検証に失敗する() {
		$this->assertFalse( self::verify( self::client( self::FIREBASE_ISSUER ), self::firebase_claims( array( 'at_hash' => self::at_hash( 'other-access-token' ) ) ) ) );
	}

	public function test_nonceとat_hashが無いFirebaseのIDトークンは検証に通る() {
		$claims = self::firebase_claims();
		unset( $claims['nonce'], $claims['at_hash'] );
		$this->assertTrue( self::verify( self::client( self::FIREBASE_ISSUER ), $claims ) );
	}

	public function test_有効期限が切れたIDトークンは検証に失敗する() {
		$this->assertFalse( self::verify( self::client( self::FIREBASE_ISSUER ), self::firebase_claims( array( 'exp' => time() - 3600 ) ) ) );
	}

	public function test_subがIDトークンと異なれば検証に失敗する() {
		$client = self::client( self::FIREBASE_ISSUER );
		$claims = self::firebase_claims();
		$header = self::base64url( self::json( array( 'alg' => 'RS256' ) ) );
		$client->setIdToken( $header . '.' . self::base64url( self::json( array( 'sub' => 'user-2' ) ) ) . '.signature' );
		$method = new ReflectionMethod( CasApiAuthClient::class, 'verifyJWTClaims' );
		$this->assertFalse( $method->invoke( $client, json_decode( self::json( $claims ) ), self::ACCESS_TOKEN ) );
	}

	public function test_Firebase以外のプロバイダーではaudがクライアントIDなら検証に通る() {
		$issuer = 'https://provider.example';
		$claims = self::firebase_claims(
			array(
				'iss' => $issuer,
				'aud' => array( self::CLIENT_ID, 'another-audience' ),
			)
		);
		unset( $claims['firebase'] );
		$this->assertTrue( self::verify( self::client( $issuer ), $claims ) );
	}

	public function test_Firebase以外のプロバイダーではaudがクライアントIDでなければ検証に失敗する() {
		$issuer = 'https://provider.example';
		$claims = self::firebase_claims(
			array(
				'iss' => $issuer,
				'aud' => 'test-project',
			)
		);
		$this->assertFalse( self::verify( self::client( $issuer ), $claims ) );
	}

	public function test_設定のfirebaseProjectIdをaudとして許可する() {
		$issuer = 'https://provider.example';
		$claims = self::firebase_claims(
			array(
				'iss' => $issuer,
				'aud' => 'configured-project',
			)
		);
		$this->assertTrue( self::verify( self::client( $issuer, array( 'firebaseProjectId' => 'configured-project' ) ), $claims ) );
	}

	public function test_well_known設定で検証されたFirebaseのissuerのプロジェクトIDをaudとして許可する() {
		// 認証設定の provider と異なる iss が、プロバイダーの well-known 設定の issuer として検証される場合.
		$client = self::client( 'https://provider.example' );
		$client->setIssuerValidator( static fn ( string $iss ): bool => self::FIREBASE_ISSUER === $iss );
		$this->assertTrue( self::verify( $client, self::firebase_claims() ) );
		$this->assertFalse( self::verify( $client, self::firebase_claims( array( 'aud' => 'other-project' ) ) ) );
	}

	public function test_resolve_firebase_project_idメソッドはFirebaseのissuerからプロジェクトIDを求める() {
		$this->assertSame( 'test-project', CasApiAuthClient::resolve_firebase_project_id( array( 'provider' => 'https://securetoken.google.com/test-project' ) ) );
		$this->assertSame( 'test-project', CasApiAuthClient::resolve_firebase_project_id( array( 'provider' => 'https://securetoken.google.com/test-project/' ) ) );
		$this->assertSame(
			'explicit',
			CasApiAuthClient::resolve_firebase_project_id(
				array(
					'provider'          => 'https://securetoken.google.com/test-project',
					'firebaseProjectId' => 'explicit',
				)
			)
		);
	}

	public function test_resolve_firebase_project_idメソッドはFirebase以外のissuerにnullを返す() {
		$this->assertNull( CasApiAuthClient::resolve_firebase_project_id( array( 'provider' => 'https://provider.example' ) ) );
		$this->assertNull( CasApiAuthClient::resolve_firebase_project_id( array( 'provider' => 'https://securetoken.google.com.evil.example/test-project' ) ) );
		$this->assertNull( CasApiAuthClient::resolve_firebase_project_id( array( 'provider' => 'https://evil.example/securetoken.google.com/test-project' ) ) );
		$this->assertNull( CasApiAuthClient::resolve_firebase_project_id( array( 'provider' => 'https://securetoken.google.com/' ) ) );
		$this->assertNull( CasApiAuthClient::resolve_firebase_project_id( array() ) );
	}
}
