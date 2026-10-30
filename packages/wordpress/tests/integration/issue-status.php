<?php
/**
 * Recording CA issuance failures for the post edit screen.
 *
 * @package Profile
 */

if ( ! defined( 'WP_CLI' ) || ! WP_CLI ) {
	return;
}

use const Profile\IssueStatus\FAILURE_META;
use const Profile\Delivery\BLOCKED_META;

/**
 * Check an issue status assertion.
 *
 * @param bool   $condition Condition.
 * @param string $message Failure message.
 * @throws RuntimeException When the condition fails.
 */
function profile_issue_status_assert( bool $condition, string $message ): void {
	if ( ! $condition ) {
		throw new RuntimeException( esc_html( $message ) );
	}
}

$previous_user = get_current_user_id();
$post_ids      = array();
$ca_response   = null;
$excluded      = array();
$filters       = array(
	'pre_option_profile_ca_server_hostname'     => static fn () => 'ca.example.net',
	'pre_option_profile_ca_issuer_id'           => static fn () => 'dns:example.test',
	'pre_option_profile_ca_server_admin_secret' => static fn () => 'test:secret',
	'pre_option_profile_ca_excluded_urls'       => static function () use ( &$excluded ) {
		return $excluded;
	},
	'pre_http_request'                          => static function () use ( &$ca_response ) {
		return $ca_response;
	},
);
foreach ( $filters as $hook => $callback ) {
	add_filter( $hook, $callback );
}
$sign_priority = has_action( 'transition_post_status', '\Profile\Issue\sign_post' );
remove_action( 'transition_post_status', '\Profile\Issue\sign_post', $sign_priority );

$response = static fn ( int $code, string $body ) => array(
	'headers'  => array(),
	'body'     => $body,
	'response' => array( 'code' => $code ),
	'cookies'  => array(),
);

try {
	$admins = get_users(
		array(
			'role'   => 'administrator',
			'number' => 1,
		)
	);
	profile_issue_status_assert( ! empty( $admins ), 'An administrator is required.' );
	wp_set_current_user( $admins[0]->ID );
	$published_id = wp_insert_post(
		array(
			'post_status'  => 'publish',
			'post_title'   => 'Issue status integration',
			'post_content' => 'Issue status test content.',
		),
		true
	);
	$post_ids[]   = $published_id;
	profile_issue_status_assert( is_int( $published_id ) && $published_id > 0, 'Could not create test post.' );

	// A failure is recorded with the message shown to the editor.
	$ca_response = $response( 500, '{"statusCode":500}' );
	$result      = \Profile\Issue\issue_post( get_post( $published_id ) );
	$failure     = \Profile\IssueStatus\get_failure( $published_id );
	profile_issue_status_assert( 'failed' === $result['status'], 'The CA server error should fail issuance.' );
	profile_issue_status_assert( null !== $failure && $result['message'] === $failure['message'], 'The failure should be recorded.' );
	$admin_message  = \Profile\IssueStatus\failure_message( $published_id, $failure, true );
	$editor_message = \Profile\IssueStatus\failure_message( $published_id, $failure, false );
	profile_issue_status_assert( str_contains( $admin_message, $result['message'] ), 'The notice should include the failure message.' );
	// Issuance suspends delivery before contacting the CA server, so the notice must not imply the CA is still served.
	profile_issue_status_assert( '' !== get_post_meta( $published_id, BLOCKED_META, true ) && str_contains( $admin_message, 'CAは配信していません' ), 'The notice should state that delivery is stopped.' );
	profile_issue_status_assert( str_contains( $admin_message, 'この記事を更新するとCAを再発行' ) && ! str_contains( $admin_message, '管理者に' ), 'Administrators should be told how to reissue.' );
	profile_issue_status_assert( str_contains( $editor_message, '管理者に、この記事とエラー内容を連絡' ), 'Editors should be told to contact an administrator.' );

	// A successful issuance clears the failure.
	$ca_response = $response( 200, '["test-ca"]' );
	$result      = \Profile\Issue\issue_post( get_post( $published_id ) );
	profile_issue_status_assert( 'success' === $result['status'], 'Issuance should succeed.' );
	profile_issue_status_assert( null === \Profile\IssueStatus\get_failure( $published_id ) && '' === get_post_meta( $published_id, FAILURE_META, true ), 'Success should clear the failure.' );

	// A skipped issuance keeps the latest failure, for example when an update failed but an older CA exists.
	$ca_response = $response( 500, '{"statusCode":500}' );
	\Profile\Issue\issue_post( get_post( $published_id ) );
	$result = \Profile\Issue\issue_post( get_post( $published_id ), true );
	profile_issue_status_assert( 'skipped' === $result['status'], 'Missing-only issuance should skip a post with CA.' );
	profile_issue_status_assert( null !== \Profile\IssueStatus\get_failure( $published_id ), 'Skipping should keep the latest failure.' );

	// A failure before suspension leaves the previously issued CA in delivery.
	delete_post_meta( $published_id, BLOCKED_META );
	profile_issue_status_assert( str_contains( \Profile\IssueStatus\failure_message( $published_id, \Profile\IssueStatus\get_failure( $published_id ), true ), '以前に発行したCAを配信しています' ), 'The notice should state that the previous CA is delivered.' );

	// Excluded posts do not show the failure, but the record is kept for when the exclusion is removed.
	$excluded = array( get_permalink( $published_id ) );
	profile_issue_status_assert( null === \Profile\IssueStatus\get_failure( $published_id ) && '' !== get_post_meta( $published_id, FAILURE_META, true ), 'Excluded posts should hide but keep the failure.' );
	$excluded = 'invalid';
	profile_issue_status_assert( null !== \Profile\IssueStatus\get_failure( $published_id ), 'An unreadable exclusion setting should not hide the failure.' );
	$excluded = array();
	profile_issue_status_assert( null !== \Profile\IssueStatus\get_failure( $published_id ), 'Removing the exclusion should show the failure again.' );

	// Failures are not shown for posts that are not published.
	$draft_id   = wp_insert_post(
		array(
			'post_status'  => 'draft',
			'post_title'   => 'Issue status draft',
			'post_content' => 'Draft content.',
		),
		true
	);
	$post_ids[] = $draft_id;
	update_post_meta(
		$draft_id,
		FAILURE_META,
		array(
			'message' => 'failure',
			'time'    => time(),
		)
	);
	profile_issue_status_assert( null === \Profile\IssueStatus\get_failure( $draft_id ), 'Drafts should not show failures.' );

	WP_CLI::success( 'Issue status checks passed: failure recorded, delivery state, next steps, success clears, skip keeps, exclusion hides, drafts hidden.' );
} finally {
	foreach ( $post_ids as $created_id ) {
		if ( is_int( $created_id ) && $created_id > 0 ) {
			wp_delete_post( $created_id, true );
		}
	}
	foreach ( $filters as $hook => $callback ) {
		remove_filter( $hook, $callback );
	}
	if ( false !== $sign_priority ) {
		add_action( 'transition_post_status', '\Profile\Issue\sign_post', $sign_priority, 3 );
	}
	wp_set_current_user( $previous_user );
}
