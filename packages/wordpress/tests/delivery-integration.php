<?php
/**
 * Real WordPress delivery checks. Run only in a disposable development site.
 *
 * @package Profile
 */

if ( ! defined( 'WP_CLI' ) || ! WP_CLI ) {
	return;
}

/**
 * Assert a delivery invariant.
 *
 * @param bool   $condition Expected condition.
 * @param string $message Failure description.
 * @throws \RuntimeException On failure.
 */
function profile_delivery_assert( bool $condition, string $message ): void {
	if ( ! $condition ) {
		// phpcs:ignore WordPress.Security.EscapeOutput.ExceptionNotEscaped -- CLI only.
		throw new \RuntimeException( $message );
	}
}

$option_names  = array( 'profile_ca_excluded_urls', 'profile_ca_delivery_version', 'profile_ca_delivery_error' );
$saved_options = array();
foreach ( $option_names as $option_name ) {
	$sentinel                      = new \stdClass();
	$value                         = get_option( $option_name, $sentinel );
	$saved_options[ $option_name ] = array( $value !== $sentinel, $value );
}
$config            = array(
	'profile_ca_server_hostname'     => 'example.test',
	'profile_ca_issuer_id'           => 'dns:example.test',
	'profile_ca_server_admin_secret' => 'test:secret',
);
$filters           = array();
$post_ids          = array();
$http_requests     = array();
$fail_request      = false;
$fail_at_request   = null;
$during_request    = null;
$failure           = null;
$fixture           = null;
$created_directory = false;
$saved_filesystem  = $GLOBALS['wp_filesystem'] ?? null;
$response_ca       = 'test-delivery-ca';
$http_spy          = static function ( $preempt, $args, $url ) use ( &$http_requests, &$fail_request, &$fail_at_request, &$during_request, &$response_ca ) {
	$current_ca      = $response_ca;
	$http_requests[] = array( $url, $args['method'] ?? 'GET' );
	if ( null !== $during_request ) {
		$callback       = $during_request;
		$during_request = null;
		$callback();
	}
	if ( $fail_request || count( $http_requests ) === $fail_at_request ) {
		return new \WP_Error( 'test_failure', 'Simulated issuance failure.' );
	}
	return array(
		'headers'  => array(),
		'body'     => wp_json_encode( array( $current_ca ) ),
		'response' => array(
			'code'    => 200,
			'message' => 'OK',
		),
		'cookies'  => array(),
	);
};

