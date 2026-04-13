import { AllowedUrl } from "@originator-profile/model";

async function importURLPatternPolyfill() {
  // URLPatternが存在するか確認して、なければimportする
  if (typeof URLPattern === "undefined") {
    await import("urlpattern-polyfill");
  }
}

/**
 * URLのエンコード部分を正規化する
 * ライブラリによって取得時にエンコード部分が小文字になるため、大文字にします
 * @param url 正規化対象URL文字列
 * @returns 正規化した結果
 */
function ReplaceEncode(url: string): string {
  return url.replace(/(%[0-9a-f]{2}?)+/g, function (match) {
    return match.toUpperCase();
  });
}

/**
 * 対象のURLがAllowedUrlの中に含まれているか検証する
 * @param url ウェブページのURL
 * @param allowedUrl 情報の対象となるURL
 * @returns 検証結果: allowedUrlの中にurlが含まれていればtrue, それ以外ならfalse
 */
export async function verifyAllowedUrl(
  url: string,
  allowedUrl: AllowedUrl,
): Promise<boolean> {
  await importURLPatternPolyfill();

  return [allowedUrl].flat().some((value) => {
    // URLPatternのinput空文字を渡すとエラーになるためチェックする
    if (!value) {
      return false;
    }
    try {
      const pattern = new URLPattern(ReplaceEncode(value));
      return pattern.test(ReplaceEncode(url));
    } catch (e) {
      console.error(`Invalid URLPattern: ${value} (url: ${url})`);
    }
    return false;
  });
}
