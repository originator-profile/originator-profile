import { CaClientError, CaClientErrorCode } from "../errors";
import type { FetchOperations } from "../fetch-operations";
import { isRecord } from "../is-record";

export interface CcspAuthConfig {
  authType: "client_secret_post";
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

const requireConfigString = (
  value: unknown,
  field: string,
  hint = "",
): string => {
  if (typeof value !== "string" || value === "") {
    throw new CaClientError(`CCSP auth failed: ${field} is required${hint}`, {
      code: CaClientErrorCode.Config,
    });
  }
  return value;
};

const parseConfigRecord = (decoded: string): Record<string, unknown> => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(decoded);
  } catch (error) {
    throw new CaClientError("CCSP auth failed: failed to parse config", {
      code: CaClientErrorCode.Config,
      cause: error,
    });
  }
  if (!isRecord(parsed)) {
    throw new CaClientError("CCSP auth failed: failed to parse config", {
      code: CaClientErrorCode.Config,
    });
  }
  return parsed;
};

export const parseCcspConfig = (base64Config: string): CcspAuthConfig => {
  const parsed = parseConfigRecord(
    Buffer.from(base64Config.replace(/^CCSP:/, ""), "base64").toString("utf-8"),
  );

  const authType = requireConfigString(parsed.authType, "authType");
  if (authType !== "client_secret_post") {
    throw new CaClientError(
      `CCSP auth failed: unsupported auth type "${authType}" (only "client_secret_post" is supported)`,
      { code: CaClientErrorCode.Config },
    );
  }

  const config: CcspAuthConfig = {
    authType,
    clientId: requireConfigString(parsed.clientId, "clientId"),
    clientSec: requireConfigString(
      parsed.clientSec,
      "clientSec",
      " (OAuth client_secret)",
    ),
    tokenUrl: requireConfigString(parsed.tokenUrl, "tokenUrl"),
  };

  if (!URL.canParse(config.tokenUrl)) {
    throw new CaClientError("CCSP auth failed: tokenUrl is not a valid URL", {
      code: CaClientErrorCode.Config,
    });
  }

  return config;
};

const parseTokenResponse = (data: unknown): CcspTokenResponse => {
  if (
    !isRecord(data) ||
    typeof data.access_token !== "string" ||
    data.access_token === ""
  ) {
    throw new CaClientError(
      "CCSP auth failed: response is missing access_token",
      { code: CaClientErrorCode.Response },
    );
  }

  const token: CcspTokenResponse = { access_token: data.access_token };
  if (typeof data.token_type === "string") {
    token.token_type = data.token_type;
  }
  if (typeof data.expires_in === "number") {
    token.expires_in = data.expires_in;
  }
  if (typeof data.scope === "string") {
    token.scope = data.scope;
  }
  return token;
};

export const getCcspAccessToken = async (
  config: CcspAuthConfig,
  fetchOps: FetchOperations = { fetch },
): Promise<CcspTokenResponse> => {
  const formData = new URLSearchParams();
  formData.append("grant_type", "client_credentials");
  formData.append("client_id", config.clientId);
  formData.append("client_secret", config.clientSec);

  let response: Response;
  try {
    response = await fetchOps.fetch(config.tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formData.toString(),
    });
  } catch (error) {
    throw new CaClientError(
      `CCSP auth failed: ${error instanceof Error ? error.message : String(error)}`,
      { code: CaClientErrorCode.Http, cause: error },
    );
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new CaClientError(
      `CCSP auth failed: ${response.status} ${response.statusText}: ${errorText}`,
      { code: CaClientErrorCode.Http, status: response.status },
    );
  }

  return parseTokenResponse(await response.json());
};