try {
	profile_delivery_assert( function_exists( '\Profile\Delivery\get_cas' ), 'Delivery module is not active.' );
	add_filter( 'pre_http_request', $http_spy, 10, 3 );
	foreach ( $config as $name => $value ) {
		$filters[ $name ] = static fn() => $value;
		add_filter( 'pre_option_' . $name, $filters[ $name ] );
	}
	// Empty rules do not touch other articles; subsequent rules use exact fixture URLs.
	delete_option( 'profile_ca_excluded_urls' );
	$create           = static function ( string $content ) use ( &$post_ids ): int {
		$fixture_id = wp_insert_post(
			array(
				'post_title'   => 'Delivery integration ' . wp_generate_uuid4(),
				'post_content' => $content,
				'post_status'  => 'draft',
			),
			true
		);
		profile_delivery_assert( ! is_wp_error( $fixture_id ) && $fixture_id > 0, 'Could not create fixture.' );
		$post_ids[] = (int) $fixture_id;
		wp_update_post(
			array(
				'ID'          => $fixture_id,
				'post_status' => 'publish',
			)
		);
		return (int) $fixture_id;
	};
	$dispatch         = static function ( int $fixture_id, int $page_number, int $status ): \WP_REST_Response {
		$response = rest_do_request( new \WP_REST_Request( 'GET', "/ca-manager/v1/cas/{$fixture_id}/{$page_number}" ) );
		profile_delivery_assert( $response->get_status() === $status, "Unexpected REST status for page {$page_number}: " . $response->get_status() );
		$headers = array_change_key_case( $response->get_headers(), CASE_LOWER );
		profile_delivery_assert( str_contains( $headers['cache-control'] ?? '', 'no-store' ), 'REST response must prohibit storage.' );
		return $response;
	};
	$render_script    = static function ( int $article_id, int $page_number, string $mode ): string {
		$saved_query = $GLOBALS['wp_query'] ?? null;
		$saved_post  = $GLOBALS['post'] ?? null;
		$mode_filter = static fn() => $mode;
		add_filter( 'pre_option_profile_ca_embedded_or_external', $mode_filter );
		// phpcs:ignore WordPress.WP.GlobalVariablesOverride.Prohibited -- Scope a real singular query to this fixture and restore it below.
		$GLOBALS['wp_query'] = new \WP_Query(
			array(
				'p'    => $article_id,
				'page' => $page_number,
			)
		);
		// phpcs:ignore WordPress.WP.GlobalVariablesOverride.Prohibited -- get_the_ID reads this fixture's post.
		$GLOBALS['post'] = get_post( $article_id );
		ob_start();
		try {
			\Profile\Post\cas_script();
			return (string) ob_get_contents();
		} finally {
			ob_end_clean();
			// phpcs:ignore WordPress.WP.GlobalVariablesOverride.Prohibited -- Restore the original request context.
			$GLOBALS['wp_query'] = $saved_query;
			// phpcs:ignore WordPress.WP.GlobalVariablesOverride.Prohibited -- Restore the original request context.
			$GLOBALS['post'] = $saved_post;
			remove_filter( 'pre_option_profile_ca_embedded_or_external', $mode_filter );
		}
	};
	$assert_no_script = static function ( int $article_id ) use ( $render_script ): void {
		foreach ( array( 'embedded', 'external' ) as $mode ) {
			foreach ( array( 1, 2 ) as $page_number ) {
				profile_delivery_assert( '' === $render_script( $article_id, $page_number, $mode ), "Blocked {$mode} script leaked on page {$page_number}." );
			}
		}
	};
	$fixture_id       = $create( '<p>First.</p><!--nextpage--><p>Second.</p>' );
	$url              = get_permalink( $fixture_id );
	$original         = get_post_meta( $fixture_id, '_profile_post_cas', true );
	profile_delivery_assert( count( $original ) === 2, 'Split issuance must store both pages.' );
	foreach ( array( 1, 2 ) as $page_number ) {
		profile_delivery_assert( $dispatch( $fixture_id, $page_number, 200 )->get_data() === $original[ $page_number - 1 ], 'REST returned the wrong page.' );
	}
	$dispatch( $fixture_id, 3, 404 );
	profile_delivery_assert( str_contains( \Profile\Delivery\external_url( $fixture_id, 2 ), 'ca-manager' ), 'External delivery must use the REST endpoint.' );

	add_option( 'profile_ca_excluded_urls', array( $url ) );
	$token = get_post_meta( $fixture_id, \Profile\Delivery\BLOCKED_META, true );
	profile_delivery_assert( ! empty( $token ), 'First option save must block existing CA delivery.' );
	profile_delivery_assert( array() === \Profile\Delivery\get_cas( $fixture_id, 1 ), 'Excluded embedded CA leaked.' );
	$dispatch( $fixture_id, 1, 404 );
	$dispatch( $fixture_id, 2, 404 );
	$assert_no_script( $fixture_id );
	update_option( 'profile_ca_excluded_urls', array() );
	$dispatch( $fixture_id, 1, 404 );
	$assert_no_script( $fixture_id );
	profile_delivery_assert( get_post_meta( $fixture_id, \Profile\Delivery\BLOCKED_META, true ) === $token, 'Rule removal cleared the block.' );
	$fail_request = true;
	\Profile\Issue\sign_post( 'publish', 'publish', get_post( $fixture_id ) );
	profile_delivery_assert( get_post_meta( $fixture_id, '_profile_post_cas', true ) === $original, 'Failed issuance replaced existing CA.' );
	$dispatch( $fixture_id, 1, 404 );
	$fail_request    = false;
	$fail_at_request = count( $http_requests ) + 2;
	\Profile\Issue\sign_post( 'publish', 'publish', get_post( $fixture_id ) );
	profile_delivery_assert( get_post_meta( $fixture_id, '_profile_post_cas', true ) === $original, 'Partial split issuance replaced existing CA.' );
	$dispatch( $fixture_id, 2, 404 );
	$fail_at_request = null;
	\Profile\Issue\sign_post( 'publish', 'publish', get_post( $fixture_id ) );
	profile_delivery_assert( ! get_post_meta( $fixture_id, \Profile\Delivery\BLOCKED_META, true ), 'Successful complete reissue did not clear the block.' );
	$dispatch( $fixture_id, 2, 200 );
	foreach ( array( 1, 2 ) as $page_number ) {
		$embedded_output = $render_script( $fixture_id, $page_number, 'embedded' );
		profile_delivery_assert( str_contains( $embedded_output, '<script type="application/cas+json">["test-delivery-ca"]</script>' ), 'Reissued embedded script is missing.' );
		$external_output = $render_script( $fixture_id, $page_number, 'external' );
		profile_delivery_assert( str_contains( $external_output, 'src="' . esc_url( \Profile\Delivery\external_url( $fixture_id, $page_number ) ) . '"' ), 'Reissued external script must use the dynamic page URL.' );
	}

	update_option( 'profile_ca_excluded_urls', array( $url ) );
	profile_delivery_assert( ! empty( get_post_meta( $fixture_id, \Profile\Delivery\BLOCKED_META, true ) ), 'Updated rules did not block delivery.' );
	update_option( 'profile_ca_excluded_urls', array() );
	$token          = get_post_meta( $fixture_id, \Profile\Delivery\BLOCKED_META, true );
	$during_request = static function () use ( $url ): void {
		update_option( 'profile_ca_excluded_urls', array( $url ) );
		update_option( 'profile_ca_excluded_urls', array() );
	};
	\Profile\Issue\sign_post( 'publish', 'publish', get_post( $fixture_id ) );
	$new_token = get_post_meta( $fixture_id, \Profile\Delivery\BLOCKED_META, true );
	profile_delivery_assert( ! empty( $new_token ) && $new_token !== $token, 'Concurrent rule change lost its newer block token.' );
	$dispatch( $fixture_id, 1, 404 );

	// Reentrant issuance shares a DB connection but must never commit an older token.
	foreach ( array( true, false ) as $nested_failure ) {
		$before_nested_cas = get_post_meta( $fixture_id, '_profile_post_cas', true );
		$during_request    = static function () use ( $fixture_id, $nested_failure, &$fail_request, &$response_ca ): void {
			$fail_request = $nested_failure;
			$response_ca  = 'newer-nested-ca';
			try {
				\Profile\Issue\sign_post( 'publish', 'publish', get_post( $fixture_id ) );
			} finally {
				$fail_request = false;
				$response_ca  = 'test-delivery-ca';
			}
		};
		\Profile\Issue\sign_post( 'publish', 'publish', get_post( $fixture_id ) );
		if ( $nested_failure ) {
			profile_delivery_assert( get_post_meta( $fixture_id, '_profile_post_cas', true ) === $before_nested_cas, 'Older issuance overwrote CAS after a newer issuance failed.' );
			$dispatch( $fixture_id, 1, 404 );
			$assert_no_script( $fixture_id );
		} else {
			profile_delivery_assert( array( array( 'newer-nested-ca' ), array( 'newer-nested-ca' ) ) === get_post_meta( $fixture_id, '_profile_post_cas', true ), 'Older issuance overwrote the successful newer CAS.' );
			profile_delivery_assert( array( 'newer-nested-ca' ) === $dispatch( $fixture_id, 1, 200 )->get_data(), 'Successful newer issuance was not delivered.' );
		}
	}

	// A distinct DB session owns the same article lock, simulating another request.
	$lock_database = new \wpdb( DB_USER, DB_PASSWORD, DB_NAME, DB_HOST );
	$article_lock  = hash( 'sha256', DB_NAME . ':' . $GLOBALS['wpdb']->prefix . ':ca:' . $fixture_id );
	try {
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery -- Test-only advisory lock, never persist credentials or query output.
		$lock_acquired = $lock_database->get_var( $lock_database->prepare( 'SELECT GET_LOCK(%s, 0)', $article_lock ) );
		profile_delivery_assert( 1 === (int) $lock_acquired, 'Could not acquire the independent test lock.' );
		$before_busy_requests = count( $http_requests );
		$before_busy_cas      = get_post_meta( $fixture_id, '_profile_post_cas', true );
		\Profile\Issue\sign_post( 'publish', 'publish', get_post( $fixture_id ) );
		profile_delivery_assert( count( $http_requests ) === $before_busy_requests, 'Busy issuance lock allowed an HTTP request.' );
		profile_delivery_assert( get_post_meta( $fixture_id, '_profile_post_cas', true ) === $before_busy_cas, 'Busy issuance lock replaced CAS.' );
		$dispatch( $fixture_id, 1, 404 );
	} finally {
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery -- Release the test lock on its owning session even after assertions fail.
		$lock_database->get_var( $lock_database->prepare( 'SELECT RELEASE_LOCK(%s)', $article_lock ) );
		$lock_database->close();
	}
	\Profile\Issue\sign_post( 'publish', 'publish', get_post( $fixture_id ) );
	$dispatch( $fixture_id, 1, 200 );

	// A delayed worker must not publish CA for a stale article snapshot.
	$stale_post  = clone get_post( $fixture_id );
	$response_ca = 'current-content-ca';
	$updated_id  = wp_update_post(
		array(
			'ID'           => $fixture_id,
			'post_content' => '<p>Updated first page.</p><!--nextpage--><p>Updated second page.</p>',
		),
		true
	);
	profile_delivery_assert( $updated_id === $fixture_id, 'Could not update the stale-snapshot fixture.' );
	$current_content_cas = get_post_meta( $fixture_id, '_profile_post_cas', true );
	profile_delivery_assert( array( array( 'current-content-ca' ), array( 'current-content-ca' ) ) === $current_content_cas, 'Updated content did not receive its own CA.' );
	$response_ca = 'stale-content-ca';
	\Profile\Issue\sign_post( 'publish', 'publish', $stale_post );
	profile_delivery_assert( get_post_meta( $fixture_id, '_profile_post_cas', true ) === $current_content_cas, 'Stale article snapshot overwrote the current content CA.' );
	profile_delivery_assert( ! empty( get_post_meta( $fixture_id, \Profile\Delivery\BLOCKED_META, true ) ), 'Stale article snapshot cleared the delivery block.' );
	$dispatch( $fixture_id, 1, 404 );
	$assert_no_script( $fixture_id );
	$response_ca = 'test-delivery-ca';
	\Profile\Issue\sign_post( 'publish', 'publish', get_post( $fixture_id ) );
	profile_delivery_assert( array( 'test-delivery-ca' ) === $dispatch( $fixture_id, 1, 200 )->get_data(), 'Fresh article snapshot did not restore delivery.' );

	$protected_id = $create( '<p>Protected.</p>' );
	wp_update_post(
		array(
			'ID'            => $protected_id,
			'post_password' => 'fixture-password',
		)
	);
	$dispatch( $protected_id, 1, 404 );
	profile_delivery_assert( array() === \Profile\Delivery\get_cas( $protected_id, 1 ), 'Password-protected embedded CA leaked.' );
	wp_update_post(
		array(
			'ID'            => $protected_id,
			'post_status'   => 'private',
			'post_password' => '',
		)
	);
	update_post_meta( $protected_id, '_profile_post_cas', array( array( 'private-test-ca' ) ) );
	$dispatch( $protected_id, 1, 404 );
	profile_delivery_assert( array() === \Profile\Delivery\get_cas( $protected_id, 1 ), 'Private embedded CA leaked.' );

	// Refuse to run migration against any existing static CA: only our fixture is deleted.
	$directory = ABSPATH . 'cas';
	profile_delivery_assert( array() === glob( $directory . '/*_cas.json' ), 'Migration test requires a site without existing static CA files.' );
	$created_directory = ! is_dir( $directory );
	profile_delivery_assert( wp_mkdir_p( $directory ), 'Could not create fixture directory.' );
	$fixture = $directory . '/' . $fixture_id . '_cas.json';
	// phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_file_put_contents -- Disposable CLI fixture.
	profile_delivery_assert( false !== file_put_contents( $fixture, '["legacy-test-ca"]' ), 'Could not create legacy fixture.' );
	delete_option( 'profile_ca_delivery_version' );
	profile_delivery_assert( is_object( $saved_filesystem ), 'The fixture requires an initialized filesystem.' );
	// Delegate every operation except deletion of this exact test fixture.
	// phpcs:ignore WordPress.WP.GlobalVariablesOverride.Prohibited -- Scoped filesystem failure injection or restoration.
	$GLOBALS['wp_filesystem'] = new class( $saved_filesystem, $fixture ) {
		/**
		 * Simulate an unreadable directory listing.
		 *
		 * @var bool
		 */
		public bool $fail_listing = false;
		/**
		 * Initialize the filesystem wrapper.
		 *
		 * @param object $delegate Original filesystem.
		 * @param string $blocked_file Fixture whose deletion fails.
		 */
		public function __construct( private object $delegate, private string $blocked_file ) {}

		/**
		 * Forward other filesystem operations.
		 *
		 * @param string $method Method name.
		 * @param array  $arguments Arguments.
		 * @return mixed Original result.
		 */
		public function __call( string $method, array $arguments ): mixed {
			if ( 'dirlist' === $method && $this->fail_listing ) {
				return false;
			}
			return $this->delegate->$method( ...$arguments );
		}

		/**
		 * Simulate failure for the fixture alone.
		 *
		 * @param string $file File path.
		 * @param bool   $recursive Recursive deletion.
		 * @param string $type File type.
		 * @return bool Deletion result.
		 */
		public function delete( $file, $recursive = false, $type = false ): bool {
			return $file === $this->blocked_file ? false : $this->delegate->delete( $file, $recursive, $type );
		}
	};
	\Profile\Delivery\migrate();
	profile_delivery_assert( file_exists( $fixture ), 'Failed deletion unexpectedly removed the fixture.' );
	profile_delivery_assert( '1' !== get_option( 'profile_ca_delivery_version' ), 'Failed migration was marked complete.' );
	profile_delivery_assert( (bool) get_option( 'profile_ca_delivery_error' ), 'Failed migration did not record an error.' );
	$GLOBALS['wp_filesystem']->fail_listing = true;
	\Profile\Delivery\migrate();
	profile_delivery_assert( file_exists( $fixture ), 'Unreadable directory listing removed the fixture.' );
	profile_delivery_assert( '1' !== get_option( 'profile_ca_delivery_version' ), 'Unreadable directory listing was marked complete.' );
	profile_delivery_assert( (bool) get_option( 'profile_ca_delivery_error' ), 'Directory listing failure cleared the migration error.' );
	// phpcs:ignore WordPress.WP.GlobalVariablesOverride.Prohibited -- Scoped filesystem failure injection or restoration.
	$GLOBALS['wp_filesystem'] = $saved_filesystem;
	\Profile\Delivery\migrate();

	profile_delivery_assert( ! file_exists( $fixture ), 'Migration left the legacy static CA accessible.' );
	profile_delivery_assert( '1' === get_option( 'profile_ca_delivery_version' ), 'Migration was not marked complete.' );
	profile_delivery_assert( ! get_option( 'profile_ca_delivery_error' ), 'Successful retry did not clear the migration error.' );
} catch ( \Throwable $exception ) {
	$failure = $exception;
} finally {
	// phpcs:ignore WordPress.WP.GlobalVariablesOverride.Prohibited -- Scoped filesystem failure injection or restoration.
	$GLOBALS['wp_filesystem'] = $saved_filesystem;
	foreach ( $post_ids as $cleanup_post_id ) {
		wp_delete_post( $cleanup_post_id, true );
	}
	if ( null !== $fixture && file_exists( $fixture ) ) {
		wp_delete_file( $fixture );
	}
	if ( $created_directory ) {
		// phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_rmdir -- Remove only an empty test-created directory.
		rmdir( ABSPATH . 'cas' );
	}
	// Restoring site settings must not mutate delivery metadata of unrelated posts.
	remove_action( 'add_option_profile_ca_excluded_urls', '\Profile\Delivery\rules_changed' );
	remove_action( 'update_option_profile_ca_excluded_urls', '\Profile\Delivery\rules_changed' );
	foreach ( $saved_options as $name => $saved ) {
		if ( $saved[0] ) {
			update_option( $name, $saved[1] );
		} else {
			delete_option( $name );
		}
	}
	add_action( 'add_option_profile_ca_excluded_urls', '\Profile\Delivery\rules_changed' );
	add_action( 'update_option_profile_ca_excluded_urls', '\Profile\Delivery\rules_changed' );
	foreach ( $filters as $name => $callback ) {
		remove_filter( 'pre_option_' . $name, $callback );
	}
	remove_filter( 'pre_http_request', $http_spy, 10 );
}
if ( null !== $failure ) {
	\WP_CLI::error( 'CA delivery integration failed: ' . $failure->getMessage() );
}
\WP_CLI::success( 'CA delivery integration passed: saved rules, blocked reissue, concurrency, split REST, protected posts and migration.' );
