import {
  CoreProfile,
  OriginatorProfileSet,
  WebMediaProfile,
} from "@originator-profile/model";
import {
  JwtVcDecoder,
  JwtVcDecodingResult,
  UnverifiedJwtVc,
} from "@originator-profile/securing-mechanism";
import { OpInvalid, OpsInvalid } from "./errors";
import {
  Certificate,
  DecodedOps,
  OpDecodingFailure,
  OpDecodingResult,
  OpsDecodingResult,
} from "./types";

const isEveryDecodedPa = (
  annotations: JwtVcDecodingResult<Certificate>[],
): annotations is UnverifiedJwtVc<Certificate>[] =>
  annotations.every((annotation) => "doc" in annotation);

const isEveryDecodedWmp = (
  media: JwtVcDecodingResult<WebMediaProfile>[],
): media is UnverifiedJwtVc<WebMediaProfile>[] =>
  media.every((m) => "doc" in m);

/** 失敗したインデックスのパス文字列を生成 */
const failedPaths = <T>(
  items: T[],
  opIndex: number,
  prefix: string,
  isFailed: (item: T) => boolean,
): string[] =>
  items
    .map((item, index) =>
      isFailed(item) ? `OP[${opIndex}].${prefix}[${index}]` : null,
    )
    .filter((path): path is string => path !== null);

/** デコード済みOPのバリデーション */
const validateDecodedOp = (
  core: UnverifiedJwtVc<CoreProfile>,
  annotations: JwtVcDecodingResult<Certificate>[] | undefined,
  media: JwtVcDecodingResult<WebMediaProfile>[] | undefined,
  resultOp: OpDecodingFailure,
  opIndex: number,
):
  | {
      type: "valid";
      annotations?: UnverifiedJwtVc<Certificate>[];
      media?: UnverifiedJwtVc<WebMediaProfile>[];
    }
  | OpInvalid => {
  if (annotations && !isEveryDecodedPa(annotations)) {
    const paths = failedPaths(annotations, opIndex, "PA", (a) => !("doc" in a));
    return new OpInvalid(
      `Profile Annotation decode failed (${paths.join(", ")})`,
      resultOp,
    );
  }
  if (media && !isEveryDecodedWmp(media)) {
    const paths = failedPaths(media, opIndex, "WMP", (m) => !("doc" in m));
    return new OpInvalid(
      `Web Media Profile decode failed (${paths.join(", ")})`,
      resultOp,
    );
  }
  const subjectMismatchErrors: string[] = [];
  if (
    media &&
    media.some(
      (m) => core.doc.credentialSubject.id !== m.doc.credentialSubject.id,
    )
  ) {
    const details = media
      .map((m, index) =>
        core.doc.credentialSubject.id !== m.doc.credentialSubject.id
          ? `OP[${opIndex}].WMP[${index}] issuer: ${m.doc.issuer}, subject: ${m.doc.credentialSubject.id}`
          : null,
      )
      .filter((d): d is string => d !== null);
    subjectMismatchErrors.push(
      `Subject mismatch between Core Profile and Web Media Profile (${details.join(", ")})`,
    );
  }
  if (
    annotations &&
    annotations.some(
      (annotation) =>
        core.doc.credentialSubject.id !== annotation.doc.credentialSubject.id,
    )
  ) {
    const details = annotations
      .map((a, index) =>
        core.doc.credentialSubject.id !== a.doc.credentialSubject.id
          ? `OP[${opIndex}].PA[${index}] issuer: ${a.doc.issuer}, subject: ${a.doc.credentialSubject.id}`
          : null,
      )
      .filter((d): d is string => d !== null);
    subjectMismatchErrors.push(
      `Subject mismatch between Core Profile and Profile Annotation (${details.join(", ")})`,
    );
  }
  if (subjectMismatchErrors.length > 0) {
    return new OpInvalid(subjectMismatchErrors.join("\n"), resultOp);
  }
  return { type: "valid", annotations, media };
};

const isDecodedOps = (ops: OpDecodingResult[]): ops is DecodedOps =>
  ops.every((op) => !(op instanceof OpInvalid));

/**
 * Originator Profile Set の復号
 * @param ops Originator Profile Set
 * @returns 復号結果
 */
export function decodeOps(ops: OriginatorProfileSet): OpsDecodingResult {
  const decodeCp = JwtVcDecoder<CoreProfile>();
  const decodePa = JwtVcDecoder<Certificate>();
  const decodeWmp = JwtVcDecoder<WebMediaProfile>();
  const resultOps = ops.map((op, opIndex): OpDecodingResult => {
    const core = decodeCp(op.core);
    const annotations = op.annotations
      ? op.annotations.map(decodePa)
      : undefined;
    // NOTE: 2026-11-01 まで後方互換性のため単数・配列両方を受け入れ、内部的には配列に正規化
    const mediaInput = op.media;
    const mediaArray = mediaInput
      ? Array.isArray(mediaInput)
        ? mediaInput
        : [mediaInput]
      : undefined;
    const media = mediaArray ? mediaArray.map(decodeWmp) : undefined;
    const resultOp = { core, annotations, media };

    if (core instanceof Error) {
      return new OpInvalid(
        `Core Profile decode failed (OP[${opIndex}])`,
        resultOp,
      );
    }

    const validated = validateDecodedOp(
      core,
      annotations,
      media,
      resultOp,
      opIndex,
    );
    if (validated instanceof OpInvalid) {
      return validated;
    }

    return {
      core,
      annotations: validated.annotations,
      media: validated.media,
    };
  });
  if (!isDecodedOps(resultOps)) {
    const invalidIndexes = resultOps
      .map((op, index) => (op instanceof OpInvalid ? index : null))
      .filter((i): i is number => i !== null);

    const msg =
      invalidIndexes.length > 0
        ? `Invalid Originator Profile Set (${invalidIndexes.map((i) => `OP[${i}]`).join(", ")})`
        : "Invalid Originator Profile Set";

    return new OpsInvalid(msg, resultOps);
  }
  return resultOps;
}
