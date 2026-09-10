import { WebMediaProfile } from "@originator-profile/model";
import type {
  UnverifiedJwtVc,
  VcValidatorFactory,
} from "@originator-profile/securing-mechanism";
import { verifyImageDigestSri } from "../integrity";
import { type MappedKeys } from "../keys";
import type { Logger } from "../logger";
import { childPointer } from "../result/pointer";
import { OpVerifier } from "./op-verifier";

/** media プロパティの署名検証 */
export async function verifyMedia(
  wmpIssuerKeys: MappedKeys,
  media?: UnverifiedJwtVc<WebMediaProfile>[],
  options: {
    /** バリデーター */
    validator?: VcValidatorFactory;
    /** ロガー (デフォルト: `console`) */
    logger?: Logger;
    /** 対象の Originator Profile の位置を指す JSONPath */
    at?: string;
  } = {},
) {
  const { validator, logger = console, at } = options;
  if (!media) return;
  return await Promise.all(
    media.map(async (m, index) => {
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
        ...(at && { at: childPointer(at, "media", index) }),
      });

      return result;
    }),
  );
}
