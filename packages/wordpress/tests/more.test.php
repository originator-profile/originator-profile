<?php declare(strict_types=1);
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

require_once __DIR__ . '/../includes/issue.php';
use function Profile\Issue\expand_more_tag;
use function Profile\Issue\prepare_post_pages;

final class More extends TestCase {
	public function test_noteaser_on_later_page_hides_only_first_page_teaser() {
		$pages = array( '導入1<!--more-->本文1', '導入2<!--more--><!--noteaser-->本文2' );
		$this->assertSame(
			array( '<span id="more-42"></span>本文1', '導入2<span id="more-42"></span><!--noteaser-->本文2' ),
			prepare_post_pages( $pages, 42, implode( '<!--nextpage-->', $pages ) )
		);
	}

	public function test_pages_without_noteaser_preserve_both_teasers() {
		$pages = array( '導入1<!--more-->本文1', '導入2<!--more-->本文2' );
		$this->assertSame(
			array( '導入1<span id="more-42"></span>本文1', '導入2<span id="more-42"></span>本文2' ),
			prepare_post_pages( $pages, 42, implode( '<!--nextpage-->', $pages ) )
		);
	}

	// phpcs:disable WordPress.PHP.IniSet -- 正規表現エラーを再現し、finally で設定を復元するテスト.
	public function test_regex_match_failure_is_not_treated_as_absent_more_tag() {
		$limit = ini_get( 'pcre.backtrack_limit' );
		try {
			ini_set( 'pcre.backtrack_limit', '100' );
			$this->assertFalse( expand_more_tag( '<!--more ' . str_repeat( 'x', 200 ) . '-->本文', 42 ) );
			$this->assertSame( PREG_BACKTRACK_LIMIT_ERROR, preg_last_error() );
		} finally {
			ini_set( 'pcre.backtrack_limit', $limit );
		}
	}

	public function test_regex_replace_failure_rejects_the_entire_post() {
		$content = '<!-- wp:more ' . str_repeat( 'x', 200 ) . ' --><!--more-->本文';
		$limit   = ini_get( 'pcre.backtrack_limit' );
		try {
			ini_set( 'pcre.backtrack_limit', '100' );
			$this->assertSame( 1, preg_match( '/<!--more(.*?)?-->/', $content ) );
			$this->assertFalse( expand_more_tag( $content, 42 ) );
			$this->assertSame( PREG_BACKTRACK_LIMIT_ERROR, preg_last_error() );
			$pages = array( '導入<!--more-->本文', $content );
			$this->assertFalse( prepare_post_pages( $pages, 42, implode( '<!--nextpage-->', $pages ) ) );
		} finally {
			ini_set( 'pcre.backtrack_limit', $limit );
		}
	}

	// phpcs:enable WordPress.PHP.IniSet

	#[DataProvider( 'contents' )]
	public function test_more_tag_matches_singular_content( string $content, bool $strip_teaser, string $expected ) {
		$this->assertSame( $expected, expand_more_tag( $content, 42, $strip_teaser ) );
	}

	public static function contents(): array {
		$anchor = '<span id="more-42"></span>';
		return array(
			'no more tag'                         => array( '<p>本文</p>', false, '<p>本文</p>' ),
			'classic editor'                      => array( '<p>導入</p><!--more--><p>本文</p>', false, '<p>導入</p>' . $anchor . '<p>本文</p>' ),
			'custom link text'                    => array( '導入<!--more 続きを読む-->本文', false, '導入' . $anchor . '本文' ),
			'inline more tag'                     => array( '<p>導入<!--more-->本文</p>', false, '<p>導入' . $anchor . '本文</p>' ),
			'block editor'                        => array( '<!-- wp:paragraph --><p>導入</p><!-- /wp:paragraph --><!-- wp:more --><!--more--><!-- /wp:more --><!-- wp:paragraph --><p>本文</p><!-- /wp:paragraph -->', false, '<!-- wp:paragraph --><p>導入</p><!-- /wp:paragraph -->' . $anchor . '<!-- wp:paragraph --><p>本文</p><!-- /wp:paragraph -->' ),
			'noteaser'                            => array( '導入<!--more--><!--noteaser-->本文', true, $anchor . '<!--noteaser-->本文' ),
			'block noteaser'                      => array( '導入<!-- wp:more {"noTeaser":true} --><!--more--><!--noteaser--><!-- /wp:more -->本文', true, $anchor . '<!--noteaser-->本文' ),
			'later page teaser'                   => array( '導入<!--more--><!--noteaser-->本文', false, '導入' . $anchor . '<!--noteaser-->本文' ),
			'noteaser without more'               => array( '導入<!--noteaser-->本文', true, '導入<!--noteaser-->本文' ),
			'empty teaser'                        => array( '<!--more-->本文', false, $anchor . '本文' ),
			'empty extended text'                 => array( '導入<!--more-->', false, '導入' . $anchor ),
			'only first more tag'                 => array( '導入<!--more-->本文<!--more-->続き', false, '導入' . $anchor . '本文<!--more-->続き' ),
			'marker removed with malformed block' => array( '<!-- wp:more <!--more custom--> -->本文', false, '本文' ),
			'removed marker with hidden teaser'   => array( '<!-- wp:more <!--more custom--> -->本文', true, '' ),
		);
	}
}
