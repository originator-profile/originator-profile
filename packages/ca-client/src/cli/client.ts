import {
  createCaClient,
  type CaClient,
} from "../ca-server/create-ca-client.ts";
import { CaClientError, CaClientErrorCode } from "../errors.ts";

export const caClientFromEnv = (issuer: string): CaClient => {
  const endpoint = process.env.CA_SERVER_URL;
  const ccspConfig = process.env.CCSP_CONFIG;
  if (!endpoint || !ccspConfig) {
    const missing = [
      ...(!endpoint ? ["CA_SERVER_URL"] : []),
      ...(!ccspConfig ? ["CCSP_CONFIG"] : []),
    ];
    throw new CaClientError(`${missing.join(" と ")} が必要です`, {
      code: CaClientErrorCode.Config,
    });
  }
  return createCaClient({ endpoint, issuer, ccspConfig });
};
