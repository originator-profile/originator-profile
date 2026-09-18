<?php
/** CA一括発行の対象選択・進捗管理。 */

namespace Profile\Bulk;

const JOB_OPTION = 'profile_ca_bulk_job';

/** AJAXハンドラーを登録する。 */
function init() {
	\add_action( 'wp_ajax_profile_ca_bulk', __NAMESPACE__ . '\\ajax' );
}

/**
 * フィルターを検証する。
 *
 * @param array $input 入力。
 * @return array|\WP_Error フィルターまたはエラー。
 */
function filters( array $input ) {
	$result = array(
		'post_type' => $input['post_type'] ?? 'all',
		'category'  => $input['category'] ?? '0',
		'date_from' => $input['date_from'] ?? '',
		'date_to'   => $input['date_to'] ?? '',
		'mode'      => $input['mode'] ?? 'missing',
	);
	foreach ( $result as $value ) {
		if ( ! is_scalar( $value ) ) {
			return new \WP_Error( 'invalid_filters', '対象条件が不正です。' );
		}
	}
	if ( ! in_array( $result['post_type'], array( 'all', 'post', 'page' ), true ) || ! in_array( $result['mode'], array( 'missing', 'all' ), true ) || ! ctype_digit( (string) $result['category'] ) ) {
		return new \WP_Error( 'invalid_filters', '対象条件が不正です。' );
	}
	$result['category'] = (int) $result['category'];
	if ( $result['category'] && ! \term_exists( $result['category'], 'category' ) ) {
		return new \WP_Error( 'invalid_category', 'カテゴリが存在しません。' );
	}
	foreach ( array( 'date_from', 'date_to' ) as $key ) {
		$value = (string) $result[ $key ];
		if ( '' !== $value && ( ! preg_match( '/^(\d{4})-(\d{2})-(\d{2})$/D', $value, $parts ) || ! checkdate( (int) $parts[2], (int) $parts[3], (int) $parts[1] ) ) ) {
			return new \WP_Error( 'invalid_date', '日付は有効な年月日で指定してください。' );
		}
	}
	if ( $result['date_from'] && $result['date_to'] && $result['date_from'] > $result['date_to'] ) {
		return new \WP_Error( 'invalid_date', '開始日は終了日以前にしてください。' );
	}
	return $result;
}

/**
 * ID範囲によるカーソル条件。
 *
 * @param string    $where SQL条件。
 * @param \WP_Query $query クエリ。
 * @return string SQL条件。
 */
function cursor_where( $where, $query ) {
	$range = $query->get( 'profile_ca_bulk_range' );
	if ( is_array( $range ) ) {
		global $wpdb;
		$where .= $wpdb->prepare( " AND {$wpdb->posts}.ID > %d AND {$wpdb->posts}.ID <= %d", $range[0], $range[1] );
	}
	return $where;
}

/**
 * 投稿本文を全件読み込まず対象を検索する。
 *
 * @param array $selection フィルター。
 * @param int   $after 処理済みID。
 * @param int   $maximum 開始時点の最大ID。
 * @param int   $limit 件数。
 * @param bool  $count 総件数を取得するか。
 * @return \WP_Query 検索結果。
 */
function candidates( array $selection, int $after = 0, int $maximum = PHP_INT_MAX, int $limit = 20, bool $count = false ): \WP_Query {
	$args = array(
		'post_type'             => 'all' === $selection['post_type'] ? array( 'post', 'page' ) : $selection['post_type'],
		'post_status'           => 'publish',
		'posts_per_page'        => $limit,
		'fields'                => 'ids',
		'orderby'               => 'ID',
		'order'                 => 'ASC',
		'no_found_rows'         => ! $count,
		'ignore_sticky_posts'   => true,
		'profile_ca_bulk_range' => array( $after, $maximum ),
	);
	if ( $selection['category'] ) {
		$args['cat'] = $selection['category'];
	}
	$date = array( 'inclusive' => true );
	if ( $selection['date_from'] ) {
		$date['after'] = $selection['date_from'] . ' 00:00:00';
	}
	if ( $selection['date_to'] ) {
		$date['before'] = $selection['date_to'] . ' 23:59:59';
	}
	if ( count( $date ) > 1 ) {
		$args['date_query'] = array( $date );
	}
	\add_filter( 'posts_where', __NAMESPACE__ . '\\cursor_where', 10, 2 );
	try {
		return new \WP_Query( $args );
	} finally {
		\remove_filter( 'posts_where', __NAMESPACE__ . '\\cursor_where', 10 );
	}
}

