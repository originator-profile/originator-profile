import { Keys, LocalKeys } from "@originator-profile/cryptography";
import {
  Certificate as CertificateSchema,
  CoreProfile,
  JapaneseExistenceCertificate,
  JapaneseExistencePA,
  OpVc,
  OriginatorProfileSet,
  ProfileAnnotation,
  WebMediaProfile,
} from "@originator-profile/model";
import {
  JwtVcVerifier,
  UnverifiedJwtVc,
  VcValidator,
  VerifiedJwtVc,
} from "@originator-profile/securing-mechanism";
import { z } from "zod";
import { verifyImageDigestSri } from "../integrity";
import { getMappedKeys, type MappedKeys } from "../keys";
import { decodeOps } from "./decode-ops";
import {
  CertificateExpired,
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

function validateCertificateExpiry<T extends Certificate>(
  verifiedVc: VerifiedJwtVc<T>,
): VerifiedJwtVc<T> | CertificateExpired<T> {
  const now = new Date();
  const validFrom = verifiedVc.doc.validFrom
    ? new Date(verifiedVc.doc.validFrom)
    : null;
  const validUntil = verifiedVc.doc.validUntil
    ? new Date(verifiedVc.doc.validUntil)
    : null;

  if (validFrom && now < validFrom) {
    return new CertificateExpired("Certificate not yet valid", verifiedVc);
  }
  if (validUntil && now > validUntil) {
    return new CertificateExpired("Certificate expired", verifiedVc);
  }

  return verifiedVc;
}

/** annotations プロパティの署名検証 */
async function verifyAnnotations(
  paIssuerKeys: MappedKeys,
  annotations?: UnverifiedJwtVc<Certificate>[],
  validator?: typeof VcValidator,
) {
  if (!annotations) return;
  return await Promise.all(
    annotations.map(async (annotation) => {
      const verify = OpVerifier<Certificate>(
        paIssuerKeys,
        annotation,
        validator?.(
          z.union([
            JapaneseExistencePA,
            ProfileAnnotation,
            JapaneseExistenceCertificate,
            CertificateSchema,
          ]),
        ),
      );

      const result = await verify(annotation.source);
      if (result instanceof Error) {
        return result;
      }

      const valid = validateCertificateExpiry(result);
      if (valid instanceof CertificateExpired) {
        return valid;
      }

      await verifyImageDigestSri(valid.doc.credentialSubject.image);

      return valid;
    }),
  );
}

/** media プロパティの署名検証 */
async function verifyMedia(
  wmpIssuerKeys: MappedKeys,
  media?: UnverifiedJwtVc<WebMediaProfile>[],
  validator?: typeof VcValidator,
) {
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

      await verifyImageDigestSri(result.doc.credentialSubject.logo);

      return result;
    }),
  );
}

type CredentialMetadata = {
  doc: {
    issuer: string;
    credentialSubject: {
      id: string;
    };
  };
};
/** 詳細なエラーメッセージを生成する関数 */
function generateErrorDetails<T extends CredentialMetadata>(
  items: (T | Error)[] | undefined,
  opIndex: number,
  prefix: string,
  sources: T[] | undefined,
): string[] {
  if (!items) return [];

  return items
    .map((item, index) => {
      if (!(item instanceof Error)) return null;

      const src = sources?.[index];
      const info = src
        ? ` issuer: ${src.doc.issuer}, subject: ${src.doc.credentialSubject.id}`
        : "";

      return `OP[${opIndex}].${prefix}[${index}]${info}`;
    })
    .filter((d): d is string => d !== null);
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
      decoded.map(async (op, opIndex): Promise<OpVerificationResult> => {
        const core = await verifyCp(op.core.source);
        const annotations = await verifyAnnotations(
          paOrWmpIssuerKeys,
          op.annotations,
          validator,
        );
        const media = await verifyMedia(paOrWmpIssuerKeys, op.media, validator);
        const resultOp = { core, annotations, media };

        if (core instanceof Error) {
          return new OpVerifyFailed(
            `Core Profile verify failed (OP[${opIndex}])`,
            resultOp,
          );
        }
        if (
          annotations &&
          annotations.some((annotation) => annotation instanceof Error)
        ) {
          const details = generateErrorDetails(
            annotations,
            opIndex,
            "PA",
            op.annotations,
          );
          return new OpVerifyFailed(
            `Profile Annotation verify failed (${details.join(", ")})`,
            resultOp,
          );
        }
        if (media && media.some((m) => m instanceof Error)) {
          const details = generateErrorDetails(media, opIndex, "WMP", op.media);
          return new OpVerifyFailed(
            `Web Media Profile verify failed (${details.join(", ")})`,
            resultOp,
          );
        }
        return resultOp as VerifiedOp;
      }),
    );
    if (!isVerifiedOps(resultOps)) {
      const verifyFailedIndexes = resultOps
        .map((op, index) => (op instanceof OpVerifyFailed ? index : null))
        .filter((i): i is number => i !== null);

      const msg =
        verifyFailedIndexes.length > 0
          ? `Originator Profile Set verify failed (${verifyFailedIndexes.map((i) => `OP[${i}]`).join(", ")})`
          : "Originator Profile Set verify failed";

      return new OpsVerifyFailed(msg, resultOps);
    }
    return resultOps;
  }
  return verify;
}
