<?php
/** CA発行対象URLの除外判定 */

namespace Profile\Exclusion;

const MAX_RULES            = 200;
const MAX_RULE_BYTES       = 2048;
const MAX_TOTAL_RULE_BYTES = 65536;

/**
 * 除外ルールを正規化・検証する。
 *
 * 入力は、設定画面から渡される改行区切りの文字列と、WordPress が
 * サニタイズした後に渡す文字列配列の両方を受け付ける。
 *
 * @param mixed $input 改行区切りの文字列、または文字列配列。
 * @return array<string> 重複と空行を除いた除外ルール。
 * @throws \InvalidArgumentException 入力またはルールが不正な場合.
 */
function parse_rules( mixed $input ): array {
	if ( is_string( $input ) ) {
		$lines = preg_split( '/\r\n|\r|\n/', $input );
		if ( false === $lines ) {
			throw new \InvalidArgumentException( '除外ルールを行に分割できません。' );
		}
	} elseif ( is_array( $input ) ) {
		$lines = $input;
	} else {
		throw new \InvalidArgumentException( '除外ルールは文字列または文字列の配列で指定してください。' );
	}

	$rules       = array();
	$seen        = array();
	$rule_count  = 0;
	$total_bytes = 0;

	foreach ( $lines as $line ) {
		if ( ! is_string( $line ) ) {
			throw new \InvalidArgumentException( '除外ルールの各行は文字列で指定してください。' );
		}

		// trim() で設定欄の前後の空白を許容する。ただし NUL 等の制御文字は残す。
		if ( 1 === preg_match( '/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/', $line ) ) {
			throw new \InvalidArgumentException( '除外ルールには制御文字を指定できません。' );
		}
		$rule = trim( $line );
		if ( '' === $rule ) {
			continue;
		}

		++$rule_count;
		if ( MAX_RULES < $rule_count ) {
			throw new \InvalidArgumentException( '除外ルールは200件以下で指定してください。' );
		}

		$rule_bytes = strlen( $rule );
		if ( MAX_RULE_BYTES < $rule_bytes ) {
			throw new \InvalidArgumentException( '除外ルールは1件あたり2048バイト以内で指定してください。' );
		}
		$total_bytes += $rule_bytes;
		if ( MAX_TOTAL_RULE_BYTES < $total_bytes ) {
			throw new \InvalidArgumentException( '除外ルールの合計は65536バイト以内で指定してください。' );
		}

		if ( false === preg_match( '//u', $rule ) ) {
			throw new \InvalidArgumentException( '除外ルールは正しいUTF-8文字列で指定してください。' );
		}
		if ( 1 === preg_match( '/\s/u', $rule ) ) {
			throw new \InvalidArgumentException( '除外ルールの内部に空白を指定できません。' );
		}

		validate_rule( $rule );
		if ( array_key_exists( $rule, $seen ) ) {
			continue;
		}
		$seen[ $rule ] = true;
		$rules[]       = $rule;
	}

	return $rules;
}

/**
 * URL が除外ルールのいずれかに一致するか判定する。
 *
 * @param string        $url 判定対象の絶対URL。
 * @param array<string> $rules 除外ルール。
 * @return bool 一致した場合は true。
 * @throws \InvalidArgumentException URL またはルールが不正な場合.
 */
function is_excluded( string $url, array $rules ): bool {
	$target = parse_absolute_url( $url, false );
	$rules  = parse_rules( $rules );

	foreach ( $rules as $rule ) {
		$pattern = compile_rule( $rule );
		$subject = '/' === $rule[0]
			? $target['path'] . ( $target['query_present'] ? '?' . $target['query'] : '' )
			: $target['value'];
		$matched = preg_match( $pattern, $subject );
		if ( false === $matched ) {
			throw new \InvalidArgumentException( '除外ルールの照合に失敗しました。' );
		}
		if ( 1 === $matched ) {
			return true;
		}
	}

	return false;
}

/**
 * ルールの形式を検証する。
 *
 * @param string $rule 除外ルール。
 * @return void
 * @throws \InvalidArgumentException ルールが不正な場合.
 */
function validate_rule( string $rule ): void {
	if ( false !== strpos( $rule, '#' ) ) {
		throw new \InvalidArgumentException( '除外ルールにフラグメント（#以降）は指定できません。' );
	}

	if ( '/' === $rule[0] ) {
		parse_path_reference( $rule );
		return;
	}

	parse_absolute_url( $rule, true );
}

/**
 * パス形式のルールを検証し、照合用の構成要素を返す。
 *
 * @param string $reference / で始まるURLパスとクエリ。
 * @return array{path:string,query:string,query_present:bool,value:string}
 * @throws \InvalidArgumentException ルールが不正な場合.
 */
