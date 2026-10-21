<?php
/** CAサーバーへの接続確認 */

namespace Profile\Diagnostics;

require_once __DIR__ . '/issue.php';
use function Profile\Issue\build_ca_base_endpoint;

require_once __DIR__ . '/class-casapiauthclient.php';
use Profile\CasApiAuthClient\CasApiAuthClient;

require_once __DIR__ . '/class-casapiauthccsp.php';
use Profile\CasApiAuthClient\CasApiAuthCCSP;
use const Profile\CasApiAuthClient\CA_SERVER_ACCESS_TOKEN;

const AJAX_ACTION   = 'profile_ca_diagnostics';
const SCRIPT_HANDLE = 'profile-ca-diagnostics';

/** 接続確認のリクエストタイムアウト (秒) */
const REQUEST_TIMEOUT = 10;

/** 接続確認の初期化 */
function init() {
	\add_action( 'wp_ajax_' . AJAX_ACTION, '\Profile\Diagnostics\ajax_check' );
	\add_action( 'admin_enqueue_scripts', '\Profile\Diagnostics\enqueue_assets' );
}

/**
 * 確認段階の結果
 *
 * @param string $status ok（確認できた）・ng（問題あり）・unverified（確認していない・判定できない）
 * @param string $message 管理者向けの案内
 */
function stage( string $status, string $message ): array {
	return array(
		'status'  => $status,
		'message' => $message,
	);
}

/**
 * 認証方式
 *
 * @param string $admin_secret CAサーバー認証情報
 * @return string basic・oidc・ccsp のいずれか
 */
function auth_mode( string $admin_secret ): string {
	$prefix = explode( ':', $admin_secret, 2 )[0];
	if ( 'OIDC' === $prefix ) {
		return 'oidc';
	}
	if ( 'CCSP' === $prefix ) {
		return 'ccsp';
	}
	return 'basic';
}

/**
 * CA 登録 API (POST /ca) に認証なしで空のリクエストを送った応答から到達性を判定する
 *
 * CA サーバーは認証を先に行うため、到達できれば JSON のエラー (401) が返り CA は発行されない。
 * playground などのプロキシは CA 登録 API だけを転送するため、読み取り API ではなくこの API を使う。
 *
 * @param int    $status HTTP ステータス。
 * @param string $body 応答本文。
 */
function classify_reachability( int $status, string $body ): array {
	if ( in_array( $status, array( 400, 401 ), true ) && is_array( json_decode( $body, true ) ) ) {
		return stage( 'ok', 'CAサーバーに接続できました。' );
	}
	return stage( 'ng', "CAサーバーから想定外の応答がありました（HTTP {$status}）。ホスト名、または前段のプロキシ・WAFの設定を確認してください。" );
}

/**
 * CA 登録 API (POST /ca) に空のリクエストを送った応答から認証の可否を判定する
 *
 * 認証なしで 401 になるサーバーは本文の検証より先に認証を行うため、認証付きで 400 になれば認証が通ったと判定できる（本文の検証で拒否され CA は発行されない）。
 * 認証なしでも 400 になるサーバーでは、本文の検証が先のため認証の可否を判定できない。
 *
 * @param int $status 認証付きリクエストの HTTP ステータス
 * @param int $anonymous_status 認証なしリクエストの HTTP ステータス
 */
function classify_authentication( int $status, int $anonymous_status ): array {
	if ( 401 === $status ) {
		return stage( 'ng', 'CAサーバーで認証情報が拒否されました（HTTP 401）。認証情報を確認してください。' );
	}
	if ( 400 === $status && 401 === $anonymous_status ) {
		return stage( 'ok', '認証情報はCAサーバーで受け付けられました。' );
	}
	if ( 400 === $status ) {
		return stage( 'unverified', 'このCAサーバーは認証より先にリクエスト本文を検証するため、認証の可否を判定できませんでした。' );
	}
	return stage( 'unverified', "認証の可否を判定できませんでした（HTTP {$status}）。" );
}

