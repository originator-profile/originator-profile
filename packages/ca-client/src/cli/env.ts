import { createCaClient, type CaClient } from "../ca-client/create-ca-client";

export const clientFromEnv = (issuer: string | undefined): CaClient => {
  const { CA_SERVER_URL, CCSP_CONFIG } = process.env;
  if (!CA_SERVER_URL || !CCSP_CONFIG || !issuer) {
    throw new Error("CA_SERVER_URL, CCSP_CONFIG と issuer が必要です");
  }
  return createCaClient({
    endpoint: CA_SERVER_URL,
    issuer,
    ccspConfig: CCSP_CONFIG,
  });
};