/**
 * 通信せずに発行対象を判定する。
 *
 * @param int   $post_id 投稿ID。
 * @param array $selection フィルター。
 * @return array 判定。
 */
function eligibility( int $post_id, array $selection ): array {
	$post = \get_post( $post_id );
	if ( ! $post || 'publish' !== $post->post_status || ! in_array( $post->post_type, array( 'post', 'page' ), true ) ) {
		return array(
			'status'  => 'skipped',
			'message' => '公開済みの投稿・固定ページではありません。',
		);
	}
	if ( ! \current_user_can( 'edit_post', $post_id ) ) {
		return array(
			'status'  => 'skipped',
			'message' => 'この記事を編集する権限がありません。',
		);
	}
	try {
		$rules = \get_option( 'profile_ca_excluded_urls', array() );
		$url   = \get_permalink( $post );
		if ( ! is_array( $rules ) || ! is_string( $url ) || '' === $url ) {
			return array(
				'status'  => 'failed',
				'message' => '公開URLまたは除外設定を確認してください。',
			);
		}
		if ( \Profile\Exclusion\is_excluded( $url, $rules ) ) {
			return array(
				'status'  => 'skipped',
				'message' => 'URL除外ルールに一致します。',
			);
		}
	} catch ( \InvalidArgumentException $error ) {
		return array(
			'status'  => 'failed',
			'message' => '公開URLまたは除外設定を確認してください。',
		);
	}
	if ( 'missing' === $selection['mode'] && \Profile\Issue\has_post_cas( $post_id ) ) {
		return array(
			'status'  => 'skipped',
			'message' => '発行済みCAがあるためスキップします。',
		);
	}
	return array(
		'status'  => 'ready',
		'message' => 'all' === $selection['mode'] ? 'CAを発行・再発行します。' : '未発行記事としてCAを発行します。',
	);
}

/**
 * 表示用の結果行を作る。
 *
 * @param int   $post_id 投稿ID。
 * @param array $result 結果。
 * @return array 行。
 */
function row( int $post_id, array $result ): array {
	$url = \get_permalink( $post_id );
	return array_merge(
		$result,
		array(
			'id'    => $post_id,
			'title' => \get_the_title( $post_id ),
			'url'   => is_string( $url ) ? $url : '',
		)
	);
}

/**
 * 対象候補の件数と先頭20件を取得する。
 *
 * @param array $selection 検証済みフィルター。
 * @return array プレビュー。
 */
function preview( array $selection ): array {
	$query  = candidates( $selection, 0, PHP_INT_MAX, 20, true );
	$sample = array();
	foreach ( $query->posts as $post_id ) {
		$sample[] = row( (int) $post_id, eligibility( (int) $post_id, $selection ) );
	}
	return array(
		'count'  => (int) $query->found_posts,
		'sample' => $sample,
	);
}

/**
 * 進捗を永続化する。
 *
 * @param array $job ジョブ。
 * @return void
 * @throws \RuntimeException When progress cannot be saved.
 */
function save( array $job ) {
	if ( ! \update_option( JOB_OPTION, $job, false ) && \get_option( JOB_OPTION ) !== $job ) {
		throw new \RuntimeException( '進捗の保存に失敗しました。' );
	}
}

/**
 * サイト単位の排他制御。接続終了時にもMySQLがロックを解放する。
 *
 * @param callable $callback 排他区間。
 * @return mixed 結果。
 */
function locked( callable $callback ) {
	global $wpdb;
	$name = 'ca-bulk-' . md5( DB_NAME . $wpdb->prefix );
	// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Connection-scoped advisory lock cannot be cached.
	$acquired = $wpdb->get_var( $wpdb->prepare( 'SELECT GET_LOCK(%s, 0)', $name ) );
	if ( '1' !== (string) $acquired ) {
		return new \WP_Error( 'busy', '別の一括処理が実行中です。少し待って再開してください。' );
	}
	try {
		return $callback();
	} catch ( \Throwable $error ) {
		\Profile\Debug\debug( 'Bulk CA: ' . $error->getMessage() );
		return new \WP_Error( 'bulk_failed', '処理を完了できませんでした。「状態を再取得」を押してください。' );
	} finally {
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Release the connection-scoped lock.
		$wpdb->get_var( $wpdb->prepare( 'SELECT RELEASE_LOCK(%s)', $name ) );
	}
}

