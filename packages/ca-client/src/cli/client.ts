import {
  createCaClient,
  type CaClient,
} from "../ca-server/create-ca-client.ts";
import { CaClientError, CaClientErrorCode } from "../errors.ts";

export const caClientFromEnv = (issuer: string | undefined): CaClient => {
  const endpoint = process.env.CA_SERVER_URL;
  const ccspConfig = process.env.CCSP_CONFIG;
  if (!endpoint || !ccspConfig || !issuer) {
    throw new CaClientError(
      "CA_SERVER_URL, CCSP_CONFIG, and issuer are required",
      { code: CaClientErrorCode.Config },
    );
  }
  return createCaClient({ endpoint, issuer, ccspConfig });
};
