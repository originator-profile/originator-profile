<?php
/**
 * Real database checks for CA storage.
 *
 * @package Profile
 */

if ( ! defined( 'WP_CLI' ) || ! WP_CLI ) {
	return;
}

// These tests intentionally inspect database locks without caches.
// phpcs:disable WordPress.DB.DirectDatabaseQuery

function profile_storage_assert( bool $condition, string $message ): void {
	if ( ! $condition ) {
		throw new RuntimeException( esc_html( $message ) );
	}
}

global $wpdb;
$previous_user = get_current_user_id();
$test_post_id  = 0;
$query_filter  = null;
$http_effect   = null;
$http_count    = 0;
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
$filters['pre_http_request'] = static function () use ( &$http_effect, &$http_count ) {
	++$http_count;
	if ( $http_effect ) {
		$http_effect();
	}
	return array(
		'headers'  => array(),
		'body'     => '["test-ca"]',
		'response' => array( 'code' => 200 ),
		'cookies'  => array(),
	);
};
foreach ( $filters as $hook => $callback ) {
	add_filter( $hook, $callback );
}
$sign_priority = has_action( 'transition_post_status', '\Profile\Issue\sign_post' );
remove_action( 'transition_post_status', '\Profile\Issue\sign_post', $sign_priority );
$previous_suppression = $wpdb->suppress_errors();
$other                = new wpdb( DB_USER, DB_PASSWORD, DB_NAME, DB_HOST );
$other->suppress_errors();
$other->query( 'SET SESSION innodb_lock_wait_timeout = 1' );