/**
 * 一括処理を開始する。
 *
 * @param array $selection 検証済みフィルター。
 * @return array|\WP_Error ジョブ。
 */
function start( array $selection ) {
	$old = \get_option( JOB_OPTION );
	if ( is_array( $old ) && 'running' === $old['status'] ) {
		return new \WP_Error( 'active_job', '未完了の処理があります。再開または終了してから開始してください。' );
	}
	if ( ! \get_option( 'profile_ca_issuer_id' ) || ! \get_option( 'profile_ca_server_admin_secret' ) ) {
		return new \WP_Error( 'configuration', 'CA Manager設定画面で発行者とCAサーバーの認証情報を設定してください。対象確認は設定なしでも利用できます。' );
	}
	$maximum = new \WP_Query(
		array(
			'post_type'      => array( 'post', 'page' ),
			'post_status'    => 'publish',
			'fields'         => 'ids',
			'posts_per_page' => 1,
			'orderby'        => 'ID',
			'order'          => 'DESC',
			'no_found_rows'  => true,
		)
	);
	$maximum = $maximum->posts ? (int) $maximum->posts[0] : 0;
	$query   = candidates( $selection, 0, $maximum, 1, true );
	$job     = array(
		'id'         => \wp_generate_uuid4(),
		'status'     => $query->found_posts ? 'running' : 'completed',
		'filters'    => $selection,
		'max_id'     => $maximum,
		'cursor'     => 0,
		'pending'    => 0,
		'total'      => (int) $query->found_posts,
		'processed'  => 0,
		'counts'     => array(
			'success' => 0,
			'failed'  => 0,
			'skipped' => 0,
		),
		'failed_ids' => array(),
		'retry_ids'  => array(),
		'retrying'   => false,
		'log'        => array(),
	);
	save( $job );
	return $job;
}

/**
 * 処理結果を記録する。
 *
 * @param array $job ジョブ。
 * @param int   $post_id 投稿ID。
 * @param array $result 結果。
 * @return array 更新後ジョブ。
 */
function record( array $job, int $post_id, array $result ): array {
	++$job['processed'];
	++$job['counts'][ $result['status'] ];
	if ( 'failed' === $result['status'] ) {
		$job['failed_ids'][] = $post_id;
		$job['failed_ids']   = array_values( array_unique( $job['failed_ids'] ) );
	}
	$job['log'][]   = row( $post_id, $result );
	$job['log']     = array_slice( $job['log'], -100 );
	$job['pending'] = 0;
	save( $job );
	return $job;
}

/**
 * テンプレートタグやショートコードが対象記事を参照できる状態で発行する。
 *
 * @param int  $post_id 投稿ID。
 * @param bool $only_missing 未発行のみ。
 * @return array 結果。
 */
function issue_candidate( int $post_id, bool $only_missing ): array {
	$context_keys = array( 'post', 'id', 'authordata', 'currentday', 'currentmonth', 'page', 'pages', 'multipage', 'more', 'numpages' );
	$previous     = array();
	foreach ( $context_keys as $key ) {
		if ( array_key_exists( $key, $GLOBALS ) ) {
			$previous[ $key ] = $GLOBALS[ $key ];
		}
	}
	try {
		$target_post = \get_post( $post_id );
		if ( ! $target_post ) {
			return array(
				'status'  => 'skipped',
				'message' => '記事が削除されています。',
			);
		}
		// phpcs:ignore WordPress.WP.GlobalVariablesOverride -- Template tags require this context; all globals are restored in finally.
		$GLOBALS['post'] = $target_post;
		\setup_postdata( $target_post );
		return \Profile\Issue\issue_post( $target_post, $only_missing );
	} finally {
		foreach ( $context_keys as $key ) {
			if ( array_key_exists( $key, $previous ) ) {
				$GLOBALS[ $key ] = $previous[ $key ];
			} else {
				unset( $GLOBALS[ $key ] );
			}
		}
	}
}

/**
 * 1リクエストで1記事を処理する。
 *
 * @param array $job ジョブ。
 * @return array ジョブ。
 */