function parse_path_reference( string $reference ): array {
	try {
		// phpcs:ignore WordPress.WP.AlternativeFunctions.parse_url_parse_url -- Pure PHP utility; WordPress is not available in unit tests.
		$parts = parse_url( $reference );
	} catch ( \ValueError $error ) {
		throw new \InvalidArgumentException( '除外ルールのパスまたはクエリが不正です。' );
	}
	if (
		! is_array( $parts ) ||
		! isset( $parts['path'] ) ||
		'/' !== $parts['path'][0] ||
		isset( $parts['scheme'] ) ||
		isset( $parts['host'] ) ||
		isset( $parts['user'] ) ||
		isset( $parts['pass'] ) ||
		isset( $parts['port'] )
	) {
		throw new \InvalidArgumentException( '除外ルールは / で始まるパスまたは絶対URLで指定してください。' );
	}

	$path          = normalize_path( $parts['path'] );
	$query_present = array_key_exists( 'query', $parts );
	$query         = $query_present ? (string) $parts['query'] : '';
	$normalized    = $path . ( $query_present ? '?' . $query : '' );

	return array(
		'path'          => $path,
		'query'         => $query,
		'query_present' => $query_present,
		'value'         => $normalized,
	);
}

/**
 * 絶対URLを検証し、照合用の構成要素を返す。
 *
 * Parse_url() は URL の構文確認に使えるが、返却された host だけでは
 * 元の大文字・小文字を失わないため、照合値の authority は入力から保持する。
 *
 * @param string $url URL。
 * @param bool   $is_rule ルールとして検証する場合は true。
 * @return array{authority:string,path:string,query:string,query_present:bool,value:string}
 * @throws \InvalidArgumentException URL が不正な場合.
 */
function parse_absolute_url( string $url, bool $is_rule ): array {
	$without_fragment = $url;
	if ( ! $is_rule ) {
		$fragment_position = strpos( $without_fragment, '#' );
		if ( false !== $fragment_position ) {
			$without_fragment = substr( $without_fragment, 0, $fragment_position );
		}
	}

	if ( '' === $without_fragment || ! preg_match( '~^[a-zA-Z][a-zA-Z0-9+.-]*://~', $without_fragment ) ) {
		throw new \InvalidArgumentException(
			$is_rule
				? '除外ルールは http または https の絶対URL、または / で始まるパスで指定してください。'
				: '対象URLは http または https の有効な絶対URLで指定してください。'
		);
	}
	if (
		strlen( $without_fragment ) > 65536 ||
		false === preg_match( '//u', $without_fragment ) ||
		1 === preg_match( '/[\x00-\x1F\x7F]/', $without_fragment ) ||
		1 === preg_match( '/\s/u', $without_fragment )
	) {
		throw new \InvalidArgumentException( $is_rule ? '除外ルールに制御文字または空白を指定できません。' : '対象URLに制御文字、空白、または長すぎる文字列を指定できません。' );
	}

	try {
		// phpcs:ignore WordPress.WP.AlternativeFunctions.parse_url_parse_url -- Pure PHP utility; WordPress is not available in unit tests.
		$parts = parse_url( $without_fragment );
	} catch ( \ValueError $error ) {
		throw new \InvalidArgumentException(
			$is_rule ? '除外ルールの絶対URLが不正です。' : '対象URLが不正です。'
		);
	}
	if ( ! is_array( $parts ) ) {
		throw new \InvalidArgumentException( $is_rule ? '除外ルールの絶対URLが不正です。' : '対象URLが不正です。' );
	}

	$scheme = $parts['scheme'] ?? '';
	if ( ! in_array( $scheme, array( 'http', 'https' ), true ) ) {
		throw new \InvalidArgumentException(
			$is_rule ? '除外ルールは http または https の絶対URLで指定してください。' : '対象URLは http または https の絶対URLで指定してください。'
		);
	}
	if ( ! array_key_exists( 'host', $parts ) || '' === (string) $parts['host'] ) {
		throw new \InvalidArgumentException( $is_rule ? '除外ルールにホスト名を指定してください。' : '対象URLにホスト名を指定してください。' );
	}
	if ( isset( $parts['user'] ) || isset( $parts['pass'] ) ) {
		throw new \InvalidArgumentException( $is_rule ? '除外ルールに認証情報を指定できません。' : '対象URLに認証情報を指定できません。' );
	}
	if ( false !== strpos( (string) $parts['host'], '*' ) ) {
		throw new \InvalidArgumentException( $is_rule ? '除外ルールのホスト名にワイルドカードを指定できません。' : '対象URLのホスト名が不正です。' );
	}

	$scheme_position = strpos( $without_fragment, '://' );
	$authority_end   = strcspn( substr( $without_fragment, $scheme_position + 3 ), '/?' );
	$authority       = substr( $without_fragment, 0, $scheme_position + 3 + $authority_end );
	validate_authority( substr( $authority, $scheme_position + 3 ), $is_rule );
	$path          = isset( $parts['path'] ) && '' !== $parts['path'] ? $parts['path'] : '/';
	$path          = normalize_path( $path );
	$query_present = array_key_exists( 'query', $parts );
	$query         = $query_present ? (string) $parts['query'] : '';
	$value         = $authority . $path . ( $query_present ? '?' . $query : '' );

	return array(
		'authority'     => $authority,
		'path'          => $path,
		'query'         => $query,
		'query_present' => $query_present,
		'value'         => $value,
	);
}

