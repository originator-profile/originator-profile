import type { UnsignedContentAttestation } from "@originator-profile/model";
import { createTokenManager } from "../auth";
import { reSign } from "./re-sign";
import { serverSignOptions, signByServer } from "./sign-by-server";

export type CaClientConfig = {
  /** CA server endpoint URL */
  endpoint: string;
  /** Issuer ID (e.g. `dns:example.com`) */
  issuer: string;
  /** CCSP auth config (Base64, optional `CCSP:` prefix) */
  ccspConfig: string;
  /** Seconds before token expiry to refresh (default 300) */
  tokenBufferSeconds?: number;
};

export type CaClient = {
  config: CaClientConfig;
  /** Sign an unsigned CA on the CA server */
  sign: (uca: UnsignedContentAttestation) => Promise<string>;
  /**
   * Re-sign an existing CAS JWT payload.
   * @param source - Context for error messages (e.g. CAS file path)
   */
  reSign: (
    jwtPayload: Record<string, unknown>,
    source: string,
  ) => Promise<string>;
};

export const createCaClient = (config: CaClientConfig): CaClient => {
  const tokenManager = createTokenManager(
    config.ccspConfig,
    config.tokenBufferSeconds,
  );
  const signOptions = () => serverSignOptions(config.endpoint, tokenManager);

  return {
    config,
    sign: (uca) => signByServer(uca, signOptions()),
    reSign: (jwtPayload, source) =>
      reSign(jwtPayload, {
        source,
        issuer: config.issuer,
        ...signOptions(),
      }),
  };
};