function step( array $job ): array {
	if ( 'running' !== $job['status'] ) {
		return $job;
	}
	if ( $job['pending'] ) {
		return record(
			$job,
			(int) $job['pending'],
			array(
				'status'  => 'failed',
				'message' => '前回の処理が中断され、発行結果を確認できません。CAサーバー側の結果を確認してから再試行してください。',
			)
		);
	}
	if ( $job['retrying'] ) {
		$post_id = array_shift( $job['retry_ids'] );
	} else {
		$query   = candidates( $job['filters'], $job['cursor'], $job['max_id'], 1 );
		$post_id = $query->posts[0] ?? null;
		if ( $post_id ) {
			$job['cursor'] = (int) $post_id;
		}
	}
	if ( ! $post_id ) {
		$job['status'] = 'completed';
		save( $job );
		return $job;
	}
	$post_id        = (int) $post_id;
	$job['pending'] = $post_id;
	save( $job );
	$current = candidates( $job['filters'], $post_id - 1, $post_id, 1 );
	$result  = $current->posts ? eligibility( $post_id, $job['filters'] ) : array(
		'status'  => 'skipped',
		'message' => '記事が現在の対象条件から外れたためスキップします。',
	);
	if ( 'ready' === $result['status'] ) {
		$result = issue_candidate( $post_id, 'missing' === $job['filters']['mode'] );
	}
	return record( $job, $post_id, $result );
}

/**
 * 既存ジョブを更新する。呼び出しはロック内に限定する。
 *
 * @param string $operation 操作。
 * @param string $job_id クライアントが表示しているジョブID。
 * @return array|\WP_Error ジョブ。
 */
function change( string $operation, string $job_id ) {
	$job = \get_option( JOB_OPTION );
	if ( ! is_array( $job ) || $job['id'] !== $job_id ) {
		return new \WP_Error( 'stale_job', '処理が切り替わっています。「状態を再取得」を押してください。' );
	}
	if ( 'step' === $operation ) {
		return step( $job );
	}
	if ( 'cancel' === $operation ) {
		$job['status'] = 'cancelled';
		if ( $job['pending'] ) {
			return record(
				$job,
				(int) $job['pending'],
				array(
					'status'  => 'failed',
					'message' => '中断した処理の発行結果を確認できません。',
				)
			);
		}
	} elseif ( 'retry' === $operation ) {
		if ( 'completed' !== $job['status'] || empty( $job['failed_ids'] ) ) {
			return new \WP_Error( 'invalid_retry', '処理完了後に失敗した記事だけを再試行できます。' );
		}
		$job['retry_ids']        = $job['failed_ids'];
		$job['failed_ids']       = array();
		$job['processed']       -= $job['counts']['failed'];
		$job['counts']['failed'] = 0;
		$job['retrying']         = true;
		$job['status']           = 'running';
	}
	save( $job );
	return $job;
}

/** 権限・nonceを検証してAJAX操作を実行する。 */
function ajax() {
	if ( ! \current_user_can( 'manage_options' ) ) {
		\wp_send_json_error( array( 'message' => '権限がありません。' ), 403 );
	}
	\check_ajax_referer( 'profile_ca_bulk', 'nonce' );
	// All request fields are validated below before use; preserve invalid values for rejection.
	// phpcs:ignore WordPress.Security.ValidatedSanitizedInput.InputNotSanitized
	$input     = \wp_unslash( $_POST );
	$operation = $input['operation'] ?? '';
	if ( ! is_string( $operation ) || ! in_array( $operation, array( 'status', 'preview', 'start', 'step', 'retry', 'cancel' ), true ) ) {
		\wp_send_json_error( array( 'message' => '操作が不正です。' ), 400 );
	}
	if ( 'status' === $operation ) {
		$result = \get_option( JOB_OPTION, null );
	} elseif ( in_array( $operation, array( 'preview', 'start' ), true ) ) {
		$selection = filters( $input );
		if ( \is_wp_error( $selection ) ) {
			$result = $selection;
		} elseif ( 'preview' === $operation ) {
			$result = preview( $selection );
		} elseif ( 'all' === $selection['mode'] && '1' !== ( $input['confirm_reissue'] ?? '' ) ) {
			$result = new \WP_Error( 'confirm', '発行済みCAの再発行を確認してください。' );
		} else {
			$result = locked( static fn() => start( $selection ) );
		}
	} else {
		$job_id = $input['job_id'] ?? '';
		$result = is_string( $job_id ) ? locked( static fn() => change( $operation, $job_id ) ) : new \WP_Error( 'invalid_job', '処理IDが不正です。' );
	}
	if ( \is_wp_error( $result ) ) {
		\wp_send_json_error( array( 'message' => $result->get_error_message() ), 'busy' === $result->get_error_code() ? 409 : 400 );
	}
	\wp_send_json_success( $result );
}
