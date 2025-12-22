<?php
/** 未署名 Content Attestation */

namespace Profile\Uca;

require_once __DIR__ . '/config.php';

/**
 * 未署名 Content Attestation
 *
 * @link https://docs.originator-profile.org/en/opb/ca-model/article/
 */
final class Uca {
	/**
	 * 未署名 Content Attestation
	 *
	 * @param string  $issuer CA 発行者
	 * @param string  $url 投稿のパーマリンクURL
	 * @param string  $locale ロケール
	 * @param string  $html HTML
	 * @param string  $target_type 検証対象の種別
	 * @param string  $target_css_selector 検証する対象の要素 CSS セレクター
	 * @param array   $external_resources 外部リソース
	 * @param string  $headline タイトル
	 * @param string  $description 説明
	 * @param ?string $image (optional) 画像URL
	 * @param ?string $author (optional) 著者
	 * @param ?string $date_published (optional) 公開日時
	 * @param ?string $date_modified (optional) 最終更新日時
	 */
	public function __construct(
		public string $issuer,
		public string $url,
		public string $locale,
		public string $html,
		public string $target_type,
		public string $target_css_selector,
		public array $external_resources,
		public string $headline,
		public string $description,
		public ?string $image = null,
		public ?string $author = null,
		public ?string $date_published = null,
		public ?string $date_modified = null,
	) {}


	/**
	 * JSON への変換
	 *
	 * @return mixed JSON
	 */
	public function to_json(): string|false {
		$uca = array(
			'@context'          => array(
				'https://www.w3.org/ns/credentials/v2',
				'https://originator-profile.org/ns/credentials/v1',
				'https://originator-profile.org/ns/cip/v1',
				array(
					'@language' => $this->locale,
				),
			),
			'type'              => array( 'VerifiableCredential', 'ContentAttestation' ),
			'issuer'            => $this->issuer,
			'credentialSubject' => array(
				'type'          => 'Article',
				'headline'      => $this->headline,
				'image'         => $this->image ? array( 'id' => $this->image ) : null,
				'description'   => $this->description,
				'author'        => $this->author ? array( $this->author ) : null,
				'datePublished' => $this->date_published,
				'dateModified'  => $this->date_modified,
			),
			'allowedUrl'        => $this->url,
			'target'            => array_merge(
				array(
					array(
						'type'        => $this->target_type,
						'content'     => $this->html,
						'cssSelector' => $this->target_css_selector,
					),
				),
				array_map(
					fn( $integrity ) => array(
						'type'      => 'ExternalResourceTargetIntegrity',
						'integrity' => $integrity,
					),
					$this->external_resources,
				)
			),
		);

		$uca['credentialSubject'] = array_filter(
			$uca['credentialSubject'],
			function ( mixed $val ) {
				return ! is_null( $val );
			}
		);

		$json = \wp_json_encode( $uca );
		if ( false === $json ) {
			debug( 'Failed to encode UCA to JSON' );
		}
		return $json;
	}
}