/**
 * 全体の結果
 *
 * @param array $stages 確認段階の結果
 * @return string success・warning・error のいずれか
 */
function summarize( array $stages ): string {
	$statuses = array_column( $stages, 'status' );
	if ( in_array( 'ng', $statuses, true ) ) {
		return 'error';
	}
	if ( in_array( 'unverified', $statuses, true ) ) {
		return 'warning';
	}
	return 'success';
}

/**
 * 接続確認用のリクエスト引数（POST /ca に空の JSON を送る）
 *
 * 通常の CA 発行 (request_ca) と同じ接続先に届くよう、内部ネットワークや非標準ポートは拒否しない。
 *
 * @param array $headers 追加のリクエストヘッダー
 */
function request_args( array $headers = array() ): array {
	return array(
		'method'      => 'POST',
		'timeout'     => REQUEST_TIMEOUT,
		'redirection' => 0,
		'headers'     => $headers + array(
			'accept'       => 'application/json',
			'content-type' => 'application/json',
		),
		'body'        => '{}',
	);
}

/**
 * Authorization ヘッダーを用意する
 *
 * OIDC・CCSP ではトークンを取得し、通常の CA 発行と同様に保存する。
 *
 * @param string $admin_secret CAサーバー認証情報
 * @return array 成功時は header、失敗時は stage を含む
 */
function authorization_header( string $admin_secret ): array {
	switch ( auth_mode( $admin_secret ) ) {
		case 'oidc':
			$client = new CasApiAuthClient();
			if ( ! $client->init_oidc( $admin_secret ) ) {
				return array( 'stage' => stage( 'ng', 'OIDCの認証情報の形式が正しくありません。設定マニュアルに従って入力してください。' ) );
			}
			$token = $client->get_api_token();
			if ( ! $token ) {
				return array( 'stage' => stage( 'ng', 'OIDCのトークンを取得できませんでした。プラグイン一覧の「API認証(OIDC)」から認証し直してください。' ) );
			}
			return array( 'header' => 'Bearer ' . $token );
		case 'ccsp':
			$client = new CasApiAuthCCSP();
			if ( ! $client->init_ccsp( $admin_secret ) ) {
				return array( 'stage' => stage( 'ng', 'CCSPの認証情報の形式が正しくありません。設定マニュアルに従って入力してください。' ) );
			}
			// get_api_token() は JWT 以外のトークンを期限切れとみなして再取得するため、取得直後の保存値を使う。
			$token = $client->authenticate() ? \get_option( CA_SERVER_ACCESS_TOKEN ) : null;
			if ( ! $token ) {
				return array( 'stage' => stage( 'ng', 'CCSPのトークンを取得できませんでした。クライアントID・シークレット・トークンURLを確認してください。' ) );
			}
			return array( 'header' => 'Bearer ' . $token );
		default:
			if ( ! str_contains( $admin_secret, ':' ) ) {
				return array( 'stage' => stage( 'ng', '認証情報の形式が正しくありません。「ユーザー名:パスワード」の形式で入力してください。' ) );
			}
			return array( 'header' => 'Basic ' . \sodium_bin2base64( $admin_secret, SODIUM_BASE64_VARIANT_ORIGINAL ) );
	}
}

/**
 * 認証情報を確認する
 *
 * @param string $base_endpoint CAサーバーのベース URL
 * @param string $admin_secret CAサーバー認証情報
 * @param int    $anonymous_status 認証なしリクエストの HTTP ステータス
 */
function check_authentication( string $base_endpoint, string $admin_secret, int $anonymous_status ): array {
	if ( '' === $admin_secret ) {
		return stage( 'unverified', '認証情報が未設定のため、認証は確認していません。' );
	}
	try {
		$auth = authorization_header( $admin_secret );
	} catch ( \Throwable $error ) {
		return stage( 'ng', 'トークンを取得できませんでした。認証情報を確認してください。' );
	}
	if ( isset( $auth['stage'] ) ) {
		return $auth['stage'];
	}
	$res = \wp_remote_request( $base_endpoint . '/ca', request_args( array( 'authorization' => $auth['header'] ) ) );
	if ( \is_wp_error( $res ) ) {
		return stage( 'unverified', '認証の確認中に通信できませんでした：' . $res->get_error_message() );
	}
	return classify_authentication( (int) \wp_remote_retrieve_response_code( $res ), $anonymous_status );
}

