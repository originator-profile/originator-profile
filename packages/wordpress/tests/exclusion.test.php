<?php declare(strict_types=1);

use PHPUnit\Framework\TestCase;

require_once __DIR__ . '/../includes/exclusion.php';

use function Profile\Exclusion\is_excluded;
use function Profile\Exclusion\parse_rules;

final class Exclusion extends TestCase {
	public function test_parse_rulesは行をトリムし空行と重複を除く() {
		$this->assertSame(
			array( '/blog/*', '/blog/**' ),
			parse_rules( "  /blog/* \r\n\n/blog/*\n /blog/** \n" )
		);
	}

	public function test_parse_rulesはWordPressのサニタイズ後の配列を受け付ける() {
		$this->assertSame(
			array( '/one', '/two' ),
			parse_rules( array( ' /one ', '', '/two', '/one' ) )
		);
	}

	public function test_starはスラッシュをまたがずダブルスターはまたぐ() {
		$this->assertTrue( is_excluded( 'https://example.com/blog/article', array( '/blog/*' ) ) );
		$this->assertFalse( is_excluded( 'https://example.com/blog/2026/article', array( '/blog/*' ) ) );
		$this->assertTrue( is_excluded( 'https://example.com/blog/2026/article', array( '/blog/**' ) ) );
	}

	public function test_doubleスターは基底パス自体にはマッチしない() {
		$this->assertFalse( is_excluded( 'https://example.com/blog', array( '/blog/**' ) ) );
		$this->assertFalse( is_excluded( 'https://example.com/blog/', array( '/blog/**' ) ) );
		$this->assertTrue( is_excluded( 'https://example.com/blog/entry/', array( '/blog/**' ) ) );
	}

	public function test_pathルールは絶対URLのパスとクエリだけを照合する() {
		$this->assertTrue( is_excluded( 'https://one.example/entry/?p=123', array( '/entry?p=123' ) ) );
		$this->assertTrue( is_excluded( 'https://two.example/entry?p=123', array( '/entry?p=123' ) ) );
		$this->assertFalse( is_excluded( 'https://one.example/entry?p=456', array( '/entry?p=123' ) ) );
	}

	public function test_absoluteルールはスキームとホストを含めて大文字小文字を区別する() {
		$this->assertTrue( is_excluded( 'https://Example.com/News/#section', array( 'https://Example.com/News' ) ) );
		$this->assertFalse( is_excluded( 'https://example.com/News', array( 'https://Example.com/News' ) ) );
		$this->assertFalse( is_excluded( 'http://Example.com/News', array( 'https://Example.com/News' ) ) );
	}

	public function test_pathの末尾スラッシュを正規化しルートは保持する() {
		$this->assertTrue( is_excluded( 'https://example.com/path/', array( '/path' ) ) );
		$this->assertTrue( is_excluded( 'https://example.com/path', array( '/path/' ) ) );
		$this->assertTrue( is_excluded( 'https://example.com/', array( '/' ) ) );
		$this->assertTrue( is_excluded( 'https://example.com/?p=123#fragment', array( '/?p=123' ) ) );
	}

	public function test正規表現のメタ文字はリテラルとして扱う() {
		$rule = '/literal.+(part)[x]$^|{}';
		$this->assertTrue( is_excluded( 'https://example.com/literal.+(part)[x]$^|{}', array( $rule ) ) );
		$this->assertFalse( is_excluded( 'https://example.com/literal123partx', array( $rule ) ) );
		$this->assertTrue( is_excluded( 'https://example.com/?a?b', array( '/?a?b' ) ) );
		$this->assertFalse( is_excluded( 'https://example.com/?ab', array( '/?a?b' ) ) );
	}

	public function test_parse_rulesは不正な型とルールを拒否する() {
		$this->assertInvalid( static fn() => parse_rules( null ), '文字列または文字列の配列' );
		$this->assertInvalid( static fn() => parse_rules( array( '/ok', 1 ) ), '文字列で指定' );
		$this->assertInvalid( static fn() => parse_rules( array( '/has space' ) ), '空白' );
		$this->assertInvalid( static fn() => parse_rules( array( "/has\0nul" ) ), '制御文字' );
		$this->assertInvalid( static fn() => parse_rules( array( '/with#fragment' ) ), 'フラグメント' );
		$this->assertInvalid( static fn() => parse_rules( array( 'example.com/path' ) ), '絶対URL' );
		$this->assertInvalid( static fn() => parse_rules( array( '//example.com/path' ) ), ' / で始まるパス' );
		$this->assertInvalid( static fn() => parse_rules( array( 'https://user:pass@example.com/path' ) ), '認証情報' );
		$this->assertInvalid( static fn() => parse_rules( array( 'https://*.example.com/path' ) ), 'ワイルドカード' );
		$this->assertInvalid( static fn() => parse_rules( array( 'ftp://example.com/path' ) ), 'http または https' );
	}

