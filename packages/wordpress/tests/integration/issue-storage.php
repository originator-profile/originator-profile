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
// phpcs:disable WordPress.DB.DirectDatabaseQuery, WordPress.DB.SlowDBQuery

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

	// Another connection saves CA after this request has cached an unissued post.
	$article_lock = hash( 'sha256', DB_NAME . ':' . $wpdb->prefix . ':ca:' . $test_post_id );
	foreach ( array( null, '', array() ) as $initial ) {
		foreach ( array( 'competing-ca', array( 'competing-ca' ), array( array( 'competing-ca' ) ) ) as $competing_cas ) {
			foreach ( array( false, true ) as $blocked ) {
				delete_post_meta( $test_post_id, '_profile_post_cas' );
				delete_post_meta( $test_post_id, \Profile\Delivery\BLOCKED_META );
				if ( null !== $initial ) {
					add_post_meta( $test_post_id, '_profile_post_cas', $initial );
				}
				if ( $blocked ) {
					profile_storage_assert( \Profile\Delivery\suspend( $test_post_id, true ), 'Could not prepare delivery suspension.' );
				}
				$blocked_before = get_post_meta( $test_post_id, \Profile\Delivery\BLOCKED_META, true );
				profile_storage_assert( ! \Profile\Issue\has_post_cas( $test_post_id ), 'The unissued CA cache was not prepared.' );
				profile_storage_assert( '1' === $other->get_var( $other->prepare( 'SELECT GET_LOCK(%s, 0)', $article_lock ) ), 'Could not acquire the competing article lock.' );
				try {
					profile_storage_assert(
						false !== $other->delete(
							$wpdb->postmeta,
							array(
								'post_id'  => $test_post_id,
								'meta_key' => '_profile_post_cas',
							)
						),
						'Could not remove the previous CA row.'
					);
					profile_storage_assert(
						1 === $other->insert(
							$wpdb->postmeta,
							array(
								'post_id'    => $test_post_id,
								'meta_key'   => '_profile_post_cas',
								'meta_value' => maybe_serialize( $competing_cas ),
							)
						),
						'Could not save the competing CA.'
					);
				} finally {
					$other->get_var( $other->prepare( 'SELECT RELEASE_LOCK(%s)', $article_lock ) );
				}
				profile_storage_assert( ! \Profile\Issue\has_post_cas( $test_post_id ), 'The second connection unexpectedly cleared the first request cache.' );
				$requests_before = $http_count;
				$result          = \Profile\Issue\issue_post( get_post( $test_post_id ), true );
				profile_storage_assert( 'skipped' === $result['status'], 'Missing-only issuance accepted a stale unissued CA cache.' );
				profile_storage_assert( $requests_before === $http_count, 'Missing-only issuance sent an HTTP request for a competing CA.' );
				profile_storage_assert( get_post_meta( $test_post_id, \Profile\Delivery\BLOCKED_META, true ) === $blocked_before, 'Missing-only issuance changed delivery suspension.' );
				wp_cache_delete( $test_post_id, 'post_meta' );
				profile_storage_assert( get_post_meta( $test_post_id, '_profile_post_cas', true ) === $competing_cas, 'Missing-only issuance overwrote the competing CA.' );
			}
		}
	}

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

	foreach ( array( null, '', array(), array( array() ) ) as $initial ) {
		delete_post_meta( $test_post_id, '_profile_post_cas' );
		if ( null !== $initial ) {
			add_post_meta( $test_post_id, '_profile_post_cas', $initial );
		}
		$result = \Profile\Issue\issue_post( get_post( $test_post_id ), true );
		profile_storage_assert( 'success' === $result['status'], 'Missing-only issuance rejected an empty CA value.' );
		profile_storage_assert( array( array( 'test-ca' ) ) === get_post_meta( $test_post_id, '_profile_post_cas', true ), 'Missing-only issuance did not save the CA.' );
	}

	// Query errors and duplicate rows still fail with delivery suspended.
	foreach ( array( false, true ) as $only_missing ) {
		delete_post_meta( $test_post_id, \Profile\Delivery\BLOCKED_META );
		$query_filter    = static function ( $query ) use ( $wpdb ) {
			$prefix = "SELECT meta_id, meta_value FROM {$wpdb->postmeta} ";
			return str_starts_with( $query, $prefix ) ? 'INVALID CA SNAPSHOT' : $query;
		};
		$requests_before = $http_count;
		add_filter( 'query', $query_filter );
		$result = \Profile\Issue\issue_post( get_post( $test_post_id ), $only_missing );
		remove_filter( 'query', $query_filter );
		profile_storage_assert( 'failed' === $result['status'] && str_contains( $result['message'], 'データベースから読み取れなかった' ), 'The CA query failure diagnostic changed.' );
		profile_storage_assert( $requests_before === $http_count && (bool) get_post_meta( $test_post_id, \Profile\Delivery\BLOCKED_META, true ), 'A CA query failure did not suspend delivery before HTTP.' );

		delete_post_meta( $test_post_id, \Profile\Delivery\BLOCKED_META );
		add_post_meta( $test_post_id, '_profile_post_cas', array( array( 'duplicate-ca' ) ) );
		$result = \Profile\Issue\issue_post( get_post( $test_post_id ), $only_missing );
		profile_storage_assert( 'failed' === $result['status'] && str_contains( $result['message'], '保存レコードが複数' ), 'The duplicate CA diagnostic changed.' );
		profile_storage_assert( $requests_before === $http_count && (bool) get_post_meta( $test_post_id, \Profile\Delivery\BLOCKED_META, true ), 'Duplicate CA rows did not suspend delivery before HTTP.' );
		profile_storage_assert( 2 === count( get_post_meta( $test_post_id, '_profile_post_cas', false ) ), 'Duplicate CA rows were overwritten.' );
		delete_post_meta( $test_post_id, '_profile_post_cas' );
		add_post_meta( $test_post_id, '_profile_post_cas', array( array( 'test-ca' ) ) );
	}
	update_post_meta( $test_post_id, '_profile_post_cas', array( array( 'competing-ca' ) ) );

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
	profile_storage_assert( 20 === $http_count, 'Unexpected HTTP request count.' );

	// A more expansion failure on a later page must preserve CA with delivery suspended.
	clean_post_cache( $test_post_id );
	wp_update_post(
		array(
			'ID'           => $test_post_id,
			'post_content' => 'Intro<!--more-->Body<!--nextpage--><!-- wp:more ' . str_repeat( 'x', 200 ) . ' --><!--more-->Second page',
		)
	);
	$previous_cas = array( array( 'saved-before-more-error' ) );
	update_post_meta( $test_post_id, '_profile_post_cas', $previous_cas );
	delete_post_meta( $test_post_id, \Profile\Delivery\BLOCKED_META );
	$requests_before = $http_count;
	$limit           = ini_get( 'pcre.backtrack_limit' );
	try {
		// phpcs:ignore WordPress.PHP.IniSet -- Reproduce a regex failure and restore the limit in finally.
		ini_set( 'pcre.backtrack_limit', '100' );
		$result = \Profile\Issue\issue_post( get_post( $test_post_id ) );
	} finally {
		// phpcs:ignore WordPress.PHP.IniSet -- Restore the original regex limit.
		ini_set( 'pcre.backtrack_limit', $limit );
	}
	profile_storage_assert( 'failed' === $result['status'] && str_contains( $result['message'], '署名対象のデータを作成できなかった' ), 'A more expansion failure was not rejected before issuance.' );
	profile_storage_assert( $requests_before === $http_count, 'A partial CA was issued after a more expansion failure.' );
	profile_storage_assert( get_post_meta( $test_post_id, '_profile_post_cas', true ) === $previous_cas, 'A more expansion failure overwrote the saved CA.' );
	profile_storage_assert( (bool) get_post_meta( $test_post_id, \Profile\Delivery\BLOCKED_META, true ), 'A more expansion failure did not suspend delivery.' );

	wp_update_post(
		array(
			'ID'           => $test_post_id,
			'post_content' => 'Intro<!--more-->Body<!--nextpage-->Intro2<!--more-->Body2',
		)
	);
	$result = \Profile\Issue\issue_post( get_post( $test_post_id ) );
	profile_storage_assert( 'success' === $result['status'] && $requests_before + 2 === $http_count, 'Reissuing all pages after fixing more content failed.' );
	profile_storage_assert( array( array( 'test-ca' ), array( 'test-ca' ) ) === get_post_meta( $test_post_id, '_profile_post_cas', true ), 'Reissuing more content did not replace every page CA.' );
	profile_storage_assert( ! get_post_meta( $test_post_id, \Profile\Delivery\BLOCKED_META, true ), 'Successful reissuance did not resume delivery.' );
	WP_CLI::success( 'CA storage checks passed: 18 stale-cache cases, 4 missing-only empty values, query errors, duplicates, conflicts, post changes, row locks, reconnects, failed commit, caller transaction, more expansion failure and recovery.' );
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
