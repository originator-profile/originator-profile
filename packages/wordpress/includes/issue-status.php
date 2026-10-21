<?php
/** 記事ごとの CA 発行失敗の記録と、編集画面での通知 */

namespace Profile\IssueStatus;

/** 直近の CA 発行失敗を保存する投稿メタのキー */
const FAILURE_META = '_profile_ca_issue_failure';

const AJAX_ACTION   = 'profile_ca_issue_status';
const SCRIPT_HANDLE = 'profile-ca-issue-status';

/** 発行失敗の通知の初期化 */
function init() {
	\add_action( 'wp_ajax_' . AJAX_ACTION, '\Profile\IssueStatus\ajax_status' );
	\add_action( 'enqueue_block_editor_assets', '\Profile\IssueStatus\enqueue_assets' );
	\add_action( 'admin_notices', '\Profile\IssueStatus\render_classic_notice' );
}

/**
 * 発行結果を記録する
 *
 * 失敗は記録し、成功したら消す。スキップ（発行済み・除外など）では、直前の失敗を隠さないよう変更しない。
 *
 * @param int   $post_id 投稿 ID
 * @param array $result issue_post() の発行結果
 * @return array 受け取った発行結果
 */
function record_result( int $post_id, array $result ): array {
	if ( 'failed' === $result['status'] ) {
		\update_post_meta(
			$post_id,
			FAILURE_META,
			array(
				'message' => $result['message'],
				'time'    => time(),
			)
		);
	} elseif ( 'success' === $result['status'] ) {
		\delete_post_meta( $post_id, FAILURE_META );
	}
	return $result;
}

/**
 * 公開中の記事の直近の発行失敗
 *
 * @param int $post_id 投稿 ID
 * @return ?array 失敗していなければ null。message と、表示用の日時 time を含む
 */
function get_failure( int $post_id ): ?array {
	if ( 'publish' !== \get_post_status( $post_id ) ) {
		return null;
	}
	$failure = \get_post_meta( $post_id, FAILURE_META, true );
	if ( ! is_array( $failure ) || ! isset( $failure['message'], $failure['time'] ) ) {
		return null;
	}
	return array(
		'message' => (string) $failure['message'],
		'time'    => \wp_date( 'Y-m-d H:i', (int) $failure['time'] ),
	);
}

/**
 * 通知の本文
 *
 * @param array $failure get_failure() の結果
 */
function failure_message( array $failure ): string {
	return "CAの発行に失敗しました（{$failure['time']}）：{$failure['message']}";
}

/** 発行失敗の状態を返す AJAX ハンドラー */
function ajax_status() {
	// phpcs:ignore WordPress.Security.NonceVerification.Missing -- 直後に check_ajax_referer で検証する。
	$post_id = isset( $_POST['post_id'] ) ? (int) $_POST['post_id'] : 0;
	if ( false === \check_ajax_referer( AJAX_ACTION, 'nonce', false ) || $post_id <= 0 || ! \current_user_can( 'edit_post', $post_id ) ) {
		\wp_send_json_error( null, 403 );
	}
	$failure = get_failure( $post_id );
	\wp_send_json_success( array( 'message' => $failure ? failure_message( $failure ) : null ) );
}

/** 投稿の編集画面（ブロックエディター）でだけ通知の JavaScript を読み込む */
function enqueue_assets() {
	$screen = \get_current_screen();
	if ( ! $screen || 'post' !== $screen->base ) {
		return;
	}
	$script_file = __DIR__ . '/../assets/issue-status.js';
	\wp_enqueue_script(
		SCRIPT_HANDLE,
		\plugins_url( '../assets/issue-status.js', __FILE__ ),
		array( 'wp-data', 'wp-editor', 'wp-notices' ),
		\file_exists( $script_file ) ? (string) \filemtime( $script_file ) : '1.0.0',
		true
	);
	\wp_localize_script(
		SCRIPT_HANDLE,
		'profileCaIssueStatus',
		array(
			'ajaxUrl'     => \admin_url( 'admin-ajax.php' ),
			'nonce'       => \wp_create_nonce( AJAX_ACTION ),
			// 接続確認は設定を変更できる管理者だけが使える。
			'settingsUrl' => \current_user_can( 'manage_options' ) ? \admin_url( 'options-general.php?page=ca-manager' ) : '',
		)
	);
}

/** クラシックエディターの編集画面で、発行失敗を通知する（保存のたびに画面が再読み込みされる） */
function render_classic_notice() {
	$screen = \get_current_screen();
	if ( ! $screen || 'post' !== $screen->base || $screen->is_block_editor() ) {
		return;
	}
	$post    = \get_post();
	$failure = $post && \current_user_can( 'edit_post', $post->ID ) ? get_failure( $post->ID ) : null;
	if ( ! $failure ) {
		return;
	}
	?>
		<div id="profile-ca-issue-failure" class="notice notice-error">
			<p>
				<?php echo \esc_html( failure_message( $failure ) ); ?>
				<?php if ( \current_user_can( 'manage_options' ) ) : ?>
					<a href="<?php echo \esc_url( \admin_url( 'options-general.php?page=ca-manager' ) ); ?>">CAサーバーへの接続確認</a>
				<?php endif; ?>
			</p>
		</div>
	<?php
}
