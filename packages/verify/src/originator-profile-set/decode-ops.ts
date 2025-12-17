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
  OpDecodingResult,
  OpsDecodingResult,
} from "./types";

const isEveryDecodedPa = (
  annotations: JwtVcDecodingResult<Certificate>[],
): annotations is UnverifiedJwtVc<Certificate>[] =>
  annotations.every((annotation) => "doc" in annotation);

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
  /* eslint complexity: ["error", { "max": 11 }] */
  const resultOps = ops.map((op): OpDecodingResult => {
    const core = decodeCp(op.core);
    const annotations = op.annotations
      ? op.annotations.map(decodePa)
      : undefined;
    const media = op.media ? decodeWmp(op.media) : undefined;
    const resultOp = { core, annotations, media };
    if (core instanceof Error) {
      return new OpInvalid("Core Profile decode failed", resultOp);
    }
    if (annotations && !isEveryDecodedPa(annotations)) {
      return new OpInvalid("Profile Annotation decode failed", resultOp);
    }
    if (media instanceof Error) {
      return new OpInvalid("Web Media Profile decode failed", resultOp);
    }
    if (
      media &&
      core.doc.credentialSubject.id !== media.doc.credentialSubject.id
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
    return resultOp as DecodedOp;
  });
  if (!isDecodedOps(resultOps)) {
    return new OpsInvalid("Invalid Originator Profile Set", resultOps);
  }
  return resultOps;
}
