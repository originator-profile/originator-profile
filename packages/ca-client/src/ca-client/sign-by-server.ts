import type { UnsignedContentAttestation } from "@originator-profile/model";
import { isUnauthorized } from "../errors";
import { signByCaServer } from "./sign-by-ca-server";

export type CaServerSign = (
  uca: UnsignedContentAttestation,
  options: { endpoint: string; accessToken: string },
) => Promise<string>;

export type SignByServerOptions = {
  endpoint: string;
  getAccessToken: () => Promise<string>;
  refreshAccessToken?: () => Promise<string>;
  sign?: CaServerSign;
};

export type AccessTokenSupplier = {
  getAccessToken: () => Promise<string>;
  refreshToken: () => Promise<string>;
};

export const serverSignOptions = (
  endpoint: string,
  tokens: AccessTokenSupplier,
): SignByServerOptions => ({
  endpoint,
  getAccessToken: () => tokens.getAccessToken(),
  refreshAccessToken: () => tokens.refreshToken(),
});

export const signByServer = async (
  uca: UnsignedContentAttestation,
  options: SignByServerOptions,
): Promise<string> => {
  const {
    endpoint,
    getAccessToken,
    refreshAccessToken,
    sign = signByCaServer,
  } = options;

  try {
    return await sign(uca, { endpoint, accessToken: await getAccessToken() });
  } catch (error) {
    if (refreshAccessToken && isUnauthorized(error)) {
      return await sign(uca, {
        endpoint,
        accessToken: await refreshAccessToken(),
      });
    }
    throw error;
  }
};
