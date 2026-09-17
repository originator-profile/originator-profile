<?php
/**
 * Real WordPress integration checks for CA issuance URL exclusions.
 *
 * Run with composer run test:integration:exclusion in the development container.
 * The .test.php suffix is omitted to keep this separate from PHPUnit.
 *
 * @package Profile
 */

if ( ! defined( 'WP_CLI' ) || ! WP_CLI ) {
	return;
}

/**
 * Assert an integration condition.
 *
 * @param bool   $condition Condition that must be true.
 * @param string $message Failure description.
 * @return void
 * @throws \RuntimeException When an integration assertion fails.
 */
function profile_ca_exclusion_integration_assert( bool $condition, string $message ): void {
	if ( ! $condition ) {
		// phpcs:ignore WordPress.Security.EscapeOutput.ExceptionNotEscaped -- CLI専用のため、HTMLエスケープは不要。
		throw new \RuntimeException( $message );
	}
}

/**
 * Return a readable value for an exception or error.
 *
 * @param mixed $value Value to describe.
 * @return string
 */
function profile_ca_exclusion_integration_describe( mixed $value ): string {
	if ( $value instanceof \WP_Error ) {
		return $value->get_error_message();
	}

	if ( $value instanceof \Throwable ) {
		return $value->getMessage();
	}

	return (string) $value;
}

if ( ! class_exists( 'WP_CLI' ) ) {
	throw new \RuntimeException( 'This script must be run through wp eval-file.' );
}

if ( ! function_exists( '\Profile\Issue\sign_post' ) ) {
	\WP_CLI::error( 'The CA Manager plugin is not active.' );
}

if ( false === has_action( 'transition_post_status', '\Profile\Issue\sign_post' ) ) {
	\WP_CLI::error( 'The CA Manager publish hook is not registered.' );
}

$run_token = 'ca-exclusion-integration-' . gmdate( 'YmdHis' ) . '-' . substr( wp_generate_uuid4(), 0, 12 );

/**
 * The option filters keep this run isolated from any site configuration.
 * The rules value is changed between cases without writing a real option.
 *
 * @var array<string, mixed> $option_values
 */
$option_values = array(
	'profile_ca_server_hostname'     => 'example.test',
	'profile_ca_issuer_id'           => 'dns:example.test',
	'profile_ca_server_admin_secret' => 'test:secret',
	'profile_ca_excluded_urls'       => array(),
);

/**
 * Process-local permalink format under test; the saved site option is unchanged.
 *
 * @var string $permalink_structure
 */
$permalink_structure = '';

/**
 * Every HTTP request is intercepted. The fake response is deliberately only
 * an explicit test CA value; it is not a signed Content Attestation.
 *
 * @var list<array{url: string, method: string, body: mixed}> $http_requests
 */
