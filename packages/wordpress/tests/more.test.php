<?php declare(strict_types=1);
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

require_once __DIR__ . '/../includes/issue.php';
use function Profile\Issue\expand_more_tag;

final class More extends TestCase {
	#[DataProvider( 'contents' )]
	public function test_more_tag_matches_singular_content( string $content, bool $strip_teaser, string $expected ) {
		$this->assertSame( $expected, expand_more_tag( $content, 42, $strip_teaser ) );
	}

	public static function contents(): array {
		$anchor = '<span id="more-42"></span>';
		return array(
			'no more tag'           => array( '<p>本文</p>', false, '<p>本文</p>' ),
			'classic editor'        => array( '<p>導入</p><!--more--><p>本文</p>', false, '<p>導入</p>' . $anchor . '<p>本文</p>' ),
			'custom link text'      => array( '導入<!--more 続きを読む-->本文', false, '導入' . $anchor . '本文' ),
			'inline more tag'       => array( '<p>導入<!--more-->本文</p>', false, '<p>導入' . $anchor . '本文</p>' ),
			'block editor'          => array( '<!-- wp:paragraph --><p>導入</p><!-- /wp:paragraph --><!-- wp:more --><!--more--><!-- /wp:more --><!-- wp:paragraph --><p>本文</p><!-- /wp:paragraph -->', false, '<!-- wp:paragraph --><p>導入</p><!-- /wp:paragraph -->' . $anchor . '<!-- wp:paragraph --><p>本文</p><!-- /wp:paragraph -->' ),
			'noteaser'              => array( '導入<!--more--><!--noteaser-->本文', true, $anchor . '<!--noteaser-->本文' ),
			'block noteaser'        => array( '導入<!-- wp:more {"noTeaser":true} --><!--more--><!--noteaser--><!-- /wp:more -->本文', true, $anchor . '<!--noteaser-->本文' ),
			'later page teaser'     => array( '導入<!--more--><!--noteaser-->本文', false, '導入' . $anchor . '<!--noteaser-->本文' ),
			'noteaser without more' => array( '導入<!--noteaser-->本文', true, '導入<!--noteaser-->本文' ),
			'empty teaser'          => array( '<!--more-->本文', false, $anchor . '本文' ),
			'empty extended text'   => array( '導入<!--more-->', false, '導入' . $anchor ),
			'only first more tag'   => array( '導入<!--more-->本文<!--more-->続き', false, '導入' . $anchor . '本文<!--more-->続き' ),
		);
	}
}
