import type { CaClient } from "../ca-server/create-ca-client.ts";
import { isExpired } from "../ca/expiry.ts";
import {
  locationOf,
  readCas,
  upsertOwnCa,
  whereOf,
  type CasLocation,
  type CasSource,
} from "../cas/source.ts";
import { withContext } from "../errors.ts";
import { listFiles } from "../utils/paths.ts";
import type { CaConfig } from "./config.ts";

export type RenewOptions = {
  signer: Pick<CaClient, "reSign">;
  /** true なら期限に関わらず再署名する。 */
  all?: boolean;
  /** CAS を再署名して書くたびに呼ぶ。 */
  onRenewed?: (cas: CasLocation) => void;
};

export type RenewReport = {
  renewed: CasLocation[];
  /** 対象にした CAS の数。 */
  total: number;
  all: boolean;
};

const renewSource = async (
  source: CasSource,
  config: CaConfig,
  options: RenewOptions,
): Promise<boolean> => {
  const label = whereOf(source);
  try {
    const cas = await readCas(source, config.issuer);
    if (cas === undefined || (!options.all && !isExpired(cas.expiresAt))) {
      return false;
    }
    await upsertOwnCa(
      source,
      await options.signer.reSign(cas.payload, label),
      config,
    );
    return true;
  } catch (error) {
    throw withContext(`renew ${label}`, error);
  }
};

export const renew = async (
  config: CaConfig,
  options: RenewOptions,
): Promise<RenewReport> => {
  const sources = (await listFiles(config.publicDir, ".cas.json")).map(
    (path) => ({ path }),
  );
  const renewed: CasLocation[] = [];
  for (const source of sources) {
    // oxlint-disable-next-line no-await-in-loop -- CA Server に再署名をまとめて送らず、1 件ずつ頼む
    if (await renewSource(source, config, options)) {
      const location = locationOf(source);
      renewed.push(location);
      options.onRenewed?.(location);
    }
  }
  return {
    renewed,
    total: sources.length,
    all: options.all ?? false,
  };
};