try {
	$admins = get_users(
		array(
			'role'   => 'administrator',
			'number' => 1,
		)
	);
	profile_storage_assert( ! empty( $admins ), 'An administrator is required.' );
	wp_set_current_user( $admins[0]->ID );
	$test_post_id = wp_insert_post(
		array(
			'post_status'  => 'publish',
			'post_title'   => 'CA storage integration',
			'post_content' => 'Storage test content.',
		),
		true
	);
	profile_storage_assert( is_int( $test_post_id ) && $test_post_id > 0, 'Could not create test post.' );

	foreach ( array( null, '', array(), array( array( 'old-ca' ) ), array( array( 'test-ca' ) ) ) as $initial ) {
		delete_post_meta( $test_post_id, '_profile_post_cas' );
		if ( null !== $initial ) {
			add_post_meta( $test_post_id, '_profile_post_cas', $initial );
		}
		$result = \Profile\Issue\issue_post( get_post( $test_post_id ) );
		profile_storage_assert( 'success' === $result['status'], 'Saving missing, empty, or existing CA failed.' );
		profile_storage_assert( array( array( 'test-ca' ) ) === get_post_meta( $test_post_id, '_profile_post_cas', true ), 'Saved value differs.' );
	}

	foreach ( array( null, '', array(), array( array( 'old-ca' ) ) ) as $initial ) {
		delete_post_meta( $test_post_id, '_profile_post_cas' );
		if ( null !== $initial ) {
			add_post_meta( $test_post_id, '_profile_post_cas', $initial );
		}
		$http_effect = static function () use ( $test_post_id ) {
			update_post_meta( $test_post_id, '_profile_post_cas', array( array( 'competing-ca' ) ) );
		};
		$result      = \Profile\Issue\issue_post( get_post( $test_post_id ) );
		profile_storage_assert( 'failed' === $result['status'], 'A concurrent CA update was accepted.' );
		profile_storage_assert( array( array( 'competing-ca' ) ) === get_post_meta( $test_post_id, '_profile_post_cas', true ), 'Concurrent CA was overwritten.' );
	}
	$http_effect = null;

	// A normal WordPress update after HTTP, immediately before storage starts.
	$query_filter = static function ( $query ) use ( $test_post_id, &$query_filter ) {
		if ( 'SET TRANSACTION ISOLATION LEVEL REPEATABLE READ' === $query ) {
			remove_filter( 'query', $query_filter );
			wp_update_post(
				array(
					'ID'         => $test_post_id,
					'post_title' => 'Changed before storage',
				)
			);
		}
		return $query;
	};
	add_filter( 'query', $query_filter );
	$result = \Profile\Issue\issue_post( get_post( $test_post_id ) );
	remove_filter( 'query', $query_filter );
	profile_storage_assert( 'failed' === $result['status'], 'A post update immediately before storage was accepted.' );
	profile_storage_assert( array( array( 'competing-ca' ) ) === get_post_meta( $test_post_id, '_profile_post_cas', true ), 'Post update changed the existing CA.' );

	// The second connection exercises ordinary post UPDATE and meta UPDATE/INSERT.
	foreach ( array( false, true ) as $existing ) {
		delete_post_meta( $test_post_id, '_profile_post_cas' );
		if ( $existing ) {
			add_post_meta( $test_post_id, '_profile_post_cas', 'old-ca' );
		}
		$lock_checks  = 0;
		$query_filter = static function ( $query ) use ( $test_post_id, $wpdb, $other, $existing, &$lock_checks, &$query_filter ) {
			$prefix = $existing ? "UPDATE {$wpdb->postmeta} SET meta_value" : "INSERT INTO {$wpdb->postmeta} (post_id, meta_key, meta_value)";
			if ( str_starts_with( $query, $prefix ) ) {
				remove_filter( 'query', $query_filter );
				$result = $other->query( $other->prepare( "UPDATE {$wpdb->posts} SET post_title = %s WHERE ID = %d", 'Blocked update', $test_post_id ) );
				profile_storage_assert( false === $result && str_contains( $other->last_error, 'Lock wait timeout' ), 'Post row lock did not block an ordinary UPDATE.' );
				++$lock_checks;
				if ( $existing ) {
					$result = $other->query( $other->prepare( "UPDATE {$wpdb->postmeta} SET meta_value = %s WHERE post_id = %d AND meta_key = %s", 'blocked-ca', $test_post_id, '_profile_post_cas' ) );
				} else {
					$result = $other->query( $other->prepare( "INSERT INTO {$wpdb->postmeta} (post_id, meta_key, meta_value) VALUES (%d, %s, %s)", $test_post_id, '_profile_post_cas', 'blocked-ca' ) );
				}
				profile_storage_assert( false === $result && str_contains( $other->last_error, 'Lock wait timeout' ), 'CA range lock did not block a metadata write.' );
				++$lock_checks;
			}
			return $query;
		};
		add_filter( 'query', $query_filter );
		$result = \Profile\Issue\issue_post( get_post( $test_post_id ) );
		remove_filter( 'query', $query_filter );
		profile_storage_assert( 'success' === $result['status'] && 2 === $lock_checks, 'Storage lock checks did not complete.' );
	}

	// A reconnect must not retry storage without the transaction's locks.
	foreach ( array( false, true ) as $existing ) {
		delete_post_meta( $test_post_id, '_profile_post_cas' );
		if ( $existing ) {
			add_post_meta( $test_post_id, '_profile_post_cas', 'old-ca' );
		}
		$connection_id = $wpdb->get_var( 'SELECT CONNECTION_ID()' );
		$query_filter  = static function ( $query ) use ( $wpdb, $other, $existing, $connection_id, &$query_filter ) {
			$prefix = $existing ? "UPDATE {$wpdb->postmeta} SET meta_value" : "INSERT INTO {$wpdb->postmeta} (post_id, meta_key, meta_value)";
			if ( str_starts_with( $query, $prefix ) ) {
				remove_filter( 'query', $query_filter );
				profile_storage_assert( false !== $other->query( $other->prepare( 'KILL CONNECTION %d', $connection_id ) ), 'Could not disconnect the test connection.' );
			}
			return $query;
		};
		add_filter( 'query', $query_filter );
		$result = \Profile\Issue\issue_post( get_post( $test_post_id ) );
		remove_filter( 'query', $query_filter );
		profile_storage_assert( 'failed' === $result['status'], 'Storage after a reconnect was accepted.' );
		profile_storage_assert( $connection_id !== $wpdb->get_var( 'SELECT CONNECTION_ID()' ), 'The connection did not reconnect.' );
		profile_storage_assert( ( $existing ? 'old-ca' : '' ) === get_post_meta( $test_post_id, '_profile_post_cas', true ), 'Reconnect wrote metadata without locks.' );
	}

	$query_filter = static function ( $query ) {
		return 'COMMIT' === $query ? 'INVALID CA COMMIT' : $query;
	};
	add_filter( 'query', $query_filter );
	$result = \Profile\Issue\issue_post( get_post( $test_post_id ) );
	remove_filter( 'query', $query_filter );
	profile_storage_assert( 'failed' === $result['status'], 'A failed commit was accepted.' );
	profile_storage_assert( 'old-ca' === get_post_meta( $test_post_id, '_profile_post_cas', true ), 'Failed commit did not roll back the CA write.' );

	$original_title = $other->get_var( $other->prepare( "SELECT post_title FROM {$wpdb->posts} WHERE ID = %d", $test_post_id ) );
	$wpdb->query( 'START TRANSACTION' );
	$wpdb->query( $wpdb->prepare( "UPDATE {$wpdb->posts} SET post_title = %s WHERE ID = %d", 'Uncommitted title', $test_post_id ) );
	clean_post_cache( $test_post_id );
	$result = \Profile\Issue\issue_post( get_post( $test_post_id ) );
	profile_storage_assert( 'failed' === $result['status'], 'Storage inside an existing transaction was accepted.' );
	profile_storage_assert( 'Uncommitted title' === $wpdb->get_var( $wpdb->prepare( "SELECT post_title FROM {$wpdb->posts} WHERE ID = %d", $test_post_id ) ), 'The caller transaction was rolled back.' );
	profile_storage_assert( $original_title === $other->get_var( $other->prepare( "SELECT post_title FROM {$wpdb->posts} WHERE ID = %d", $test_post_id ) ), 'The caller transaction was committed.' );
	$wpdb->query( 'ROLLBACK' );
	profile_storage_assert( 16 === $http_count, 'Unexpected HTTP request count.' );
	WP_CLI::success( 'CA storage checks passed: empty values, conflicts, post changes, row locks, reconnects, failed commit, caller transaction.' );
} finally {
	if ( $query_filter ) {
		remove_filter( 'query', $query_filter );
	}
	$wpdb->query( 'ROLLBACK' );
	$http_effect = null;
	if ( is_int( $test_post_id ) && $test_post_id > 0 ) {
		wp_delete_post( $test_post_id, true );
	}
	$other->close();
	$wpdb->suppress_errors( $previous_suppression );
	foreach ( $filters as $hook => $callback ) {
		remove_filter( $hook, $callback );
	}
	if ( false !== $sign_priority ) {
		add_action( 'transition_post_status', '\Profile\Issue\sign_post', $sign_priority, 3 );
	}
	wp_set_current_user( $previous_user );
}
