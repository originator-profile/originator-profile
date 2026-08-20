import { CaClientError, CaClientErrorCode } from "../errors";
import type { FetchOperations } from "../fetch-operations";

export interface CcspAuthConfig {
  authType: string;
  clientId: string;
  clientSecret: string;
  tokenUrl: string;
}

type CcspAuthConfigJson = {
  authType?: string;
  clientId?: string;
  clientSecret?: string;
  /** @deprecated Use `clientSecret` */
  clientSec?: string;
  tokenUrl?: string;
};

export interface CcspTokenResponse {
  access_token: string;
  token_type?: string;
  expires_in?: number;
  scope?: string;
}

const requireConfigField = (
  value: string | undefined,
  field: string,
  hint = "",
): string => {
  if (!value) {
    throw new CaClientError(`CCSP auth failed: ${field} is required${hint}`, {
      code: CaClientErrorCode.Config,
    });
  }
  return value;
};

export const parseCcspConfig = (base64Config: string): CcspAuthConfig => {
  const configStr = base64Config.replace(/^CCSP:/, "");

  let parsed: CcspAuthConfigJson;
  try {
    const decoded = Buffer.from(configStr, "base64").toString("utf-8");
    parsed = JSON.parse(decoded) as CcspAuthConfigJson;
  } catch (error) {
    throw new CaClientError("CCSP auth failed: failed to parse config", {
      code: CaClientErrorCode.Config,
      cause: error,
    });
  }

  return {
    authType: requireConfigField(parsed.authType, "authType"),
    clientId: requireConfigField(parsed.clientId, "clientId"),
    clientSecret: requireConfigField(
      parsed.clientSecret ?? parsed.clientSec,
      "clientSecret",
      " (OAuth client_secret)",
    ),
    tokenUrl: requireConfigField(parsed.tokenUrl, "tokenUrl"),
  };
};

export const getCcspAccessToken = async (
  config: CcspAuthConfig,
  fetchOps: FetchOperations = { fetch },
): Promise<CcspTokenResponse> => {
  if (config.authType !== "client_secret_post") {
    throw new CaClientError(
      `CCSP auth failed: unsupported auth type "${config.authType}" (only "client_secret_post" is supported)`,
      { code: CaClientErrorCode.Config },
    );
  }

  const formData = new URLSearchParams();
  formData.append("grant_type", "client_credentials");
  formData.append("client_id", config.clientId);
  formData.append("client_secret", config.clientSecret);

  const response = await fetchOps.fetch(config.tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: formData.toString(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new CaClientError(
      `CCSP auth failed: ${response.status} ${response.statusText}: ${errorText}`,
      { code: CaClientErrorCode.Auth, status: response.status },
    );
  }

  const data = (await response.json()) as CcspTokenResponse;

  if (!data.access_token) {
    throw new CaClientError(
      "CCSP auth failed: response is missing access_token",
      { code: CaClientErrorCode.Auth },
    );
  }

  return data;
};
