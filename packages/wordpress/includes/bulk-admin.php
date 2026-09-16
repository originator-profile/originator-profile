<?php
/** CA一括発行の管理画面 */

namespace Profile\BulkAdmin;

const PAGE_SLUG     = 'ca-manager-bulk';
const SCRIPT_HANDLE = 'profile-ca-bulk';

/** 管理画面と一括発行画面を初期化する。 */
function init() {
	\add_action( 'admin_menu', '\Profile\BulkAdmin\add_management_page' );
	\add_action( 'admin_enqueue_scripts', '\Profile\BulkAdmin\enqueue_assets' );
}

/** ツールメニューに一括発行画面を追加する。 */
function add_management_page() {
	\add_management_page(
		'CA一括発行',
		'CA一括発行',
		'manage_options',
		PAGE_SLUG,
		'\Profile\BulkAdmin\render_page'
	);
}

/**
 * 一括発行画面でだけ JavaScript と AJAX 用データを読み込む。
 *
 * @param string $hook_suffix 現在の管理画面フック名。
 */
function enqueue_assets( $hook_suffix ) {
	if ( 'tools_page_' . PAGE_SLUG !== $hook_suffix ) {
		return;
	}

	$script_file    = __DIR__ . '/../assets/bulk.js';
	$script_version = \file_exists( $script_file ) ? (string) \filemtime( $script_file ) : '1.0.0';
	$style_file     = __DIR__ . '/../assets/bulk.css';
	$style_version  = \file_exists( $style_file ) ? (string) \filemtime( $style_file ) : '1.0.0';
	\wp_enqueue_style( SCRIPT_HANDLE, \plugins_url( '../assets/bulk.css', __FILE__ ), array(), $style_version );
	\wp_enqueue_script(
		SCRIPT_HANDLE,
		\plugins_url( '../assets/bulk.js', __FILE__ ),
		array(),
		$script_version,
		true
	);
	\wp_localize_script(
		SCRIPT_HANDLE,
		'profileCaBulk',
		array(
			'ajaxUrl' => \admin_url( 'admin-ajax.php' ),
			'nonce'   => \wp_create_nonce( 'profile_ca_bulk' ),
		)
	);
}

