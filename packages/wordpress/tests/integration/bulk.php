<?php
/**
 * Bulk issuance integration tests with intercepted HTTP requests.
 *
 * @package Profile
 */

if ( ! defined( 'WP_CLI' ) || ! WP_CLI ) {
	return;
}

require_once __DIR__ . '/../../includes/bulk.php';

/**
 * Check an integration assertion.
 *
 * @param bool   $condition Condition.
 * @param string $message Description.
 * @throws RuntimeException When the condition fails.
 */
function profile_bulk_assert( bool $condition, string $message ) {
	if ( ! $condition ) {
		throw new RuntimeException( esc_html( $message ) );
	}
}

$original_job   = get_option( \Profile\Bulk\JOB_OPTION, null );
$original_user  = get_current_user_id();
$administrators = get_users(
	array(
		'role'   => 'administrator',
		'number' => 1,
	)
);
wp_set_current_user( $administrators[0]->ID );
$option_values  = array(
	'profile_ca_server_hostname'     => 'example.test',
	'profile_ca_issuer_id'           => 'dns:example.test',
	'profile_ca_server_admin_secret' => 'test:secret',
	'profile_ca_excluded_urls'       => array(),
);
$option_filters = array();
$requests       = array();
$fail_http      = false;
$spy            = static function ( $pre, $args, $url ) use ( &$requests, &$fail_http ) {
	$requests[] = array(
		'url'  => $url,
		'body' => $args['body'] ?? '',
	);
	if ( $fail_http ) {
		return new WP_Error( 'test_failure', 'Simulated connection failure.' );
	}
	return array(
		'headers'  => array(),
		'body'     => '["test-ca"]',
		'response' => array(
			'code'    => 200,
			'message' => 'OK',
		),
		'cookies'  => array(),
	);
};
$post_ids       = array();
$term_id        = 0;
$checks         = array();
try {
	add_filter( 'pre_http_request', $spy, 10, 3 );
	foreach ( $option_values as $name => $value ) {
		$option_filters[ $name ] = static function () use ( &$option_values, $name ) {
			return $option_values[ $name ];
		};
		add_filter( 'pre_option_' . $name, $option_filters[ $name ] );
	}
	$created_term = wp_insert_term( 'Bulk test ' . wp_generate_uuid4(), 'category' );
	profile_bulk_assert( ! is_wp_error( $created_term ), 'Create category' );
	$term_id   = (int) $created_term['term_id'];
	$make_post = static function ( string $type = 'post', string $date = '2025-01-15 12:00:00', string $content = '<p>Bulk test.</p>' ) use ( &$post_ids, $term_id ): int {
		$id = wp_insert_post(
			array(
				'post_title'    => 'CA bulk test ' . wp_generate_uuid4(),
				'post_type'     => $type,
				'post_status'   => 'draft',
				'post_date'     => $date,
				'post_content'  => $content,
				'post_category' => array( $term_id ),
			),
			true
		);
		profile_bulk_assert( ! is_wp_error( $id ), 'Create post' );
		$post_ids[] = (int) $id;
		// Publish without issuing test setup requests.
		remove_action( 'transition_post_status', '\Profile\Issue\sign_post', 10 );
		try {
			wp_update_post(
				array(
					'ID'            => $id,
					'post_status'   => 'publish',
					'post_date'     => $date,
					'post_date_gmt' => get_gmt_from_date( $date ),
					'edit_date'     => true,
				)
			);
		} finally {
			add_action( 'transition_post_status', '\Profile\Issue\sign_post', 10, 3 );
		}
		return (int) $id;
	};
	add_shortcode( 'bulk_test_context', static fn() => 'context-post-' . get_the_ID() );
	$missing  = $make_post( 'post', '2025-01-15 12:00:00', '<p>[bulk_test_context]</p>' );
	$existing = $make_post();
	$excluded = $make_post();
	$page_id  = $make_post( 'page' );
	$outside  = $make_post( 'post', '2024-01-15 12:00:00' );
	$old_cas  = array( array( 'existing-ca' ) );
	update_post_meta( $existing, '_profile_post_cas', $old_cas );
	$option_values['profile_ca_excluded_urls'] = array( get_permalink( $excluded ) );
	$selection                                 = \Profile\Bulk\filters(
		array(
			'category'  => (string) $term_id,
			'date_from' => '2025-01-01',
			'date_to'   => '2025-12-31',
		)
	);
	profile_bulk_assert( ! is_wp_error( $selection ), 'Valid filters' );
	foreach ( array(
		array( 'date_from' => '2025-02-30' ),
		array(
			'date_from' => '2025-12-31',
			'date_to'   => '2025-01-01',
		),
		array( 'mode' => 'bad' ),
		array( 'category' => array() ),
	) as $bad ) {
		profile_bulk_assert( is_wp_error( \Profile\Bulk\filters( $bad ) ), 'Invalid filters rejected' );
	}
	$preview_result = \Profile\Bulk\preview( $selection );
	profile_bulk_assert( 3 === $preview_result['count'], 'Date/category preview only includes three posts: ' . wp_json_encode( $preview_result ) );
	profile_bulk_assert( array( 'ready', 'skipped', 'skipped' ) === array_column( $preview_result['sample'], 'status' ), 'Preview honors old CAS and exclusions' );
	profile_bulk_assert( empty( $requests ), 'Preview makes no requests' );
	$checks[] = 'filters and preview';

	delete_option( \Profile\Bulk\JOB_OPTION );
	$job = \Profile\Bulk\locked( static fn() => \Profile\Bulk\start( $selection ) );
	profile_bulk_assert( ! is_wp_error( $job ), 'Start job' );
	profile_bulk_assert( is_wp_error( \Profile\Bulk\locked( static fn() => \Profile\Bulk\start( $selection ) ) ), 'Second start blocked' );
	profile_bulk_assert( is_wp_error( \Profile\Bulk\change( 'step', 'stale-id' ) ), 'Stale tab blocked' );
	$new_post = $make_post();
	update_post_meta( $new_post, '_profile_post_cas', array( array() ) );
	profile_bulk_assert( ! \Profile\Issue\has_post_cas( $new_post ), 'Empty nested CAS remains unissued' );
	$before = get_post( $missing );
	for ( $i = 0; $i < 10 && 'running' === $job['status']; ++$i ) {
		$job = \Profile\Bulk\locked( static fn() => \Profile\Bulk\change( 'step', $job['id'] ) );
	}
	profile_bulk_assert( 'completed' === $job['status'] && 1 === $job['counts']['success'] && 2 === $job['counts']['skipped'], 'One issuance, two skips' );
	profile_bulk_assert( 1 === count( $requests ), 'Only one CA request' );
	$issued_payload = json_decode( $requests[0]['body'], true );
	profile_bulk_assert( str_contains( $issued_payload['target'][0]['content'], 'context-post-' . $missing ), 'Shortcode uses the issued post context' );
	profile_bulk_assert( ! \Profile\Issue\has_post_cas( $new_post ), 'New posts outside cursor upper bound' );
	profile_bulk_assert( get_post_meta( $existing, '_profile_post_cas', true ) === $old_cas, 'Existing CAS preserved' );
	$after = get_post( $missing );
	profile_bulk_assert( $before->post_content === $after->post_content && $before->post_modified === $after->post_modified && $before->post_author === $after->post_author, 'Post data unchanged' );
	$checks[] = 'cursor, resume, existing CA, exclusion and post data';

	$selection['mode'] = 'all';
	$job               = \Profile\Bulk\locked( static fn() => \Profile\Bulk\start( $selection ) );
	$fail_http         = true;
	$job               = \Profile\Bulk\locked( static fn() => \Profile\Bulk\change( 'step', $job['id'] ) );
	profile_bulk_assert( 1 === $job['counts']['failed'], 'HTTP failure reported' );
	profile_bulk_assert( \Profile\Issue\has_post_cas( $missing ), 'Failed reissue preserves CAS' );
	$fail_http = false;
	for ( $i = 0; $i < 10 && 'running' === $job['status']; ++$i ) {
		$job = \Profile\Bulk\locked( static fn() => \Profile\Bulk\change( 'step', $job['id'] ) );
	}
	$job = \Profile\Bulk\locked( static fn() => \Profile\Bulk\change( 'retry', $job['id'] ) );
	for ( $i = 0; $i < 10 && 'running' === $job['status']; ++$i ) {
		$job = \Profile\Bulk\locked( static fn() => \Profile\Bulk\change( 'step', $job['id'] ) );
	}
	profile_bulk_assert( 0 === $job['counts']['failed'] && 3 === $job['counts']['success'] && 1 === $job['counts']['skipped'], 'Retry only failed articles' );
	$checks[] = 'reissue failure and retry';

	$split = $make_post( 'post', '2025-01-15 12:00:00', '<p>One.</p><!--nextpage--><p>Two.</p>' );
	update_post_meta( $split, '_profile_post_cas', $old_cas );
	$partial_calls = 0;
	$partial       = static function ( $pre ) use ( &$partial_calls ) {
		++$partial_calls;
		return 2 === $partial_calls ? new WP_Error( 'partial', 'Second page fails' ) : $pre;
	};
	add_filter( 'pre_http_request', $partial, 20, 3 );
	try {
		$result = \Profile\Issue\issue_post( get_post( $split ) );
	} finally {
		remove_filter( 'pre_http_request', $partial, 20 );
	}
	profile_bulk_assert( 'failed' === $result['status'] && get_post_meta( $split, '_profile_post_cas', true ) === $old_cas, 'Partial failure preserves whole CAS' );
	$checks[] = 'split article partial failure';

	$edit_once           = false;
	$edit_during_request = static function ( $pre ) use ( $existing, &$edit_once ) {
		if ( ! $edit_once ) {
			$edit_once = true;
			remove_action( 'transition_post_status', '\Profile\Issue\sign_post', 10 );
			try {
				wp_update_post(
					array(
						'ID'         => $existing,
						'post_title' => 'Updated during issuance',
					)
				);
			} finally {
				add_action( 'transition_post_status', '\Profile\Issue\sign_post', 10, 3 );
			}
		}
		return $pre;
	};
	$cas_before_edit     = get_post_meta( $existing, '_profile_post_cas', true );
	add_filter( 'pre_http_request', $edit_during_request, 20 );
	try {
		$result = \Profile\Issue\issue_post( get_post( $existing ) );
	} finally {
		remove_filter( 'pre_http_request', $edit_during_request, 20 );
	}
	profile_bulk_assert( 'failed' === $result['status'] && get_post_meta( $existing, '_profile_post_cas', true ) === $cas_before_edit, 'Concurrent edit does not store stale CAS' );
	$checks[] = 'concurrent post edit';


	$job            = \Profile\Bulk\locked( static fn() => \Profile\Bulk\start( $selection ) );
	$job['pending'] = $missing;
	$job['cursor']  = $missing;
	\Profile\Bulk\save( $job );
	$request_count = count( $requests );
	$job           = \Profile\Bulk\locked( static fn() => \Profile\Bulk\change( 'step', $job['id'] ) );
	profile_bulk_assert( 1 === $job['counts']['failed'] && count( $requests ) === $request_count, 'Interrupted request not automatically resent' );
	$job = \Profile\Bulk\locked( static fn() => \Profile\Bulk\change( 'cancel', $job['id'] ) );
	profile_bulk_assert( 'cancelled' === $job['status'], 'Cancel' );
	$checks[] = 'interruption recovery and cancel';

	$connection = new wpdb( DB_USER, DB_PASSWORD, DB_NAME, DB_HOST );
	$lock_name  = 'ca-bulk-' . md5( DB_NAME . $GLOBALS['wpdb']->prefix );
	$connection->get_var( $connection->prepare( 'SELECT GET_LOCK(%s, 0)', $lock_name ) );
	try {
		profile_bulk_assert( is_wp_error( \Profile\Bulk\locked( static fn() => true ) ), 'Concurrent request blocked' );
	} finally {
		$connection->get_var( $connection->prepare( 'SELECT RELEASE_LOCK(%s)', $lock_name ) );
		$connection->close();
	}
	$checks[]                                        = 'concurrent processing blocked';
	$option_values['profile_ca_server_admin_secret'] = '';
	profile_bulk_assert( is_wp_error( \Profile\Bulk\locked( static fn() => \Profile\Bulk\start( $selection ) ) ), 'Missing credentials cannot start issuance' );
	$checks[] = 'missing credentials';
	WP_CLI::success( 'Bulk integration passed: ' . implode( ', ', $checks ) );
} finally {
	foreach ( $post_ids as $cleanup_id ) {
		wp_delete_post( $cleanup_id, true );
	}
	if ( $term_id ) {
		wp_delete_term( $term_id, 'category' );
	}
	foreach ( $option_filters as $name => $callback ) {
		remove_filter( 'pre_option_' . $name, $callback );
	}
	remove_filter( 'pre_http_request', $spy, 10 );
	remove_shortcode( 'bulk_test_context' );
	if ( null === $original_job ) {
		delete_option( \Profile\Bulk\JOB_OPTION );
	} else {
		update_option( \Profile\Bulk\JOB_OPTION, $original_job, false );
	}
	wp_set_current_user( $original_user );
}
