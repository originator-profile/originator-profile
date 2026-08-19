import {
  getCcspAccessToken,
  parseCcspConfig,
  type CcspAuthConfig,
  type CcspTokenResponse,
} from "./ccsp-auth";
import { getJwtExpiration } from "./jwt";

interface CachedToken {
  accessToken: string;
  expiresAt: number;
}

export interface TokenOperations {
  getCcspAccessToken: (config: CcspAuthConfig) => Promise<CcspTokenResponse>;
  now: () => number;
}

const DEFAULT_TTL_SECONDS = 3600;

const resolveExpiresAt = (
  response: CcspTokenResponse,
  now: number,
): number => {
  if (typeof response.expires_in === "number" && response.expires_in > 0) {
    return now + response.expires_in;
  }

  const jwtExp = getJwtExpiration(response.access_token);
  if (jwtExp && jwtExp > 0) {
    return jwtExp;
  }

  return now + DEFAULT_TTL_SECONDS;
};

const defaultTokenOperations: TokenOperations = {
  getCcspAccessToken,
  now: () => Math.floor(Date.now() / 1000),
};

export class TokenManager {
  private cachedToken: CachedToken | null = null;
  private refreshPromise: Promise<string> | null = null;
  private readonly config: CcspAuthConfig;
  private readonly bufferSeconds: number;
  private readonly tokenOps: TokenOperations;

  constructor(
    config: CcspAuthConfig,
    bufferSeconds: number = 300,
    tokenOps: TokenOperations = defaultTokenOperations,
  ) {
    this.config = config;
    this.bufferSeconds = bufferSeconds;
    this.tokenOps = tokenOps;
  }

  async getAccessToken(): Promise<string> {
    if (this.refreshPromise) {
      return await this.refreshPromise;
    }

    if (this.cachedToken && this.isTokenValid()) {
      return this.cachedToken.accessToken;
    }

    return await this.refreshToken();
  }

  async refreshToken(): Promise<string> {
    if (this.refreshPromise) {
      return await this.refreshPromise;
    }

    this.refreshPromise = (async () => {
      try {
        const response = await this.tokenOps.getCcspAccessToken(this.config);

        const now = this.tokenOps.now();
        let expiresAt = resolveExpiresAt(response, now);
        if (!Number.isFinite(expiresAt) || expiresAt <= 0) {
          expiresAt = now + DEFAULT_TTL_SECONDS;
        }

        this.cachedToken = {
          accessToken: response.access_token,
          expiresAt,
        };

        return response.access_token;
      } finally {
        this.refreshPromise = null;
      }
    })();

    return await this.refreshPromise;
  }

  clearCache(): void {
    this.cachedToken = null;
    this.refreshPromise = null;
  }

  isTokenValid(): boolean {
    if (!this.cachedToken) {
      return false;
    }

    const expiresAt =
      getJwtExpiration(this.cachedToken.accessToken) ??
      this.cachedToken.expiresAt;
    return expiresAt > this.tokenOps.now() + this.bufferSeconds;
  }
}

export const createTokenManager = (
  ccspConfig: string,
  bufferSeconds?: number,
): TokenManager => new TokenManager(parseCcspConfig(ccspConfig), bufferSeconds);
