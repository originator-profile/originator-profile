<?php
/**
 * CA 更新時に CA サーバー側の CA が見つからない場合と、ページごとの CA の更新・削除の結合テスト.
 *
 * @package Profile
 */

if ( ! defined( 'WP_CLI' ) || ! WP_CLI ) {
	return;
}

function profile_update_assert( bool $condition, string $message ): void {
	if ( ! $condition ) {
		throw new RuntimeException( esc_html( $message ) );
	}
}

/**
 * CA ID (credentialSubject.id) だけを持つテスト用 JWT を作る.
 *
 * @param string $uuid CA ID.
 * @return string JWT.
 */
function profile_update_jwt( string $uuid ): string {
	// phpcs:ignore WordPress.PHP.DiscouragedPHPFunctions.obfuscation_base64_encode
	$payload = base64_encode( wp_json_encode( array( 'credentialSubject' => array( 'id' => $uuid ) ) ) );
	return 'header.' . rtrim( strtr( $payload, '+/', '-_' ), '=' ) . '.signature';
}

$previous_user = get_current_user_id();
$test_post_id  = 0;
$requests      = array();
$responses     = array();
$filters       = array();
$options       = array(
	'profile_ca_server_hostname'     => 'example.test',
	'profile_ca_issuer_id'           => 'dns:example.test',
	'profile_ca_server_admin_secret' => 'test:secret',
	'profile_ca_excluded_urls'       => array(),
);
foreach ( $options as $name => $value ) {
	$filters[ 'pre_option_' . $name ] = static fn () => $value;
}
// 発行リクエストの CA ID を記録し、用意した応答を順に返す.
$filters['pre_http_request'] = static function ( $pre, $args, $url ) use ( &$requests, &$responses ) {
	$body       = isset( $args['body'] ) ? json_decode( $args['body'], true ) : null;
	$requests[] = array(
		'method' => $args['method'],
		'url'    => $url,
		'id'     => $body['credentialSubject']['id'] ?? null,
	);
	$response   = array_shift( $responses ) ?? array( 200, '["unexpected-ca"]' );
	return array(
		'headers'  => array(),
		'body'     => $response[1],
		'response' => array( 'code' => $response[0] ),
		'cookies'  => array(),
	);
};
foreach ( $filters as $hook => $callback ) {
	add_filter( $hook, $callback, 10, 3 );
}
$sign_priority = has_action( 'transition_post_status', '\Profile\Issue\sign_post' );
remove_action( 'transition_post_status', '\Profile\Issue\sign_post', $sign_priority );

$old_a      = 'urn:uuid:aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
$old_b      = 'urn:uuid:bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
$not_found  = array( 404, '{"statusCode":404,"error":"Not Found","message":"Content Attestation not found."}' );
$issue_with = static function ( mixed $saved_cas, array $prepared ) use ( &$test_post_id, &$requests, &$responses ): array {
	update_post_meta( $test_post_id, '_profile_post_cas', $saved_cas );
	delete_post_meta( $test_post_id, \Profile\Delivery\BLOCKED_META );
	$requests  = array();
	$responses = $prepared;
	return \Profile\Issue\issue_post( get_post( $test_post_id ) );
};

