<?php declare(strict_types=1);
use PHPUnit\Framework\TestCase;

const WP_CONTENT_DIR = '/tmp';


require_once __DIR__ . '/../includes/config.php';
use const Profile\Config\PROFILE_DEFAULT_CA_TARGET_HTML;

require_once __DIR__ . '/../includes/issue.php';
use function Profile\Issue\content_to_html;
use function Profile\Issue\find_images_without_integrity;

final class Issue extends TestCase {
	public function test_content_to_html_関数はHTMLを返す() {
		$content = <<<'EOD'
<p>本文1</p>


<p>本文2</p>
EOD;

		$text = content_to_html( $content, PROFILE_DEFAULT_CA_TARGET_HTML, 'テストタイトル' );
		$this->assertSame(
			<<<'EOD'
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body><h1 class="wp-block-post-title">テストタイトル</h1><div class="wp-block-post-content"><p>本文1</p>


<p>本文2</p></div></body>
</html>
EOD
			,
			$text
		);
	}

	public function test_content_to_html_タイトルが正しく埋め込まれる() {
		$content = '<p>本文</p>';
		$title   = 'タイトルテキスト';

		$text = content_to_html( $content, PROFILE_DEFAULT_CA_TARGET_HTML, $title );
		$this->assertStringContainsString(
			'<h1 class="wp-block-post-title">タイトルテキスト</h1>',
			$text
		);
	}

	public function test_content_to_html_タイトルを省略した場合は空文字で埋め込まれる() {
		$content = '<p>本文</p>';

		$text = content_to_html( $content, PROFILE_DEFAULT_CA_TARGET_HTML );
		$this->assertStringContainsString(
			'<h1 class="wp-block-post-title"></h1>',
			$text
		);
	}

	public function test_content_to_html_TITLEプレースホルダーを含まないテンプレートではh1タグが出力されない() {
		$content  = '<p>本文</p>';
		$template = '<body class="wp-block-post-content">%CONTENT%</body>';

		$text = content_to_html( $content, $template, 'タイトル' );
		$this->assertStringNotContainsString( '<h1', $text );
		$this->assertStringNotContainsString( 'タイトル', $text );
		$this->assertSame( '<body class="wp-block-post-content"><p>本文</p></body>', $text );
	}

	public function test_find_images_without_integrity関数はintegrity属性の無い画像のsrcを返す() {
		$html = <<<'EOD'
<div class="wp-block-post-content">
<figure class="wp-block-image size-full"><img src="https://example.com/a.png" /></figure>
</div>
EOD;

		$this->assertSame(
			array( 'https://example.com/a.png' ),
			find_images_without_integrity( $html )
		);
	}

	public function test_find_images_without_integrity関数はintegrity属性のある画像を除外する() {
		$html = <<<'EOD'
<div class="wp-block-post-content">
<figure class="wp-block-image size-full"><img src="https://example.com/a.png" integrity="sha256-xxx" /></figure>
</div>
EOD;

		$this->assertSame( array(), find_images_without_integrity( $html ) );
	}

	public function test_find_images_without_integrity関数はwp_block_image外の画像を除外する() {
		$html = '<img src="https://example.com/outside.png" />';

		$this->assertSame( array(), find_images_without_integrity( $html ) );
	}
}
