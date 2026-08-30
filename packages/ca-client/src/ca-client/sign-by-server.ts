import type { UnsignedContentAttestation } from "@originator-profile/model";
import { isUnauthorized } from "../errors";
import {
  signByCaServer,
  type SignByCaServerOptions,
} from "./sign-by-ca-server";

/** Same signature as {@link signByCaServer}. */
export type CaServerSign = typeof signByCaServer;

export type SignByServerOptions = Omit<SignByCaServerOptions, "accessToken"> & {
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
    getAccessToken,
    refreshAccessToken,
    sign = signByCaServer,
    ...signOptions
  } = options;

  const accessToken = await getAccessToken();

  try {
    return await sign(uca, {
      ...signOptions,
      accessToken,
    });
  } catch (error) {
    if (refreshAccessToken && isUnauthorized(error)) {
      return await sign(uca, {
        ...signOptions,
        accessToken: await refreshAccessToken(),
      });
    }
    throw error;
  }
};
