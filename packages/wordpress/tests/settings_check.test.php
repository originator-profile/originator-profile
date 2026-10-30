<?php declare(strict_types=1);
use PHPUnit\Framework\TestCase;

// phpcs:disable WordPress.PHP.DiscouragedPHPFunctions.obfuscation_base64_encode, WordPress.WP.AlternativeFunctions.json_encode_json_encode -- Fixtures encode dummy credentials.
require_once __DIR__ . '/../includes/settings-check.php';
use function Profile\SettingsCheck\check_settings;
use function Profile\SettingsCheck\needs_oidc_authentication;
use const Profile\SettingsCheck\CCSP_KEYS;
use const Profile\SettingsCheck\OIDC_KEYS;

final class Settings_Check extends TestCase {
	private function settings( array $overrides = array() ): array {
		return $overrides + array(
			'profile_ca_issuer_id'           => 'dns:media.example.com',
			'profile_ca_server_hostname'     => 'playground.originator-profile.org',
			'profile_ca_server_admin_secret' => 'user:password',
			'profile_ca_server_id_token'     => '',
		);
	}

	private function auth_config( string $prefix, array $keys ): string {
		return $prefix . ':' . base64_encode( json_encode( array_fill_keys( $keys, 'value' ) ) );
	}

	public function test_正しい設定では問題を返さない() {
		$this->assertSame( array(), check_settings( $this->settings() ) );
		$this->assertSame( array(), check_settings( $this->settings( array( 'profile_ca_server_hostname' => 'ca.example.com:8443' ) ) ) );
		$this->assertSame( array(), check_settings( $this->settings( array( 'profile_ca_server_hostname' => 'ca.example.com:65535' ) ) ) );
		$this->assertSame( array(), check_settings( $this->settings( array( 'profile_ca_server_hostname' => 'localhost' ) ) ) );
		$this->assertSame( array(), check_settings( $this->settings( array( 'profile_ca_server_admin_secret' => $this->auth_config( 'CCSP', CCSP_KEYS ) ) ) ) );
		$this->assertSame(
			array(),
			check_settings(
				$this->settings(
					array(
						'profile_ca_server_admin_secret' => $this->auth_config( 'OIDC', OIDC_KEYS ),
						'profile_ca_server_id_token'     => 'token',
					)
				)
			)
		);
	}

	public function test_未設定の項目をそれぞれ指摘する() {
		$problems = check_settings(
			array(
				'profile_ca_issuer_id'           => '',
				'profile_ca_server_hostname'     => '',
				'profile_ca_server_admin_secret' => '',
			)
		);
		$this->assertCount( 3, $problems );
		$this->assertStringContainsString( '発行者ID', $problems[0] );
		$this->assertStringContainsString( 'ホスト名', $problems[1] );
		$this->assertStringContainsString( '認証情報', $problems[2] );
	}

	public function test_形式の誤りを指摘する() {
		$this->assertStringContainsString( 'dns:media.example.com', check_settings( $this->settings( array( 'profile_ca_issuer_id' => 'media.example.com' ) ) )[0] );
		foreach ( array( 'https://playground.originator-profile.org', 'playground.originator-profile.org/', 'ca.example.com/api', 'ca example.com', 'ca.example.com:0', 'ca.example.com:65536', 'ca.example.com:99999' ) as $hostname ) {
			$this->assertStringContainsString( 'https://', check_settings( $this->settings( array( 'profile_ca_server_hostname' => $hostname ) ) )[0], $hostname );
		}
		$this->assertStringContainsString( 'ユーザー名:パスワード', check_settings( $this->settings( array( 'profile_ca_server_admin_secret' => 'password-only' ) ) )[0] );
	}

	public function test_OIDC_CCSPの認証情報の誤りを指摘する() {
		$this->assertStringContainsString( '読み取れません', check_settings( $this->settings( array( 'profile_ca_server_admin_secret' => 'CCSP:not-base64!' ) ) )[0] );
		$this->assertStringContainsString( '読み取れません', check_settings( $this->settings( array( 'profile_ca_server_admin_secret' => 'OIDC:' . base64_encode( 'not json' ) ) ) )[0] );
		$this->assertStringContainsString( 'tokenUrl', check_settings( $this->settings( array( 'profile_ca_server_admin_secret' => $this->auth_config( 'CCSP', array( 'authType', 'clientId', 'clientSec' ) ) ) ) )[0] );
	}

	public function test_OIDCの未認証は設定の誤りではなく次の手順として扱う() {
		$oidc = $this->settings( array( 'profile_ca_server_admin_secret' => $this->auth_config( 'OIDC', OIDC_KEYS ) ) );
		// The ID token is stored only after the OIDC authentication, which needs the saved settings.
		$this->assertSame( array(), check_settings( $oidc ) );
		$this->assertTrue( needs_oidc_authentication( $oidc ) );
		$this->assertFalse( needs_oidc_authentication( array( 'profile_ca_server_id_token' => 'token' ) + $oidc ) );
		// Invalid OIDC settings are reported as problems instead.
		$this->assertFalse( needs_oidc_authentication( $this->settings( array( 'profile_ca_server_admin_secret' => $this->auth_config( 'OIDC', array( 'clientId' ) ) ) ) ) );
		$this->assertFalse( needs_oidc_authentication( $this->settings() ) );
	}
}
