<?php
/** 設定保存時の形式チェック */

namespace Profile\SettingsCheck;

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
	} elseif ( ! preg_match( '/\A[A-Za-z0-9.-]+(?::\d{1,5})?\z/', $hostname ) ) {
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
		} elseif ( 'OIDC' === $prefix && empty( $value['profile_ca_server_id_token'] ) ) {
			$problems[] = 'OIDCの認証がまだ済んでいません。プラグイン一覧の「API認証(OIDC)」から認証してください。';
		}
	} elseif ( ! str_contains( $admin_secret, ':' ) ) {
		$problems[] = '認証情報は「ユーザー名:パスワード」の形式で入力してください。';
	}

	return $problems;
}

/** 設定の保存直後だけ、形式に問題があれば警告を表示する */
function render_saved_notice() {
	// phpcs:ignore WordPress.Security.NonceVerification.Recommended -- 保存後の画面の表示だけに使い、データは変更しない。
	if ( ! isset( $_GET['settings-updated'] ) || 'true' !== $_GET['settings-updated'] ) {
		return;
	}
	$problems = check_settings(
		array(
			'profile_ca_issuer_id'           => \get_option( 'profile_ca_issuer_id', '' ),
			'profile_ca_server_hostname'     => \get_option( 'profile_ca_server_hostname', '' ),
			'profile_ca_server_admin_secret' => \get_option( 'profile_ca_server_admin_secret', '' ),
			'profile_ca_server_id_token'     => \get_option( 'profile_ca_server_id_token', '' ),
		)
	);
	if ( ! $problems ) {
		return;
	}
	?>
		<div id="profile-ca-settings-check" class="notice notice-warning">
			<p>保存した設定に問題があります。このままではCAを発行できない可能性があります。</p>
			<ul class="ul-disc">
				<?php foreach ( $problems as $problem ) : ?>
					<li><?php echo \esc_html( $problem ); ?></li>
				<?php endforeach; ?>
			</ul>
		</div>
	<?php
}
