type OidcConfig = {
  authType: "oidc";
  provider: string;
  clientId: string;
  clientSec: string;
  authorizeUrl: string;
  tokenUrl: string;
  redirectUrl: string;
  /**
   * Firebase Secure Token の IDトークンで aud に入るプロジェクトID。
   * provider が https://securetoken.google.com/<projectId> の形式であれば自動的に補完される。
   */
  firebaseProjectId?: string;
  /**
   * 任意の追加情報。OIDC_TOKEN によっては providerUrl や jwksUri などを含む。
   */
  [key: string]: unknown;
};

/**
 * OIDC config tokenをパースして、OidcConfigを返す
 * @param input OIDC:Base64の文字列
 * @returns OidcConfig
 */
export function parseOidcConfigToken(input: string): OidcConfig {
  const prefix = "OIDC:";
  const base64 = input.startsWith(prefix) ? input.slice(prefix.length) : input;
  const obj = JSON.parse(Buffer.from(base64, "base64").toString("utf8"));
  if (obj?.authType !== "oidc") {
    throw new Error("OIDC config token expected");
  }

  const config = { ...obj } as OidcConfig;

  if (
    !config.firebaseProjectId &&
    typeof config.provider === "string" &&
    config.provider
  ) {
    // provider が Firebase Secure Token の issuer (例: https://securetoken.google.com/<projectId>)
    // の形式だった場合のみ、パス末尾をプロジェクトIDとして補完する。
    // これにより OIDC_TOKEN 側で firebaseProjectId を明示しなくても aud 検証に利用できるが、
    // Firebase 以外のプロバイダーでは余計な audience を許可しないようにホストを厳密に判定する。
    try {
      const issuerUrl = new URL(config.provider);
      const isFirebaseIssuer =
        issuerUrl.hostname.toLowerCase() === "securetoken.google.com";
      if (!isFirebaseIssuer) {
        return config;
      }

      const normalizedPath = issuerUrl.pathname.replace(/^\/+|\/+$/g, "");
      if (!normalizedPath) {
        return config;
      }

      const segments = normalizedPath.split("/");
      const candidate = segments[segments.length - 1];
      if (candidate) {
        config.firebaseProjectId = candidate;
      }
    } catch {
      // provider が URL でない場合は無視する
    }
  }

  return config;
}