$http_requests = array();
$http_spy      = static function ( $preempt, $parsed_args, $url ) use ( &$http_requests ) {
	$http_requests[] = array(
		'url'    => (string) $url,
		'method' => isset( $parsed_args['method'] ) ? (string) $parsed_args['method'] : 'GET',
		'body'   => $parsed_args['body'] ?? null,
	);

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

/**
 * Return false for one post's permalink while testing URL validation.
 *
 * @var int|null $false_permalink_post_id
 */
$false_permalink_post_id = null;
$false_permalink_filter  = static function ( $permalink, $post ) use ( &$false_permalink_post_id ) {
	if ( $post instanceof \WP_Post && $post->ID === $false_permalink_post_id ) {
		return false;
	}

	return $permalink;
};

/**
 * Option callbacks to remove during cleanup.
 *
 * @var array<string, callable> $option_filters
 */
$option_filters = array();
$post_ids       = array();
$completed      = array();
$failure        = null;
$cleanup_errors = array();

try {
	add_filter( 'pre_http_request', $http_spy, 10, 3 );

	foreach ( array_keys( $option_values ) as $option_name ) {
		$option_filters[ $option_name ] = static function () use ( &$option_values, $option_name ) {
			return $option_values[ $option_name ];
		};
		add_filter( 'pre_option_' . $option_name, $option_filters[ $option_name ], 10, 1 );
	}
	$option_filters['permalink_structure'] = static function () use ( &$permalink_structure ) {
		return $permalink_structure;
	};
	add_filter( 'pre_option_permalink_structure', $option_filters['permalink_structure'], 10, 1 );

	$create_post = static function ( string $label, string $content ) use ( &$post_ids, $run_token ): int {
		$post_id = wp_insert_post(
			array(
				'post_author'  => get_current_user_id(),
				'post_content' => $content,
				'post_name'    => sanitize_title( $run_token . '-' . $label . '-' . wp_generate_uuid4() ),
				'post_status'  => 'draft',
				'post_title'   => $run_token . ' ' . $label,
				'post_type'    => 'post',
			),
			true
		);

		profile_ca_exclusion_integration_assert(
			! is_wp_error( $post_id ) && 0 < (int) $post_id,
			'Could not create test draft: ' . profile_ca_exclusion_integration_describe( $post_id )
		);

		$post_ids[] = (int) $post_id;
		return (int) $post_id;
	};

	$get_url = static function ( int $post_id, string $label ): string {
		$url = get_permalink( $post_id );
		profile_ca_exclusion_integration_assert(
			is_string( $url ) && '' !== $url,
			"{$label} did not receive a usable permalink."
		);

		return $url;
	};

	$get_future_published_url = static function ( int $post_id, string $label ): string {
		$post = get_post( $post_id );
		profile_ca_exclusion_integration_assert(
			$post instanceof \WP_Post,
			"{$label} could not be fetched after creation."
		);

		$published_post              = clone $post;
		$published_post->post_status = 'publish';
		$url                         = get_permalink( $published_post );
		profile_ca_exclusion_integration_assert(
			is_string( $url ) && '' !== $url,
			"{$label} did not receive a usable future published permalink."
		);

		return $url;
	};

	$publish_post = static function ( int $post_id, string $label ): void {
		$result = wp_update_post(
			array(
				'ID'          => $post_id,
				'post_status' => 'publish',
			),
			true
		);

		profile_ca_exclusion_integration_assert(
			! is_wp_error( $result ) && (int) $result === $post_id,
			"Could not publish {$label}: " . profile_ca_exclusion_integration_describe( $result )
		);
	};

	$assert_fake_ca_request = static function ( int $request_index, string $label ) use ( &$http_requests ): void {
		profile_ca_exclusion_integration_assert(
			isset( $http_requests[ $request_index ] ),
			"{$label} did not make the expected CA request."
		);
		profile_ca_exclusion_integration_assert(
			'POST' === $http_requests[ $request_index ]['method']
				&& 'https://example.test/ca' === $http_requests[ $request_index ]['url'],
			"{$label} made an unexpected external request."
		);
	};

	foreach ( array( '', '/%postname%/' ) as $permalink_structure ) {
		$case_start = count( $completed );

		// A matching URL skips the transition hook and leaves an existing CAS intact.
		$excluded_post_id                          = $create_post( 'excluded', '<p>Excluded content.</p>' );
		$excluded_url                              = $get_future_published_url( $excluded_post_id, 'Excluded post' );
		$option_values['profile_ca_excluded_urls'] = array( $excluded_url );
		$existing_cas                              = array( array( 'existing-excluded-ca' ) );
		update_post_meta( $excluded_post_id, '_profile_post_cas', $existing_cas );
		$before_requests = count( $http_requests );
		$publish_post( $excluded_post_id, 'excluded post' );
		$published_url = $get_url( $excluded_post_id, 'Excluded post after publish' );
		profile_ca_exclusion_integration_assert(
			$published_url === $excluded_url,
			'Excluded post permalink changed between the draft prediction and first publish.'
		);
		profile_ca_exclusion_integration_assert(
			count( $http_requests ) === $before_requests,
			'An excluded post made a CA request on first publish.'
		);
		profile_ca_exclusion_integration_assert(
			get_post_meta( $excluded_post_id, '_profile_post_cas', true ) === $existing_cas,
			'An excluded post lost its existing CAS on first publish.'
		);
		$completed[] = 'excluded first publish makes no request and preserves CAS';

		// A publish update also runs through transition_post_status and remains excluded.
		$before_requests = count( $http_requests );
		$result          = wp_update_post(
			array(
				'ID'           => $excluded_post_id,
				'post_content' => '<p>Excluded content updated.</p>',
			),
			true
		);
		profile_ca_exclusion_integration_assert(
			! is_wp_error( $result ) && (int) $result === $excluded_post_id,
			'Could not update the excluded post: ' . profile_ca_exclusion_integration_describe( $result )
		);
		profile_ca_exclusion_integration_assert(
			count( $http_requests ) === $before_requests,
			'An excluded publish update made a CA request.'
		);
		profile_ca_exclusion_integration_assert(
			get_post_meta( $excluded_post_id, '_profile_post_cas', true ) === $existing_cas,
			'An excluded publish update replaced its existing CAS.'
		);
		$completed[] = 'excluded publish update makes no request and preserves CAS';

		// Removing the rule resumes issuance on a later publish update.
		$option_values['profile_ca_excluded_urls'] = array();
		$before_requests                           = count( $http_requests );
		$result                                    = wp_update_post(
			array(
				'ID'           => $excluded_post_id,
				'post_content' => '<p>Issuance resumes after exclusion removal.</p>',
			),
			true
		);
		profile_ca_exclusion_integration_assert(
			! is_wp_error( $result ) && (int) $result === $excluded_post_id,
			'Could not update the post after removing its exclusion: ' . profile_ca_exclusion_integration_describe( $result )
		);
		profile_ca_exclusion_integration_assert(
			count( $http_requests ) === $before_requests + 1,
			'Issuance did not resume after removing the exclusion.'
		);
		$assert_fake_ca_request( $before_requests, 'Issuance resumed after exclusion removal' );
		profile_ca_exclusion_integration_assert(
			array( array( 'test-ca' ) ) === get_post_meta( $excluded_post_id, '_profile_post_cas', true ),
			'Issuance after exclusion removal did not store the simulated CA.'
		);
		$completed[] = 'removing an exclusion resumes issuance';

		// A nonmatching URL issues on first publish and again on a later publish update.
		$positive_post_id                          = $create_post( 'positive', '<p>Included content.</p>' );
		$positive_url                              = $get_future_published_url( $positive_post_id, 'Included post' );
		$option_values['profile_ca_excluded_urls'] = array( $excluded_url );
		$before_requests                           = count( $http_requests );
		$publish_post( $positive_post_id, 'included post' );
		$published_url = $get_url( $positive_post_id, 'Included post after publish' );
		profile_ca_exclusion_integration_assert(
			$published_url === $positive_url,
			'Included post permalink changed between the draft prediction and first publish.'
		);
		profile_ca_exclusion_integration_assert(
			count( $http_requests ) === $before_requests + 1,
			'An included post did not make one CA request on first publish.'
		);
		$assert_fake_ca_request( $before_requests, 'Included first publish' );
		profile_ca_exclusion_integration_assert(
			array( array( 'test-ca' ) ) === get_post_meta( $positive_post_id, '_profile_post_cas', true ),
			'Included first publish did not store the simulated CA.'
		);
		$before_requests = count( $http_requests );
		$result          = wp_update_post(
			array(
				'ID'           => $positive_post_id,
				'post_content' => '<p>Included content updated.</p>',
			),
			true
		);
		profile_ca_exclusion_integration_assert(
			! is_wp_error( $result ) && (int) $result === $positive_post_id,
			'Could not update the included post: ' . profile_ca_exclusion_integration_describe( $result )
		);
		profile_ca_exclusion_integration_assert(
			count( $http_requests ) === $before_requests + 1,
			'An included publish update did not make one CA request.'
		);
		$assert_fake_ca_request( $before_requests, 'Included publish update' );
		$completed[] = 'included first publish and publish update issue simulated CAs';

		// A split article is wholly excluded when its base article permalink matches.
		$split_post_id                             = $create_post(
			'split',
			'<p>First page.</p><!--nextpage--><p>Second page.</p>'
		);
		$split_url                                 = $get_future_published_url( $split_post_id, 'Split post' );
		$option_values['profile_ca_excluded_urls'] = array( $split_url );
		$split_cas                                 = array( array( 'existing-split-ca' ) );
		update_post_meta( $split_post_id, '_profile_post_cas', $split_cas );
		$before_requests = count( $http_requests );
		$publish_post( $split_post_id, 'split post' );
		$published_url = $get_url( $split_post_id, 'Split post after publish' );
		profile_ca_exclusion_integration_assert(
			$published_url === $split_url,
			'Split post permalink changed between the draft prediction and first publish.'
		);
		profile_ca_exclusion_integration_assert(
			count( $http_requests ) === $before_requests,
			'A split article made a request despite its base URL being excluded.'
		);
		profile_ca_exclusion_integration_assert(
			get_post_meta( $split_post_id, '_profile_post_cas', true ) === $split_cas,
			'A split article lost its existing CAS while excluded.'
		);
		$completed[] = 'all pages of an excluded split article make no request';

		// A non-string rule is invalid and must fail closed while preserving CAS.
		$malformed_rule_post_id = $create_post( 'malformed-rule', '<p>Malformed rule.</p>' );
		$malformed_rule_cas     = array( array( 'existing-malformed-rule-ca' ) );
		update_post_meta( $malformed_rule_post_id, '_profile_post_cas', $malformed_rule_cas );
		$option_values['profile_ca_excluded_urls'] = array( 123 );
		$before_requests                           = count( $http_requests );
		$publish_post( $malformed_rule_post_id, 'malformed-rule post' );
		profile_ca_exclusion_integration_assert(
			count( $http_requests ) === $before_requests,
			'A malformed rule made a CA request.'
		);
		profile_ca_exclusion_integration_assert(
			get_post_meta( $malformed_rule_post_id, '_profile_post_cas', true ) === $malformed_rule_cas,
			'A malformed rule caused existing CAS to be replaced.'
		);
		$completed[] = 'non-string exclusion rules fail closed and preserve CAS';

		// A non-array option value is also invalid and must fail closed.
		$malformed_option_post_id = $create_post( 'malformed-option', '<p>Malformed option.</p>' );
		$malformed_option_cas     = array( array( 'existing-malformed-option-ca' ) );
		update_post_meta( $malformed_option_post_id, '_profile_post_cas', $malformed_option_cas );
		$option_values['profile_ca_excluded_urls'] = 'not-an-array';
		$before_requests                           = count( $http_requests );
		$publish_post( $malformed_option_post_id, 'malformed-option post' );
		profile_ca_exclusion_integration_assert(
			count( $http_requests ) === $before_requests,
			'A non-array exclusion option made a CA request.'
		);
		profile_ca_exclusion_integration_assert(
			get_post_meta( $malformed_option_post_id, '_profile_post_cas', true ) === $malformed_option_cas,
			'A non-array exclusion option caused existing CAS to be replaced.'
		);
		$completed[] = 'a non-array exclusion option fails closed and preserves CAS';

		// The settings sanitizer keeps the previous rules when submitted data is invalid.
		if ( function_exists( '\Profile\Admin\sanitize_excluded_urls' ) ) {
			$preserved_rules                           = array( $excluded_url );
			$option_values['profile_ca_excluded_urls'] = $preserved_rules;
			$sanitized_rules                           = \Profile\Admin\sanitize_excluded_urls( array( '/valid/**', 123 ) );
			profile_ca_exclusion_integration_assert(
				$preserved_rules === $sanitized_rules,
				'Invalid settings input did not preserve the previous exclusion rules.'
			);
			$completed[] = 'invalid settings input preserves prior exclusion rules';
		}

		// An invalid permalink fails closed even when the rules option is empty.
		$false_permalink_post_id = $create_post( 'false-permalink', '<p>Invalid permalink.</p>' );
		$false_permalink_cas     = array( array( 'existing-false-permalink-ca' ) );
		update_post_meta( $false_permalink_post_id, '_profile_post_cas', $false_permalink_cas );
		$option_values['profile_ca_excluded_urls'] = array();
		add_filter( 'post_link', $false_permalink_filter, 10, 2 );
		profile_ca_exclusion_integration_assert(
			false === get_permalink( $false_permalink_post_id ),
			'Could not make the test permalink invalid.'
		);
		$before_requests = count( $http_requests );
		$publish_post( $false_permalink_post_id, 'false-permalink post' );
		profile_ca_exclusion_integration_assert(
			count( $http_requests ) === $before_requests,
			'An invalid permalink made a CA request.'
		);
		profile_ca_exclusion_integration_assert(
			get_post_meta( $false_permalink_post_id, '_profile_post_cas', true ) === $false_permalink_cas,
			'An invalid permalink caused existing CAS to be replaced.'
		);
		$completed[] = 'an invalid permalink fails closed and preserves CAS';
		$case_end    = count( $completed );
		for ( $case_index = $case_start; $case_index < $case_end; ++$case_index ) {
			$completed[ $case_index ] = ( '' === $permalink_structure ? 'plain: ' : 'postname: ' ) . $completed[ $case_index ];
		}
	}
} catch ( \Throwable $exception ) {
	$failure = $exception;
} finally {
	// Keep the plugin hooks and HTTP spy installed while deleting all test posts.
	foreach ( $post_ids as $cleanup_post_id ) {
		try {
			if ( false === wp_delete_post( $cleanup_post_id, true ) ) {
				$cleanup_errors[] = "Could not delete test post {$cleanup_post_id}.";
			}
		} catch ( \Throwable $exception ) {
			$cleanup_errors[] = "Could not delete test post {$cleanup_post_id}: " . $exception->getMessage();
		}
	}

	if ( null !== $false_permalink_post_id ) {
		remove_filter( 'post_link', $false_permalink_filter, 10 );
		$false_permalink_post_id = null;
	}

	foreach ( $option_filters as $option_name => $option_filter ) {
		remove_filter( 'pre_option_' . $option_name, $option_filter, 10 );
	}
	remove_filter( 'pre_http_request', $http_spy, 10 );
}

if ( ! empty( $cleanup_errors ) ) {
	$cleanup_failure = new \RuntimeException( implode( ' ', $cleanup_errors ) );
	$failure         = null === $failure ? $cleanup_failure : new \RuntimeException(
		$failure->getMessage() . ' Cleanup: ' . $cleanup_failure->getMessage(),
		(int) $failure->getCode(),
		$failure
	);
}

if ( null !== $failure ) {
	\WP_CLI::error( 'CA exclusion integration failed: ' . $failure->getMessage() );
}

\WP_CLI::success( 'CA exclusion integration passed (' . count( $completed ) . ' cases).' );
foreach ( $completed as $case ) {
	\WP_CLI::log( 'PASS: ' . $case );
}
