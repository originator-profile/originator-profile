import * as client from "openid-client";
import { parseOidcConfigToken } from "../utils/oidc";

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig(event);
  const OIDC_TOKEN = config.OIDC_TOKEN;

  const { provider, authorizeUrl, tokenUrl, clientId, clientSec, redirectUrl } =
    parseOidcConfigToken(OIDC_TOKEN);

  // 環境変数が設定されているかチェック
  if (
    !provider ||
    !authorizeUrl ||
    !tokenUrl ||
    !clientId ||
    !clientSec ||
    !redirectUrl
  ) {
    throw createError({
      statusCode: 500,
      message: "必要な環境変数が設定されていません",
    });
  }
  console.info("OAuth login route accessed");

  try {
    const codeVerifier = client.randomPKCECodeVerifier();
    const codeChallenge = await client.calculatePKCECodeChallenge(codeVerifier);
    const state = client.randomState();

    // codeVerifierとstateをcookieに保存
    setCookie(event, "pkce_code_verifier", codeVerifier, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 600,
      path: "/",
    });

    const nonce = client.randomNonce();
    setCookie(event, "oauth_nonce", nonce, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 600,
    });

    setCookie(event, "oauth_state", state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 600,
      path: "/",
    });

    const authUrl = new URL(authorizeUrl);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("client_id", clientId);
    authUrl.searchParams.set("redirect_uri", redirectUrl);
    authUrl.searchParams.set("scope", "openid");
    authUrl.searchParams.set("code_challenge", codeChallenge);
    authUrl.searchParams.set("code_challenge_method", "S256");
    authUrl.searchParams.set("state", state);
    authUrl.searchParams.set("nonce", nonce);

    return sendRedirect(event, authUrl.href);
  } catch (error) {
    console.error("Login error:", error);
    throw createError({
      statusCode: 500,
      message: "ログインに失敗しました",
    });
  }
});