	public function test_parse_rulesの上限を検証する() {
		$rules = array();
		for ( $index = 0; $index < 201; ++$index ) {
			$rules[] = '/item-' . $index;
		}
		$this->assertInvalid( static fn() => parse_rules( $rules ), '200件以下' );
		$this->assertInvalid( static fn() => parse_rules( array( '/' . str_repeat( 'a', 2048 ) ) ), '2048バイト以内' );

		$rules = array();
		for ( $index = 0; $index < 33; ++$index ) {
			$rules[] = '/' . str_repeat( 'a', 2044 ) . str_pad( (string) $index, 2, '0', STR_PAD_LEFT );
		}
		$this->assertInvalid( static fn() => parse_rules( $rules ), '65536バイト以内' );
	}

	public function test_is_excludedはルールが空でも対象URLを検証する() {
		$this->assertFalse( is_excluded( 'https://example.com/anywhere', array() ) );
		$this->assertInvalid( static fn() => is_excluded( '/relative/path', array() ), '絶対URL' );
		$this->assertInvalid( static fn() => is_excluded( 'ftp://example.com/path', array() ), 'http または https' );
		$this->assertInvalid( static fn() => is_excluded( 'https://example.com/path with space', array() ), '空白' );
		$this->assertInvalid( static fn() => is_excluded( 'https://user:pass@example.com/path', array() ), '認証情報' );
	}

	public function test_is_excludedは不正なルール配列を拒否する() {
		$this->assertInvalid( static fn() => is_excluded( 'https://example.com/path', array( '/path#fragment' ) ), 'フラグメント' );
		$this->assertInvalid( static fn() => is_excluded( 'https://example.com/path', array( '/path', false ) ), '文字列で指定' );
	}

	public function test有効なIPv6と不正なホストを区別する() {
		$this->assertTrue( is_excluded( 'http://[::1]:9000/path', array( '/path' ) ) );
		foreach ( array( 'http://[123]/path', 'http://bad_host/path', 'http://example.com:/path', 'http://[::1]:99999/path' ) as $url ) {
			$this->assertInvalid( static fn() => is_excluded( $url, array() ), '不正' );
		}
	}

	public function testゼロ文字全体一致クエリ順序とエンコードを保持する() {
		$this->assertTrue( is_excluded( 'https://example.com/ab', array( '/a*b' ) ) );
		$this->assertTrue( is_excluded( 'https://example.com/ab', array( '/a**b' ) ) );
		$this->assertFalse( is_excluded( 'https://example.com/abc', array( '/ab' ) ) );
		$this->assertFalse( is_excluded( 'https://example.com/?b=2&a=1', array( '/?a=1&b=2' ) ) );
		$this->assertTrue( is_excluded( 'https://example.com/%E6%97%A5', array( '/%E6%97%A5' ) ) );
		$this->assertFalse( is_excluded( 'https://example.com/%2F', array( '/' ) ) );
	}

	public function test国際化ドメインでも未設定なら除外せずルールを照合できる() {
		$this->assertFalse( is_excluded( 'https://例え.jp/?p=1', array() ) );
		$this->assertTrue( is_excluded( 'https://例え.jp/blog/article', array( '/blog/**' ) ) );
		$this->assertTrue( is_excluded( 'https://例え.jp/blog/article', array( 'https://例え.jp/blog/**' ) ) );
		$this->assertFalse( is_excluded( 'https://別.jp/blog/article', array( 'https://例え.jp/blog/**' ) ) );
		$this->assertFalse( is_excluded( 'https://例え.jp/Blog/article', array( 'https://例え.jp/blog/**' ) ) );
		$this->assertFalse( is_excluded( 'https://xn--r8jz45g.jp/?p=1', array() ) );
		$this->assertSame( array( 'https://例え.jp/**' ), parse_rules( 'https://例え.jp/**' ) );
	}

	public function test国際化ドメインでも不正なホスト構文は拒否する() {
		foreach ( array( 'https://-例え.jp/', 'https://例え-.jp/', 'https://例え..jp/', 'https://例_え.jp/', 'https://例え.jp]/' ) as $url ) {
			$this->assertInvalid( static fn() => is_excluded( $url, array() ), '不正' );
		}
	}

	/**
	 * InvalidArgumentException と、日本語の利用者向けメッセージを確認する。
	 *
	 * @param callable $callback Callback to execute.
	 * @param string   $message Expected message fragment.
	 */
	private function assertInvalid( callable $callback, string $message ): void {
		try {
			$callback();
			$this->fail( 'InvalidArgumentException が発生しませんでした。' );
		} catch ( \InvalidArgumentException $error ) {
			$this->assertStringContainsString( $message, $error->getMessage() );
		}
	}
}
