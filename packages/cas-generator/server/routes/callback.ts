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

  console.info("OAuth callback route accessed");

  const query = getQuery(event);

  const codeVerifier = getCookie(event, "pkce_code_verifier");
  const expectedState = getCookie(event, "oauth_state");
  const nonce = getCookie(event, "oauth_nonce");

  if (!codeVerifier) {
    console.error("codeVerifier not found");
    throw createError({
      statusCode: 403,
      message: "認証に失敗しました",
    });
  }

  if (!expectedState) {
    console.error("expectedState not found");
    throw createError({
      statusCode: 403,
      message: "認証に失敗しました",
    });
  }

  if (!nonce) {
    console.error("nonce not found");
    throw createError({
      statusCode: 403,
      message: "認証に失敗しました",
    });
  }

  try {
    const authorizationCode =
      typeof query.code === "string" ? query.code : undefined;
    const returnedState =
      typeof query.state === "string" ? query.state : undefined;

    if (!authorizationCode) {
      console.error("authorization code not found");
      throw createError({
        statusCode: 403,
        message: "認証に失敗しました",
      });
    }

    if (returnedState !== expectedState) {
      console.error("state mismatch", { returnedState, expectedState });
      throw createError({
        statusCode: 403,
        message: "認証に失敗しました",
      });
    }

    const form = new URLSearchParams();
    form.set("grant_type", "authorization_code");
    form.set("code", authorizationCode);
    form.set("redirect_uri", redirectUrl);
    form.set("client_id", clientId);
    form.set("client_secret", clientSec);
    form.set("code_verifier", codeVerifier);

    const response = await fetch(tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form.toString(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Token endpoint error:", response.status, errorText);
      throw createError({
        statusCode: 502,
        message: "トークン交換に失敗しました",
      });
    }

    const tokens = await response.json();

    if (!tokens?.id_token) {
      console.error("id_token not returned in token response");
      throw createError({
        statusCode: 502,
        message: "トークン交換に失敗しました",
      });
    }
    // 使用済みのcookieを削除
    deleteCookie(event, "pkce_code_verifier", {
      path: "/",
    });
    deleteCookie(event, "oauth_state", {
      path: "/",
    });
    deleteCookie(event, "oauth_nonce", {
      path: "/",
    });

    const expiresInSeconds = Number(tokens.expires_in || 3600);
    setCookie(event, "access_token", tokens.access_token || "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: expiresInSeconds,
    });
    setCookie(event, "id_token", tokens.id_token || "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: expiresInSeconds,
    });
    if (tokens.refresh_token) {
      setCookie(event, "refresh_token", tokens.refresh_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 30, // 30 days
      });
    }

    return sendRedirect(event, "/");
  } catch (error) {
    console.error("Token exchange error:", error);
    throw createError({
      statusCode: 500,
      message: "トークン交換に失敗しました",
    });
  }
});
