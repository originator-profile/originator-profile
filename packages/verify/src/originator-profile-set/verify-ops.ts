import { Keys } from "@originator-profile/cryptography";
import { CoreProfile, OriginatorProfileSet } from "@originator-profile/model";
import {
  JwtVcVerifier,
  VcValidator,
} from "@originator-profile/securing-mechanism";
import { getMappedKeys } from "../keys";
import { verifyAnnotationIssuerRegistration } from "./annotation-issuer-registration";
import { verifyAnnotations } from "./annotations";
import { decodeOps } from "./decode-ops";
import { OpsInvalid, OpsVerifyFailed, OpVerifyFailed } from "./errors";
import { verifyMedia } from "./media";
import type {
  OpsVerificationResult,
  OpVerificationResult,
  VerifiedOp,
  VerifiedOps,
} from "./types";

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

export type OpsVerifierOptions = {
  /** Core Profile に関する検証オプション */
  core: {
    /** Core Profile の発行者 (OP ID) */
    issuer: string | string[];
    /** Core Profile の発行者の検証鍵 */
    keys: Keys;
  };
  /** Profile Annotation Issuer 登録証 PA に関する検証オプション */
  profileAnnotationIssuerRegistration: {
    /** 登録証 PA の発行者として認める OP ID (= REGISTRY_OPS の issuer) */
    issuer: string | string[];
  };
  /** バリデーター */
  validator?: typeof VcValidator;
};

/**
 * Originator Profile Set の検証者の作成
 * @param ops Originator Profile Set
 * @param options Core Profile / Profile Annotation Issuer 登録証 PA の発行者・鍵・バリデーターなど、検証時に使うオプション
 * @returns 検証者
 */
export function OpsVerifier(
  ops: OriginatorProfileSet,
  options: OpsVerifierOptions,
) {
  const { validator } = options;
  const decoded = decodeOps(ops);
  const verifyCp = JwtVcVerifier<CoreProfile>(
    options.core.keys,
    options.core.issuer,
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
    verifyAnnotationIssuerRegistration(
      resultOps,
      options.profileAnnotationIssuerRegistration.issuer,
    );
    return resultOps;
  }
  return verify;
}
