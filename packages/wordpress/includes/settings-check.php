<?php
/** 保存済み設定の形式チェック */

namespace Profile\SettingsCheck;

require_once __DIR__ . '/config.php';
use const Profile\Config\PROFILE_DEFAULT_CA_SERVER_HOSTNAME;

require_once __DIR__ . '/oidc-callback.php';
use const Profile\CasApiOidcCallback\OIDC_CALLBACK_ENDPOINT;

/** OIDC の認証情報に必要なキー（CasApiAuthClient::init_oidc と同じ） */
const OIDC_KEYS = array( 'providerUrl', 'provider', 'authorizeUrl', 'tokenUrl', 'redirectUrl', 'clientId', 'clientSec', 'jwksUri' );

/** CCSP の認証情報に必要なキー（CasApiAuthCCSP::init_ccsp と同じ） */
const CCSP_KEYS = array( 'authType', 'clientId', 'clientSec', 'tokenUrl' );

/**
 * OIDC・CCSP の認証情報 (OIDC:<Base64 JSON> など) を読み取る
 *
 * @param string $admin_secret CAサーバー認証情報
 * @return ?array 読み取れない場合は null
 */
function decode_auth_config( string $admin_secret ): ?array {
	$encoded = explode( ':', $admin_secret, 2 )[1] ?? '';
	// phpcs:ignore WordPress.PHP.DiscouragedPHPFunctions.obfuscation_base64_decode -- 認証クライアントと同じ形式を読む。
	$decoded = '' === $encoded ? false : base64_decode( $encoded, true );
	$config  = false === $decoded ? null : json_decode( $decoded, true );
	return is_array( $config ) ? $config : null;
}

/**
 * 保存済みの設定を通信せずに検査する
 *
 * @param array $value 設定値（profile_ca_issuer_id・profile_ca_server_hostname・profile_ca_server_admin_secret・profile_ca_server_id_token）
 * @return string[] 問題の説明。問題がなければ空
 */
function check_settings( array $value ): array {
	$problems = array();

	$issuer_id = (string) ( $value['profile_ca_issuer_id'] ?? '' );
	if ( '' === $issuer_id ) {
		$problems[] = '発行者ID (CA issuer\'s Originator Profile ID) が未設定です。';
	} elseif ( ! preg_match( '/\A[a-z][a-z0-9+.-]*:\S+\z/', $issuer_id ) ) {
		$problems[] = '発行者IDは「dns:media.example.com」のような形式で入力してください。';
	}

	$hostname = (string) ( $value['profile_ca_server_hostname'] ?? '' );
	if ( '' === $hostname ) {
		$problems[] = 'CAサーバーホスト名が未設定です。';
	} elseif ( ! preg_match( '/\A[A-Za-z0-9.-]+(?::(?:[1-9]\d{0,3}|[1-5]\d{4}|6[0-4]\d{3}|65[0-4]\d{2}|655[0-2]\d|6553[0-5]))?\z/', $hostname ) ) {
		$problems[] = 'CAサーバーホスト名には「https://」やパスを付けず、ホスト名だけを入力してください（例: playground.originator-profile.org）。';
	}

	$admin_secret = (string) ( $value['profile_ca_server_admin_secret'] ?? '' );
	$prefix       = explode( ':', $admin_secret, 2 )[0];
	if ( '' === $admin_secret ) {
		$problems[] = '認証情報が未設定です。';
	} elseif ( 'OIDC' === $prefix || 'CCSP' === $prefix ) {
		$config  = decode_auth_config( $admin_secret );
		$missing = array_diff( 'OIDC' === $prefix ? OIDC_KEYS : CCSP_KEYS, array_keys( $config ?? array() ) );
		if ( null === $config ) {
			$problems[] = "{$prefix}の認証情報を読み取れません。「{$prefix}:」の後に、設定のJSONをBase64で符号化した値を入力してください。";
		} elseif ( $missing ) {
			$problems[] = "{$prefix}の認証情報に必要な項目がありません：" . implode( '、', $missing );
		}
	} elseif ( ! str_contains( $admin_secret, ':' ) ) {
		$problems[] = '認証情報は「ユーザー名:パスワード」の形式で入力してください。';
	}

	return $problems;
}

/**
 * OIDC の認証が必要か（設定の誤りではなく、設定を保存したあとの初期設定の手順）
 *
 * 認証は保存済みの認証情報を使うため、設定を保存してから行う。
 *
 * @param array $value check_settings() と同じ設定値
 */
function needs_oidc_authentication( array $value ): bool {
	$admin_secret = (string) ( $value['profile_ca_server_admin_secret'] ?? '' );
	if ( 'OIDC' !== explode( ':', $admin_secret, 2 )[0] || ! empty( $value['profile_ca_server_id_token'] ) ) {
		return false;
	}
	$config = decode_auth_config( $admin_secret );
	return null !== $config && ! array_diff( OIDC_KEYS, array_keys( $config ) );
}

/** 設定画面を開くたびに、保存済みの設定の問題と、残っている初期設定の手順を表示する */
function render_notice() {
	$value    = array(
		'profile_ca_issuer_id'           => \get_option( 'profile_ca_issuer_id', '' ),
		// 未保存のときは、CA 発行 (build_ca_base_endpoint) と同じく初期値を使う。
		'profile_ca_server_hostname'     => \get_option( 'profile_ca_server_hostname', PROFILE_DEFAULT_CA_SERVER_HOSTNAME ),
		'profile_ca_server_admin_secret' => \get_option( 'profile_ca_server_admin_secret', '' ),
		'profile_ca_server_id_token'     => \get_option( 'profile_ca_server_id_token', '' ),
	);
	$problems = check_settings( $value );
	if ( $problems ) {
		?>
			<div id="profile-ca-settings-check" class="notice notice-warning">
				<p>保存済みの設定に問題があります。このままではCAを発行できない可能性があります。</p>
				<ul class="ul-disc">
					<?php foreach ( $problems as $problem ) : ?>
						<li><?php echo \esc_html( $problem ); ?></li>
					<?php endforeach; ?>
				</ul>
			</div>
		<?php
	}
	if ( needs_oidc_authentication( $value ) ) {
		?>
			<div id="profile-ca-oidc-next-step" class="notice notice-info">
				<p>
					次にOIDCの認証を完了してください。認証が終わったら、下の「接続確認」で確認できます。
					<a href="<?php echo \esc_url( \add_query_arg( OIDC_CALLBACK_ENDPOINT, '1', \home_url( '/' ) ) ); ?>" target="_blank">OIDC認証を開始</a>
				</p>
			</div>
		<?php
	}
}
