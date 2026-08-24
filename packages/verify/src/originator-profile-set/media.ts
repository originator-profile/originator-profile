import { WebMediaProfile } from "@originator-profile/model";
import {
  UnverifiedJwtVc,
  VcValidator,
} from "@originator-profile/securing-mechanism";
import { verifyImageDigestSri } from "../integrity";
import { type MappedKeys } from "../keys";
import type { Logger } from "../logger";
import { OpVerifier } from "./op-verifier";

/** media プロパティの署名検証 */
export async function verifyMedia(
  wmpIssuerKeys: MappedKeys,
  media?: UnverifiedJwtVc<WebMediaProfile>[],
  options: {
    /** バリデーター */
    validator?: typeof VcValidator;
    /** ロガー (デフォルト: `console`) */
    logger?: Logger;
  } = {},
) {
  const { validator, logger } = options;
  if (!media) return;
  return await Promise.all(
    media.map(async (m) => {
      const verify = OpVerifier<WebMediaProfile>(
        wmpIssuerKeys,
        m,
        validator?.(WebMediaProfile),
      );
      const result = await verify(m.source);
      if (result instanceof Error) {
        return result;
      }

      await verifyImageDigestSri(result.doc.credentialSubject.logo, {
        logger,
      });

      return result;
    }),
  );
}