/**
 * URL authority のホストとポートを検証する。
 *
 * Parse_url() は一部の不正なコロンや角括弧を許容するため、照合前に
 * authority を明示的に検証して、ホストの境界が曖昧なURLを受け付けない。
 *
 * @param string $authority ホストとポート。
 * @param bool   $is_rule ルールとして検証する場合は true。
 * @return void
 * @throws \InvalidArgumentException Authority が不正な場合.
 */
function validate_authority( string $authority, bool $is_rule ): void {
	if ( '' === $authority || false !== strpos( $authority, '@' ) ) {
		throw new \InvalidArgumentException( $is_rule ? '除外ルールに認証情報を指定できません。' : '対象URLに認証情報を指定できません。' );
	}

	if ( '[' === $authority[0] ) {
		$valid_ipv6 = preg_match( '/^\[([^\]]+)\](?::([0-9]+))?$/D', $authority, $matches );
		if ( 1 !== $valid_ipv6 || false === filter_var( $matches[1], FILTER_VALIDATE_IP, FILTER_FLAG_IPV6 ) || ( isset( $matches[2] ) && 65535 < (int) $matches[2] ) ) {
			throw new \InvalidArgumentException( 'ホスト名またはポートが不正です。' );
		}
		return;
	}

	if ( false !== strpos( $authority, ']' ) || substr_count( $authority, ':' ) > 1 ) {
		throw new \InvalidArgumentException( 'ホスト名またはポートが不正です。' );
	}

	$host = $authority;
	if ( false !== strpos( $authority, ':' ) ) {
		list( $host, $port ) = explode( ':', $authority, 2 );
		if ( '' === $port || ! ctype_digit( $port ) || (int) $port > 65535 ) {
			throw new \InvalidArgumentException( $is_rule ? '除外ルールのポートが不正です。' : '対象URLのポートが不正です。' );
		}
	}

	// WordPress の公開URLに含まれる国際化ドメインも受け付け、照合時の表記は保持する。
	$label      = '[\p{L}\p{N}](?:[\p{L}\p{N}\p{M}-]*[\p{L}\p{N}\p{M}])?';
	$valid_host = preg_match( '/^' . $label . '(?:\.' . $label . ')*\.?$/uD', $host );
	if ( false !== strpos( $host, '*' ) ) {
		throw new \InvalidArgumentException( $is_rule ? '除外ルールのホスト名にワイルドカードを指定できません。' : '対象URLのホスト名が不正です。' );
	}
	if ( 1 !== $valid_host ) {
		throw new \InvalidArgumentException( $is_rule ? '除外ルールのホスト名が不正です。' : '対象URLのホスト名が不正です。' );
	}
}

/**
 * パス末尾のスラッシュを正規化する。
 *
 * @param string $path URLパス。
 * @return string 末尾スラッシュを除いたパス。
 */
function normalize_path( string $path ): string {
	$path = rtrim( $path, '/' );
	return '' === $path ? '/' : $path;
}

/**
 * ルールを安全な全体一致正規表現へ変換する。
 *
 * @param string $rule 除外ルール。
 * @return string 正規表現。
 */
function compile_rule( string $rule ): string {
	$is_absolute = '/' !== $rule[0];
	$reference   = $is_absolute ? parse_absolute_url( $rule, true ) : parse_path_reference( $rule );
	$literal     = $is_absolute ? $reference['authority'] : '';
	$literal    .= $reference['path'];
	if ( $reference['query_present'] ) {
		$literal .= '?' . $reference['query'];
	}

	// ASCIIの記号だけを判別するため、文字分割が不要なバイト単位で処理する。
	$pattern = '';
	$length  = strlen( $literal );
	for ( $index = 0; $index < $length; ++$index ) {
		$character = $literal[ $index ];
		if ( '*' !== $character ) {
			$pattern .= preg_quote( $character, '~' );
			continue;
		}
		if ( $index + 1 < $length && '*' === $literal[ $index + 1 ] ) {
			$pattern .= '.*';
			++$index;
		} else {
			$pattern .= '[^/]*';
		}
	}

	return '~\\A' . $pattern . '\\z~D';
}
