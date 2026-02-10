<?php declare(strict_types=1);
use PHPUnit\Framework\TestCase;

require_once __DIR__ . '/../includes/issue.php';
use function Profile\Issue\extract_uuid_from_jwt;

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
}