try {
	$admins = get_users(
		array(
			'role'   => 'administrator',
			'number' => 1,
		)
	);
	profile_update_assert( ! empty( $admins ), 'An administrator is required.' );
	wp_set_current_user( $admins[0]->ID );
	$test_post_id = wp_insert_post(
		array(
			'post_status'  => 'publish',
			'post_title'   => 'CA update integration',
			'post_content' => 'Update test content.',
		),
		true
	);
	profile_update_assert( is_int( $test_post_id ) && $test_post_id > 0, 'Could not create test post.' );

	// 保存済みの CA ID で更新できる場合は、そのまま 1 回で終わる.
	$result = $issue_with( array( profile_update_jwt( $old_a ) ), array( array( 200, '["updated-ca"]' ) ) );
	profile_update_assert( 'success' === $result['status'], 'Updating an existing CA failed.' );
	profile_update_assert( 1 === count( $requests ) && $old_a === $requests[0]['id'], 'The saved CA ID was not used for the update.' );
	profile_update_assert( array( array( 'updated-ca' ) ) === get_post_meta( $test_post_id, '_profile_post_cas', true ), 'The updated CA was not saved.' );

	// CA サーバー側で CA が削除されていた場合は、CA ID なしで新規登録し直す.
	$result = $issue_with( array( profile_update_jwt( $old_a ) ), array( $not_found, array( 200, '["new-ca"]' ) ) );
	profile_update_assert( 'success' === $result['status'], 'A missing CA on the server was not registered again.' );
	profile_update_assert( 2 === count( $requests ), 'Unexpected request count for a missing CA.' );
	profile_update_assert( $old_a === $requests[0]['id'] && null === $requests[1]['id'], 'The retry did not drop the missing CA ID.' );
	profile_update_assert( 'POST' === $requests[1]['method'] && str_ends_with( $requests[1]['url'], '/ca' ), 'The retry was not a new registration.' );
	profile_update_assert( array( array( 'new-ca' ) ) === get_post_meta( $test_post_id, '_profile_post_cas', true ), 'The newly registered CA was not saved.' );
	profile_update_assert( ! get_post_meta( $test_post_id, \Profile\Delivery\BLOCKED_META, true ), 'Delivery was not resumed after re-registration.' );

	// 新規登録でも失敗した場合は、既存 CA を保持したまま失敗にする.
	$saved  = array( profile_update_jwt( $old_a ) );
	$result = $issue_with( $saved, array( $not_found, array( 500, 'error' ) ) );
	profile_update_assert( 'failed' === $result['status'] && 2 === count( $requests ), 'A failed re-registration was not reported.' );
	profile_update_assert( get_post_meta( $test_post_id, '_profile_post_cas', true ) === $saved, 'A failed re-registration overwrote the saved CA.' );

	// 404 以外の失敗では、別の CA を作らないよう新規登録し直さない.
	$result = $issue_with( $saved, array( array( 500, 'error' ) ) );
	profile_update_assert( 'failed' === $result['status'] && 1 === count( $requests ), 'A non-404 update failure was retried.' );
	profile_update_assert( get_post_meta( $test_post_id, '_profile_post_cas', true ) === $saved, 'A non-404 failure overwrote the saved CA.' );

	// CA ID なしの新規登録が 404 になった場合も繰り返さない.
	$result = $issue_with( '', array( $not_found ) );
	profile_update_assert( 'failed' === $result['status'] && 1 === count( $requests ) && null === $requests[0]['id'], 'A 404 on a new registration was retried.' );

	// 分割記事は、ページごとに保存済みの CA ID で更新する.
	wp_update_post(
		array(
			'ID'           => $test_post_id,
			'post_content' => 'First page<!--nextpage-->Second page',
		)
	);
	$result = $issue_with(
		array( array( profile_update_jwt( $old_a ) ), array( profile_update_jwt( $old_b ) ) ),
		array( array( 200, '["page-1"]' ), $not_found, array( 200, '["page-2"]' ) )
	);
	profile_update_assert( 'success' === $result['status'], 'Updating a paginated post failed.' );
	profile_update_assert( 3 === count( $requests ), 'Unexpected request count for a paginated post.' );
	profile_update_assert( $old_a === $requests[0]['id'] && $old_b === $requests[1]['id'] && null === $requests[2]['id'], 'Each page was not updated with its own CA ID.' );
	profile_update_assert( array( array( 'page-1' ), array( 'page-2' ) ) === get_post_meta( $test_post_id, '_profile_post_cas', true ), 'The paginated CA was not saved per page.' );

	// ページが増えた場合、追加ページは新規登録する.
	wp_update_post(
		array(
			'ID'           => $test_post_id,
			'post_content' => 'First page<!--nextpage-->Second page<!--nextpage-->Third page',
		)
	);
	$result = $issue_with(
		array( array( profile_update_jwt( $old_a ) ), array( profile_update_jwt( $old_b ) ) ),
		array( array( 200, '["page-1"]' ), array( 200, '["page-2"]' ), array( 200, '["page-3"]' ) )
	);
	profile_update_assert( 'success' === $result['status'] && 3 === count( $requests ), 'Adding a page failed.' );
	profile_update_assert( null === $requests[2]['id'], 'The added page reused another CA ID.' );

	// 非公開にした場合は、全ページの CA を削除して保存済み CAS を消す.
	$paginated = array( array( profile_update_jwt( $old_a ) ), array( profile_update_jwt( $old_b ) ) );
	update_post_meta( $test_post_id, '_profile_post_cas', $paginated );
	$requests  = array();
	$responses = array( array( 204, '' ), array( 204, '' ) );
	\Profile\Issue\private_post( 'draft', 'publish', get_post( $test_post_id ) );
	profile_update_assert( 2 === count( $requests ), 'Not every page CA was deleted on unpublish.' );
	profile_update_assert( 'DELETE' === $requests[0]['method'] && str_ends_with( $requests[0]['url'], "/ca/{$old_a}" ), 'The first page CA was not deleted.' );
	profile_update_assert( 'DELETE' === $requests[1]['method'] && str_ends_with( $requests[1]['url'], "/ca/{$old_b}" ), 'The second page CA was not deleted.' );
	profile_update_assert( '' === get_post_meta( $test_post_id, '_profile_post_cas', true ), 'The saved CAS was not removed on unpublish.' );

	// 一部のページの削除に失敗しても、残りのページの削除を続ける.
	update_post_meta( $test_post_id, '_profile_post_cas', $paginated );
	$requests  = array();
	$responses = array( array( 500, 'error' ), array( 204, '' ) );
	profile_update_assert( ! \Profile\Issue\delete_ca( 'test:secret', get_post( $test_post_id ) ), 'A partial deletion failure was reported as success.' );
	profile_update_assert( 2 === count( $requests ) && str_ends_with( $requests[1]['url'], "/ca/{$old_b}" ), 'Deletion stopped after the first failure.' );

	// 修正前の不具合で全ページが同じ CA ID の場合は、1 回だけ削除する.
	update_post_meta( $test_post_id, '_profile_post_cas', array( array( profile_update_jwt( $old_a ) ), array( profile_update_jwt( $old_a ) ) ) );
	$requests  = array();
	$responses = array( array( 204, '' ) );
	profile_update_assert( \Profile\Issue\delete_ca( 'test:secret', get_post( $test_post_id ) ) && 1 === count( $requests ), 'A shared CA ID was deleted more than once.' );

	WP_CLI::success( 'CA update checks passed: existing update, missing CA re-registration, failed re-registration, non-404 failure, new registration 404, per-page CA IDs, added page and per-page deletion.' );
} finally {
	$responses = array();
	if ( is_int( $test_post_id ) && $test_post_id > 0 ) {
		wp_delete_post( $test_post_id, true );
	}
	foreach ( $filters as $hook => $callback ) {
		remove_filter( $hook, $callback, 10 );
	}
	if ( false !== $sign_priority ) {
		add_action( 'transition_post_status', '\Profile\Issue\sign_post', $sign_priority, 3 );
	}
	wp_set_current_user( $previous_user );
}
