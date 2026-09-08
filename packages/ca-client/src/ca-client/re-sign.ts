import { jwtPayloadToUnsignedCa } from "./cas-token";
import { signByServer, type SignByServerOptions } from "./sign-by-server";

export type ReSignOptions = SignByServerOptions & {
  source: string;
  issuer?: string;
};

export const reSign = async (
  jwtPayload: Record<string, unknown>,
  options: ReSignOptions,
): Promise<string> => {
  const { source, issuer, ...signOptions } = options;

  const uca = jwtPayloadToUnsignedCa(jwtPayload, source, { issuer });

  return signByServer(uca, signOptions);
};
