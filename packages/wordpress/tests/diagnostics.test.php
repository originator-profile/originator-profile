<?php declare(strict_types=1);
use PHPUnit\Framework\TestCase;

require_once __DIR__ . '/../includes/diagnostics.php';
use function Profile\Diagnostics\auth_mode;
use function Profile\Diagnostics\classify_authentication;
use function Profile\Diagnostics\classify_reachability;
use function Profile\Diagnostics\request_args;
use function Profile\Diagnostics\stage;
use function Profile\Diagnostics\summarize;

final class Diagnostics extends TestCase {
	public function test_auth_mode_は認証情報の接頭辞で方式を判定する() {
		$this->assertSame( 'oidc', auth_mode( 'OIDC:eyJ9' ) );
		$this->assertSame( 'ccsp', auth_mode( 'CCSP:eyJ9' ) );
		$this->assertSame( 'basic', auth_mode( 'user:password' ) );
		$this->assertSame( 'basic', auth_mode( 'oidc:password' ) );
	}

	public function test_classify_reachability_はCAサーバーのJSONエラー応答を接続成功とする() {
		$this->assertSame( 'ok', classify_reachability( 401, '{"statusCode":401}' )['status'] );
		$this->assertSame( 'ok', classify_reachability( 400, '{"statusCode":400}' )['status'] );
		$this->assertSame( 'ng', classify_reachability( 401, '<html></html>' )['status'] );
		$this->assertSame( 'ng', classify_reachability( 200, '{}' )['status'] );
		$this->assertSame( 'ng', classify_reachability( 404, '404 Not Found' )['status'] );
		$this->assertStringContainsString( 'HTTP 404', classify_reachability( 404, '' )['message'] );
	}

	public function test_classify_authentication_は認証なしで401のサーバーに限り400を認証成功とする() {
		$this->assertSame( 'ok', classify_authentication( 400, 401 )['status'] );
		$this->assertSame( 'ng', classify_authentication( 401, 401 )['status'] );
		$this->assertSame( 'ng', classify_authentication( 401, 400 )['status'] );
		// A server that validates the body first returns 400 even for wrong credentials.
		$this->assertSame( 'unverified', classify_authentication( 400, 400 )['status'] );
		foreach ( array( 200, 403, 404, 500 ) as $status ) {
			$this->assertSame( 'unverified', classify_authentication( $status, 401 )['status'] );
		}
	}

	public function test_summarize_はNGを優先し次に未確認を警告にする() {
		$this->assertSame( 'success', summarize( array( stage( 'ok', '' ), stage( 'ok', '' ) ) ) );
		$this->assertSame( 'warning', summarize( array( stage( 'ok', '' ), stage( 'unverified', '' ) ) ) );
		$this->assertSame( 'error', summarize( array( stage( 'ng', '' ), stage( 'unverified', '' ) ) ) );
	}

	public function test_request_args_は空のJSONをPOSTしリダイレクトしない() {
		$args = request_args( array( 'authorization' => 'Basic x' ) );
		$this->assertSame( 'POST', $args['method'] );
		$this->assertSame( '{}', $args['body'] );
		$this->assertSame( 0, $args['redirection'] );
		$this->assertSame( 'Basic x', $args['headers']['authorization'] );
		$this->assertSame( 'application/json', $args['headers']['content-type'] );
		// Private addresses and non-standard ports are allowed, as in normal CA issuance.
		$this->assertArrayNotHasKey( 'reject_unsafe_urls', $args );
		$this->assertArrayNotHasKey( 'authorization', request_args()['headers'] );
	}
}
