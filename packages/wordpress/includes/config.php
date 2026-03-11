<?php
/** 構成 */

namespace Profile\Config;

/** Content Attestation サーバーのホスト名の設定の初期値 */
const PROFILE_DEFAULT_CA_SERVER_HOSTNAME = 'dprexpt.originator-profile.org';

/** Content Attestation サーバーのリクエストタイムアウト (秒) の初期値 */
const PROFILE_DEFAULT_CA_SERVER_REQUEST_TIMEOUT = 30;

/** 検証対象の種別の初期値 */
const PROFILE_DEFAULT_CA_TARGET_TYPE = 'TextTargetIntegrity';

/** 検証対象要素 CSS セレクターの初期値 */
const PROFILE_DEFAULT_CA_TARGET_CSS_SELECTOR = '.wp-block-post-title, .wp-block-post-content>*:not(.post-nav-links)';

/** 検証対象要素の存在する HTML の初期値 (%TITLE% → post title, %CONTENT% → WordPress post content after applying apply_filters()) */
const PROFILE_DEFAULT_CA_TARGET_HTML = <<<'EOD'
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body><h1 class="wp-block-post-title">%TITLE%</h1><div class="wp-block-post-content">%CONTENT%</div></body>
</html>
EOD;

/** CA Presentaion Type が External 時、静的ファイルを生成するディレクトリ */
const PROFILE_DEFAULT_CA_EXTERNAL_DIR = 'cas';

/** ログの出力設定が有効の時、ログファイルを生成するディレクトリ */
const PROFILE_DEFAULT_CA_LOG_DIR = 'ca-manager-log';
