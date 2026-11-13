<?php declare(strict_types=1);
use PHPUnit\Framework\TestCase;

require_once __DIR__ . '/../includes/class-uca.php';
use Profile\Uca\Uca;

final class Uca_Data_Url extends TestCase {
	private const PREFIX = 'data:text/html;charset=utf-8;base64,';

	public function test_html_to_data_urlメソッドはHTMLをBase64のdata_URLに変換する() {
		$html = '<!DOCTYPE html><html><body><p>本文 & "引用" \'一重引用符\'</p></body></html>';
		$url  = Uca::html_to_data_url( $html );

		$this->assertStringStartsWith( self::PREFIX, $url );
		// phpcs:ignore WordPress.PHP.DiscouragedPHPFunctions.obfuscation_base64_decode
		$this->assertSame( $html, base64_decode( substr( $url, strlen( self::PREFIX ) ), true ) );
	}

	public function test_html_to_data_urlメソッドの結果にはSQLに似た文字列が現れない() {
		$html = "<p>' OR 1=1; DROP TABLE users; -- UNION SELECT password FROM wp_users</p>";
		$url  = Uca::html_to_data_url( $html );

		$this->assertMatchesRegularExpression( '#^[A-Za-z0-9+/]+={0,2}$#', substr( $url, strlen( self::PREFIX ) ) );
		$this->assertStringNotContainsString( 'SELECT', $url );
		$this->assertStringNotContainsString( "'", $url );
	}

	public function test_html_to_data_urlメソッドは空のHTMLも変換できる() {
		$this->assertSame( self::PREFIX, Uca::html_to_data_url( '' ) );
	}
}
