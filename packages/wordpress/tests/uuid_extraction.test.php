<?php declare(strict_types=1);
use PHPUnit\Framework\TestCase;

require_once __DIR__ . '/../includes/issue.php';
use function Profile\Issue\extract_uuid_from_jwt;
use function Profile\Issue\extract_page_uuid;
use function Profile\Issue\extract_cas_uuids;

final class Uuid_Extraction extends TestCase {
	public function test_extract_uuid_from_jwt_empty_string() {
		$this->assertFalse( extract_uuid_from_jwt( '' ) );
	}

	public function test_extract_uuid_from_jwt_invalid_format() {
		$this->assertFalse( extract_uuid_from_jwt( 'test.test ' ) );
	}

	public function test_extract_uuid_from_jwt_invalid_base64() {
		$this->assertFalse( extract_uuid_from_jwt( 'test.test.test' ) );
	}

	public function test_extract_uuid_from_jwt_invalid_json() {
        // phpcs:ignore WordPress.PHP.DiscouragedPHPFunctions.obfuscation_base64_encode
		$payload = base64_encode( 'not json' );
		$jwt     = 'test.' . rtrim( strtr( $payload, '+/', '-_' ), '=' ) . '.test';
		$this->assertFalse( extract_uuid_from_jwt( $jwt ) );
	}

	public function test_extract_uuid_from_jwt_missing_id() {
		// phpcs:ignore WordPress.WP.AlternativeFunctions.json_encode_json_encode
		$json = json_encode( array( 'credentialSubject' => array() ) );
		// phpcs:ignore WordPress.PHP.DiscouragedPHPFunctions.obfuscation_base64_encode
		$payload = base64_encode( $json );
		$jwt     = 'test.' . rtrim( strtr( $payload, '+/', '-_' ), '=' ) . '.test';
		$this->assertFalse( extract_uuid_from_jwt( $jwt ) );
	}

	public function test_extract_uuid_from_jwt_success() {
		$uuid = 'urn:uuid:7e506a72-4ac8-427b-bb14-cc47fcbef522';
		// phpcs:ignore WordPress.PHP.DiscouragedPHPFunctions.obfuscation_base64_encode
		$payload = base64_encode(
			// phpcs:ignore WordPress.WP.AlternativeFunctions.json_encode_json_encode
			json_encode(
				array(
					'credentialSubject' => array( 'id' => $uuid ),
				)
			)
		);
		$jwt = 'test.' . rtrim( strtr( $payload, '+/', '-_' ), '=' ) . '.test';

		$this->assertSame( $uuid, extract_uuid_from_jwt( $jwt ) );
	}
	private function jwt( string $uuid ): string {
		// phpcs:ignore WordPress.PHP.DiscouragedPHPFunctions.obfuscation_base64_encode, WordPress.WP.AlternativeFunctions.json_encode_json_encode
		$payload = base64_encode( json_encode( array( 'credentialSubject' => array( 'id' => $uuid ) ) ) );
		return 'test.' . rtrim( strtr( $payload, '+/', '-_' ), '=' ) . '.test';
	}

	public function test_extract_page_uuid_from_paginated_cas() {
		$cas = array( array( $this->jwt( 'urn:uuid:page-1' ) ), array( $this->jwt( 'urn:uuid:page-2' ) ) );
		$this->assertSame( 'urn:uuid:page-1', extract_page_uuid( $cas, 1 ) );
		$this->assertSame( 'urn:uuid:page-2', extract_page_uuid( $cas, 2 ) );
		$this->assertFalse( extract_page_uuid( $cas, 3 ) );
	}

	public function test_extract_page_uuid_from_single_cas() {
		$cas = array( $this->jwt( 'urn:uuid:single' ) );
		$this->assertSame( 'urn:uuid:single', extract_page_uuid( $cas, 1 ) );
		$this->assertFalse( extract_page_uuid( $cas, 2 ) );
	}

	public function test_extract_page_uuid_from_legacy_string() {
		$this->assertSame( 'urn:uuid:legacy', extract_page_uuid( $this->jwt( 'urn:uuid:legacy' ), 1 ) );
		$this->assertFalse( extract_page_uuid( $this->jwt( 'urn:uuid:legacy' ), 2 ) );
	}

	public function test_extract_page_uuid_from_empty_values() {
		foreach ( array( null, '', array(), array( array() ), array( 'not-a-jwt' ) ) as $cas ) {
			$this->assertFalse( extract_page_uuid( $cas, 1 ) );
		}
	}
	public function test_extract_cas_uuids() {
		$this->assertSame(
			array( 'urn:uuid:page-1', 'urn:uuid:page-3' ),
			extract_cas_uuids( array( array( $this->jwt( 'urn:uuid:page-1' ) ), array(), array( $this->jwt( 'urn:uuid:page-3' ) ) ) )
		);
		$this->assertSame( array( 'urn:uuid:single' ), extract_cas_uuids( array( $this->jwt( 'urn:uuid:single' ) ) ) );
		$this->assertSame( array( 'urn:uuid:legacy' ), extract_cas_uuids( $this->jwt( 'urn:uuid:legacy' ) ) );
		$this->assertSame( array(), extract_cas_uuids( '' ) );
	}

	public function test_extract_cas_uuids_removes_duplicates() {
		$jwt = $this->jwt( 'urn:uuid:shared' );
		$this->assertSame( array( 'urn:uuid:shared' ), extract_cas_uuids( array( array( $jwt ), array( $jwt ) ) ) );
	}
}
