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
  DecodedOp,
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

/** デコード済みOPのバリデーション */
const validateDecodedOp = (
  core: UnverifiedJwtVc<CoreProfile>,
  annotations: JwtVcDecodingResult<Certificate>[] | undefined,
  media: JwtVcDecodingResult<WebMediaProfile>[] | undefined,
  resultOp: OpDecodingFailure,
):
  | {
      type: "valid";
      annotations?: UnverifiedJwtVc<Certificate>[];
      media?: UnverifiedJwtVc<WebMediaProfile>[];
    }
  | OpInvalid => {
  if (annotations && !isEveryDecodedPa(annotations)) {
    return new OpInvalid("Profile Annotation decode failed", resultOp);
  }
  if (media && !isEveryDecodedWmp(media)) {
    return new OpInvalid("Web Media Profile decode failed", resultOp);
  }
  if (
    media &&
    media.some(
      (m) => core.doc.credentialSubject.id !== m.doc.credentialSubject.id,
    )
  ) {
    return new OpInvalid(
      "Subject mismatch between Core Profile and Web Media Profile",
      resultOp,
    );
  }
  if (
    annotations &&
    annotations.some(
      (annotation) =>
        core.doc.credentialSubject.id !== annotation.doc.credentialSubject.id,
    )
  ) {
    return new OpInvalid(
      "Subject mismatch between Core Profile and Profile Annotation",
      resultOp,
    );
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
  const resultOps = ops.map((op): OpDecodingResult => {
    const core = decodeCp(op.core);
    const annotations = op.annotations
      ? op.annotations.map(decodePa)
      : undefined;
    // NOTE: 後方互換性のため単数・配列両方を受け入れ、内部的には配列に正規化
    const mediaInput = op.media;
    const mediaArray = mediaInput
      ? Array.isArray(mediaInput)
        ? mediaInput
        : [mediaInput]
      : undefined;
    const media = mediaArray ? mediaArray.map(decodeWmp) : undefined;
    const resultOp = { core, annotations, media };

    if (core instanceof Error) {
      return new OpInvalid("Core Profile decode failed", resultOp);
    }

    const validated = validateDecodedOp(core, annotations, media, resultOp);
    if (validated instanceof OpInvalid) {
      return validated;
    }

    return {
      core,
      annotations: validated.annotations,
      media: validated.media,
    } as DecodedOp;
  });
  if (!isDecodedOps(resultOps)) {
    return new OpsInvalid("Invalid Originator Profile Set", resultOps);
  }
  return resultOps;
}
