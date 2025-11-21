import { Keys, LocalKeys } from "@originator-profile/cryptography";
import {
  Certificate as CertificateSchema,
  CoreProfile,
  JapaneseExistenceCertificate,
  OpVc,
  OriginatorProfileSet,
  WebMediaProfile,
} from "@originator-profile/model";
import {
  JwtVcVerifier,
  UnverifiedJwtVc,
  VcValidator,
  VerifiedJwtVc,
} from "@originator-profile/securing-mechanism";
import { getMappedKeys, type MappedKeys } from "../keys";
import { decodeOps } from "./decode-ops";
import {
  CoreProfileNotFound,
  OpVerifyFailed,
  OpsInvalid,
  OpsVerifyFailed,
} from "./errors";
import {
  Certificate,
  OpVerificationResult,
  OpsVerificationResult,
  VerifiedOp,
  VerifiedOps,
} from "./types";

/** OP (CP を除く) 署名検証者 */
function OpVerifier<T extends OpVc>(
  paOrWmpIssuerKeys: MappedKeys,
  vc: UnverifiedJwtVc<T>,
  validator?: VcValidator<VerifiedJwtVc<T>>,
): JwtVcVerifier<T> | (() => Promise<CoreProfileNotFound<T>>) {
  const issuer = vc.doc.issuer;
  const jwks = paOrWmpIssuerKeys[issuer];
  if (!jwks) {
    return async () =>
      new CoreProfileNotFound(`Missing Core Profile (${issuer})`, vc);
  }
  const cpKeys = LocalKeys(jwks);
  return JwtVcVerifier<T>(cpKeys, issuer, validator);
}

/** annotations プロパティの署名検証 */
async function verifyAnnotations(
  paIssuerKeys: MappedKeys,
  annotations?: UnverifiedJwtVc<Certificate>[],
  validator?: typeof VcValidator,
) {
  if (!annotations) return;
  return await Promise.all(
    annotations.map((annotation) => {
      const verify = OpVerifier<Certificate>(
        paIssuerKeys,
        annotation,
        validator?.({
          oneOf: [CertificateSchema, JapaneseExistenceCertificate],
        }),
      );
      return verify(annotation.source);
    }),
  );
}

/** media プロパティの署名検証 */
async function verifyMedia(
  wmpIssuerKeys: MappedKeys,
  media?: UnverifiedJwtVc<WebMediaProfile>,
  validator?: typeof VcValidator,
) {
  if (!media) return;
  const verify = OpVerifier<WebMediaProfile>(
    wmpIssuerKeys,
    media,
    validator?.(WebMediaProfile),
  );
  return await verify(media.source);
}

/** 検証済み OPS か否か */
const isVerifiedOps = (ops: OpVerificationResult[]): ops is VerifiedOps =>
  ops.every((op) => !(op instanceof OpVerifyFailed));

/**
 * Originator Profile Set の検証者の作成
 * @param ops Originator Profile Set
 * @param keys Core Profile の発行者の検証鍵
 * @param issuer Core Profile の発行者
 * @param validator バリデーター
 * @returns 検証者
 */
export function OpsVerifier(
  ops: OriginatorProfileSet,
  keys: Keys,
  issuer: string | string[],
  validator?: typeof VcValidator,
) {
  const decoded = decodeOps(ops);
  const verifyCp = JwtVcVerifier<CoreProfile>(
    keys,
    issuer,
    validator?.(CoreProfile),
  );

  /**
   * Originator Profile Set の検証
   * @returns 検証結果
   */
  async function verify(): Promise<OpsVerificationResult> {
    if (decoded instanceof OpsInvalid) {
      return decoded;
    }
    const paOrWmpIssuerKeys = getMappedKeys(decoded);
    const resultOps = await Promise.all(
      decoded.map(async (op): Promise<OpVerificationResult> => {
        const core = await verifyCp(op.core.source);
        const annotations = await verifyAnnotations(
          paOrWmpIssuerKeys,
          op.annotations,
          validator,
        );
        const media = await verifyMedia(paOrWmpIssuerKeys, op.media, validator);
        const resultOp = { core, annotations, media };

        if (core instanceof Error) {
          return new OpVerifyFailed("Core Profile verify failed", resultOp);
        }
        if (
          annotations &&
          annotations.some((annotation) => annotation instanceof Error)
        ) {
          return new OpVerifyFailed(
            "Profile Annotation verify failed",
            resultOp,
          );
        }
        if (media instanceof Error) {
          return new OpVerifyFailed(
            "Web Media Profile verify failed",
            resultOp,
          );
        }
        return resultOp as VerifiedOp;
      }),
    );
    if (!isVerifiedOps(resultOps)) {
      return new OpsVerifyFailed(
        "Originator Profile Set verify failed",
        resultOps,
      );
    }
    return resultOps;
  }
  return verify;
}