/** 一括発行画面を表示する。 */
function render_page() {
	if ( ! \current_user_can( 'manage_options' ) ) {
		\wp_die( '権限がありません。' );
	}

	$categories = \get_categories(
		array(
			'hide_empty' => false,
		)
	);
	if ( ! is_array( $categories ) ) {
		$categories = array();
	}
	$settings_url = \admin_url( 'options-general.php?page=ca-manager' );
	?>
	<div class="wrap" id="profile-ca-bulk">
		<h1>CA一括発行</h1>
		<p>公開済みの記事を選択して、Content Attestation (CA) を順番に発行します。プレビューで対象件数を確認してから開始してください。</p>
		<p>CAサーバーの認証情報が未設定の場合は開始できません。<a href="<?php echo \esc_url( $settings_url ); ?>">CA Manager 設定</a>を確認してください。</p>

		<form id="profile-ca-bulk-form" class="profile-ca-bulk-form" novalidate>
			<fieldset>
				<legend>対象の絞り込み</legend>
				<table class="form-table" role="presentation">
					<tbody>
						<tr>
							<th scope="row"><label for="profile-ca-bulk-post-type">投稿タイプ</label></th>
							<td>
								<select id="profile-ca-bulk-post-type" name="post_type">
									<option value="all">投稿と固定ページ</option>
									<option value="post">投稿</option>
									<option value="page">固定ページ</option>
								</select>
							</td>
						</tr>
						<tr>
							<th scope="row"><label for="profile-ca-bulk-category">カテゴリー</label></th>
							<td>
								<select id="profile-ca-bulk-category" name="category">
									<option value="0">すべてのカテゴリー</option>
									<?php foreach ( $categories as $category ) : ?>
										<option value="<?php echo (int) $category->term_id; ?>"><?php echo \esc_html( $category->name ); ?></option>
									<?php endforeach; ?>
								</select>
								<p class="description">カテゴリーを指定すると、そのカテゴリーに属する公開済みの投稿・固定ページを対象にします。</p>
							</td>
						</tr>
						<tr>
							<th scope="row"><label for="profile-ca-bulk-date-from">公開日の範囲</label></th>
							<td>
								<label for="profile-ca-bulk-date-from">開始日</label>
								<input type="date" id="profile-ca-bulk-date-from" name="date_from" value="">
								<span aria-hidden="true">〜</span>
								<label for="profile-ca-bulk-date-to">終了日</label>
								<input type="date" id="profile-ca-bulk-date-to" name="date_to" value="">
								<p class="description">空欄の場合は公開日で絞り込みません。</p>
							</td>
						</tr>
					</tbody>
				</table>
			</fieldset>

			<fieldset>
				<legend>発行方法</legend>
				<p>
					<label for="profile-ca-bulk-mode">対象</label>
					<select id="profile-ca-bulk-mode" name="mode">
						<option value="missing">未発行のみ（既存CAを維持）</option>
						<option value="all">全件（既存CAを再発行）</option>
					</select>
				</p>
				<div id="profile-ca-bulk-reissue-warning" class="notice notice-warning inline" hidden>
					<p>「全件」は既存CAを再発行します。保存済みの除外設定は引き続き適用され、発行に失敗した記事の既存CAは保持されます。</p>
				</div>
				<p id="profile-ca-bulk-reissue-confirm-wrap" hidden>
					<label for="profile-ca-bulk-reissue-confirm">
						<input type="checkbox" id="profile-ca-bulk-reissue-confirm" name="confirm_reissue" value="1">
						既存CAを再発行することを確認しました
					</label>
				</p>
			</fieldset>

			<p class="submit">
				<button type="button" class="button" id="profile-ca-bulk-preview">プレビューを取得</button>
				<button type="button" class="button button-primary" id="profile-ca-bulk-start">一括発行を開始</button>
				<button type="button" class="button" id="profile-ca-bulk-resume" hidden>一括発行を再開</button>
				<button type="button" class="button" id="profile-ca-bulk-pause" hidden>一時停止</button>
				<button type="button" class="button" id="profile-ca-bulk-retry" hidden>失敗した記事を再試行</button>
				<button type="button" class="button" id="profile-ca-bulk-cancel" hidden>一括発行をキャンセル</button>
				<button type="button" class="button button-secondary" id="profile-ca-bulk-refresh">状態を再取得</button>
			</p>
		</form>

		<section aria-labelledby="profile-ca-bulk-status-heading">
			<h2 id="profile-ca-bulk-status-heading">実行状況</h2>
			<div id="profile-ca-bulk-status" class="notice notice-info inline" role="status" aria-live="polite"><p>状態を読み込んでいます。</p></div>
			<p id="profile-ca-bulk-progress"></p>
			<div id="profile-ca-bulk-counts" hidden>
				<strong>結果</strong>
				<ul>
					<li>成功: <span id="profile-ca-bulk-success-count">0</span></li>
					<li>失敗: <span id="profile-ca-bulk-failed-count">0</span></li>
					<li>スキップ: <span id="profile-ca-bulk-skipped-count">0</span></li>
				</ul>
			</div>
		</section>

		<section id="profile-ca-bulk-preview-section" aria-labelledby="profile-ca-bulk-preview-heading" hidden>
			<h2 id="profile-ca-bulk-preview-heading">プレビュー</h2>
			<p id="profile-ca-bulk-preview-count"></p>
			<table class="widefat striped">
				<thead>
					<tr>
						<th scope="col">ID</th>
						<th scope="col">タイトル</th>
						<th scope="col">状態</th>
						<th scope="col">メッセージ</th>
					</tr>
				</thead>
				<tbody id="profile-ca-bulk-preview-body"></tbody>
			</table>
		</section>

		<section aria-labelledby="profile-ca-bulk-log-heading">
			<h2 id="profile-ca-bulk-log-heading">処理ログ（最新100件）</h2>
			<table class="widefat striped">
				<thead>
					<tr>
						<th scope="col">ID</th>
						<th scope="col">タイトル</th>
						<th scope="col">状態</th>
						<th scope="col">メッセージ</th>
					</tr>
				</thead>
				<tbody id="profile-ca-bulk-log-body"></tbody>
			</table>
		</section>
	</div>
	<?php
}