/**
 * 保存済みの設定で接続確認を行う
 *
 * 副作用: CAサーバー（OIDC・CCSP ではトークンURLも）へ通信し、取得・更新したトークンを通常の CA 発行と同様に保存する。CA は発行しない。
 */
function diagnose(): array {
	$base_endpoint    = build_ca_base_endpoint();
	$res              = \wp_remote_request( $base_endpoint . '/ca', request_args() );
	$anonymous_status = 0;
	if ( \is_wp_error( $res ) ) {
		$reachability = stage( 'ng', 'CAサーバーに接続できませんでした：' . $res->get_error_message() . '　ホスト名とネットワークを確認してください。' );
	} else {
		$anonymous_status = (int) \wp_remote_retrieve_response_code( $res );
		$reachability     = classify_reachability( $anonymous_status, \wp_remote_retrieve_body( $res ) );
	}
	$stages = array(
		'reachability'   => $reachability,
		// CAサーバーと判定できない接続先には認証情報を送らない。
		'authentication' => 'ok' === $reachability['status']
			? check_authentication( $base_endpoint, (string) \get_option( 'profile_ca_server_admin_secret', '' ), $anonymous_status )
			: stage( 'unverified', 'CAサーバーに接続できないため、認証は確認していません。' ),
	);
	return array(
		'state'  => summarize( $stages ),
		'stages' => $stages,
	);
}

/** 接続確認の AJAX ハンドラー */
function ajax_check() {
	if ( ! \current_user_can( 'manage_options' ) || false === \check_ajax_referer( AJAX_ACTION, 'nonce', false ) ) {
		\wp_send_json_error( array( 'message' => '権限がないか、画面の有効期限が切れています。画面を再読み込みしてください。' ), 403 );
	}
	\wp_send_json_success( diagnose() );
}

/**
 * 設定画面でだけ接続確認の JavaScript を読み込む
 *
 * @param string $hook_suffix 現在の管理画面フック名
 */
function enqueue_assets( $hook_suffix ) {
	if ( 'settings_page_ca-manager' !== $hook_suffix ) {
		return;
	}
	$script_file = __DIR__ . '/../assets/diagnostics.js';
	\wp_enqueue_script(
		SCRIPT_HANDLE,
		\plugins_url( '../assets/diagnostics.js', __FILE__ ),
		array(),
		\file_exists( $script_file ) ? (string) \filemtime( $script_file ) : '1.0.0',
		true
	);
	\wp_localize_script(
		SCRIPT_HANDLE,
		'profileCaDiagnostics',
		array(
			'ajaxUrl' => \admin_url( 'admin-ajax.php' ),
			'nonce'   => \wp_create_nonce( AJAX_ACTION ),
		)
	);
}

/** 接続確認のボタンと結果の表示領域 */
function render() {
	?>
		<h2>CAサーバーへの接続確認</h2>
		<p id="profile-ca-diagnostics-help">
			保存済みの設定で、CAサーバーへの接続と認証情報を確認します。CAは発行しません。<br>
			OIDC・CCSPでは、通常のCA発行と同じようにトークンを取得して保存します。発行者IDに対する発行権限は確認しません。
		</p>
		<p>
			<button type="button" id="profile-ca-diagnostics-check" class="button button-secondary" aria-describedby="profile-ca-diagnostics-help">接続確認</button>
		</p>
		<div id="profile-ca-diagnostics-status" aria-live="polite" aria-atomic="true"></div>
		<noscript><p>接続確認にはJavaScriptを有効にしてください。</p></noscript>
	<?php
}
