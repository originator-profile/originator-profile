import { createRemoteJWKSet, jwtVerify } from "jose";
import { parseOidcConfigToken } from "../../utils/oidc";

const jwksCache = new Map<
  string,
  Promise<ReturnType<typeof createRemoteJWKSet>>
>();

const buildWellKnownUrl = (issuer: string) => {
  const trimmed = issuer.trim();
  if (!trimmed) {
    throw new Error("Issuer is empty");
  }

  const issuerWithSlash = trimmed.endsWith("/") ? trimmed : `${trimmed}/`;
  return new URL("./.well-known/openid-configuration", issuerWithSlash);
};

const getRemoteJwkSet = async (issuer: string) => {
  const cached = jwksCache.get(issuer);
  if (cached) {
    return cached;
  }

  const jwksRetrievalPromise = (async () => {
    const wellKnownUrl = buildWellKnownUrl(issuer);
    const response = await fetch(wellKnownUrl, {
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(
        `Failed to fetch OIDC discovery document: ${response.status} ${response.statusText}`,
      );
    }

    const discovery = (await response.json()) as {
      jwks_uri?: unknown;
    };

    if (typeof discovery?.jwks_uri !== "string") {
      throw new Error("jwks_uri is missing in discovery document");
    }

    return createRemoteJWKSet(new URL(discovery.jwks_uri));
  })();

  jwksCache.set(issuer, jwksRetrievalPromise);

  try {
    return await jwksRetrievalPromise;
  } catch (error) {
    jwksCache.delete(issuer);
    throw error;
  }
};

export default defineEventHandler(async (event) => {
  const idToken = getCookie(event, "id_token");

  if (!idToken) {
    return {
      isLoggedIn: false,
      email: null,
    };
  }

  try {
    const config = useRuntimeConfig(event);
    const oidcToken = config.OIDC_TOKEN;

    if (!oidcToken) {
      throw new Error("OIDC_TOKEN runtime config is not defined");
    }

    const { provider, clientId, firebaseProjectId } =
      parseOidcConfigToken(oidcToken);

    if (!provider) {
      throw new Error("OIDC provider is not configured");
    }

    if (!clientId) {
      throw new Error("OIDC clientId is not configured");
    }

    const jwks = await getRemoteJwkSet(provider);

    // clientId と firebaseProjectId の両方を許容し、重複を排除した配列を作る。
    // Firebase Secure Token の ID トークンでは aud がプロジェクトIDになるため、
    // プロバイダ設定によっては clientId と一致しないケースを考慮する。
    const expectedAudiences = Array.from(
      new Set(
        [clientId, firebaseProjectId].filter(
          (value): value is string =>
            typeof value === "string" && value.length > 0,
        ),
      ),
    );
    const { payload } = await jwtVerify(idToken, jwks, {
      issuer: provider,
      audience: expectedAudiences.length > 0 ? expectedAudiences : clientId,
    });

    const email = typeof payload.email === "string" ? payload.email : null;

    return {
      isLoggedIn: true,
      email,
    };
  } catch (error) {
    console.warn("Failed to verify id_token", error);
    return {
      isLoggedIn: false,
      email: null,
    };
  }
});
