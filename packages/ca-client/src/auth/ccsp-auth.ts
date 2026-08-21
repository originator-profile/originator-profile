import { CaClientError, CaClientErrorCode } from "../errors";
import type { FetchOperations } from "../fetch-operations";

export interface CcspAuthConfig {
  authType: string;
  clientId: string;
  /** OAuth client_secret (named clientSec to match the CA server config token field) */
  clientSec: string;
  tokenUrl: string;
}

export interface CcspTokenResponse {
  access_token: string;
  token_type?: string;
  expires_in?: number;
  scope?: string;
}

export const parseCcspConfig = (base64Config: string): CcspAuthConfig => {
  const configStr = base64Config.replace(/^CCSP:/, "");

  let config: CcspAuthConfig;
  try {
    const decoded = Buffer.from(configStr, "base64").toString("utf-8");
    config = JSON.parse(decoded) as CcspAuthConfig;
  } catch (error) {
    throw new CaClientError("CCSP auth failed: failed to parse config", {
      code: CaClientErrorCode.Config,
      cause: error,
    });
  }

  if (!config.authType) {
    throw new CaClientError("CCSP auth failed: authType is required", {
      code: CaClientErrorCode.Config,
    });
  }
  if (!config.clientId) {
    throw new CaClientError("CCSP auth failed: clientId is required", {
      code: CaClientErrorCode.Config,
    });
  }
  if (!config.clientSec) {
    throw new CaClientError(
      "CCSP auth failed: clientSec is required (OAuth client_secret)",
      { code: CaClientErrorCode.Config },
    );
  }
  if (!config.tokenUrl) {
    throw new CaClientError("CCSP auth failed: tokenUrl is required", {
      code: CaClientErrorCode.Config,
    });
  }
  if (!URL.canParse(config.tokenUrl)) {
    throw new CaClientError("CCSP auth failed: tokenUrl is not a valid URL", {
      code: CaClientErrorCode.Config,
    });
  }

  return config;
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
  formData.append("client_secret", config.clientSec);

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
