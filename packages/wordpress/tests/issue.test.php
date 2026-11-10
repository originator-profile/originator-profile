<?php declare(strict_types=1);
use PHPUnit\Framework\TestCase;

const WP_CONTENT_DIR = '/tmp';


require_once __DIR__ . '/../includes/config.php';
use const Profile\Config\PROFILE_DEFAULT_CA_TARGET_HTML;

require_once __DIR__ . '/../includes/issue.php';
use function Profile\Issue\content_to_html;
use function Profile\Issue\external_resources_from_html;
use const Profile\Issue\WP_BLOCK_IMAGE_XPATH;
use function Profile\Issue\find_images_without_integrity;
use function Profile\Issue\create_integrity;
use function Profile\Issue\image_block_attachment_ids;
use function Profile\Issue\valid_integrity_values;

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

	public function test_find_images_without_integrity関数はハッシュ部分が空のintegrity値を検出する() {
		$html = <<<'EOD'
<div class="wp-block-post-content">
<figure class="wp-block-image size-full"><img src="https://example.com/a.png" integrity="sha256-" /></figure>
</div>
EOD;

		$this->assertSame(
			array( 'https://example.com/a.png' ),
			find_images_without_integrity( $html )
		);
	}

	public function test_external_resources_from_html関数はwp_imageクラスからCSSセレクターを返す() {
		$html = <<<'EOD'
<div class="wp-block-post-content">
<figure class="wp-block-image size-full"><img src="https://example.com/a.png" class="wp-image-123" integrity="sha256-xxx sha256-yyy" /></figure>
</div>
EOD;

		$this->assertSame(
			array(
				array(
					'integrity'    => 'sha256-xxx sha256-yyy',
					'css_selector' => 'img.wp-image-123',
				),
			),
			external_resources_from_html( $html, WP_BLOCK_IMAGE_XPATH . '[@integrity]' )
		);
	}

	public function test_external_resources_from_html関数はwp_imageクラスが無ければCSSセレクターを返さない() {
		$html = <<<'EOD'
<div class="wp-block-post-content">
<figure class="wp-block-image size-full"><img src="https://example.com/a.png" class="wp-image-foo" integrity="sha256-xxx" /></figure>
</div>
EOD;

		$this->assertSame(
			array( array( 'integrity' => 'sha256-xxx' ) ),
			external_resources_from_html( $html, WP_BLOCK_IMAGE_XPATH . '[@integrity]' )
		);
	}

	public function test_create_integrity関数はファイルのSHA256ハッシュを返す() {
		$file = tempnam( sys_get_temp_dir(), 'integrity' );
		file_put_contents( $file, 'hello' ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_file_put_contents
		try {
			$this->assertSame( 'sha256-LPJNul+wow4m6DsqxbninhsWHlwfp0JecwQzYpOLmCQ=', create_integrity( $file ) );
		} finally {
			unlink( $file ); // phpcs:ignore WordPress.WP.AlternativeFunctions.unlink_unlink
		}
	}

	public function test_create_integrity関数は存在しないファイルに対してnullを返す() {
		$this->assertNull( create_integrity( sys_get_temp_dir() . '/profile-integrity-not-found-' . uniqid() . '.png' ) );
	}

	public function test_create_integrity関数はディレクトリに対してnullを返す() {
		$this->assertNull( create_integrity( sys_get_temp_dir() ) );
	}

	public function test_valid_integrity_values関数はハッシュ部分が空の値を除外する() {
		$this->assertSame(
			array( 'sha256-LPJNul+wow4m6DsqxbninhsWHlwfp0JecwQzYpOLmCQ=' ),
			valid_integrity_values(
				array(
					'full'      => 'sha256-',
					'thumbnail' => 'sha256-LPJNul+wow4m6DsqxbninhsWHlwfp0JecwQzYpOLmCQ=',
					'medium'    => '',
					'large'     => null,
				)
			)
		);
	}

	public function test_valid_integrity_values関数は配列以外に対して空配列を返す() {
		$this->assertSame( array(), valid_integrity_values( '' ) );
		$this->assertSame( array(), valid_integrity_values( 'sha256-xxx' ) );
	}

	public function test_image_block_attachment_ids関数は入れ子の画像ブロックのIDを返す() {
		$blocks = array(
			array(
				'blockName'   => 'core/image',
				'attrs'       => array( 'id' => 10 ),
				'innerBlocks' => array(),
			),
			array(
				'blockName'   => 'core/paragraph',
				'attrs'       => array(),
				'innerBlocks' => array(),
			),
			array(
				'blockName'   => 'core/group',
				'attrs'       => array(),
				'innerBlocks' => array(
					array(
						'blockName'   => 'core/image',
						'attrs'       => array( 'id' => '20' ),
						'innerBlocks' => array(),
					),
					array(
						'blockName'   => 'core/image',
						'attrs'       => array(),
						'innerBlocks' => array(),
					),
				),
			),
		);

		$this->assertSame( array( 10, 20 ), image_block_attachment_ids( $blocks ) );
	}
}
