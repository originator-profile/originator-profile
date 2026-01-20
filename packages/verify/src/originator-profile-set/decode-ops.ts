import {
  CoreProfile,
  WebMediaProfile,
  OriginatorProfileSet,
} from "@originator-profile/model";
import {
  JwtVcDecoder,
  JwtVcDecodingResult,
  UnverifiedJwtVc,
} from "@originator-profile/securing-mechanism";
import {
  Certificate,
  DecodedOps,
  OpsDecodingResult,
  DecodedOp,
  OpDecodingResult,
} from "./types";
import { OpInvalid, OpsInvalid } from "./errors";

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
  const resultOps = ops.map((op, opIndex): OpDecodingResult => {
    const core = decodeCp(op.core);
    const annotations = op.annotations
      ? op.annotations.map(decodePa)
      : undefined;
    const media = op.media ? decodeWmp(op.media) : undefined;
    const resultOp = { core, annotations, media };
    if (core instanceof Error) {
      return new OpInvalid(
        `Core Profile decode failed (OP[${opIndex}])`,
        resultOp,
      );
    }
    if (annotations && !isEveryDecodedPa(annotations)) {
      const failedPaths = annotations
        .map((annotation, index) =>
          !("doc" in annotation) ? `OP[${opIndex}].PA[${index}]` : null,
        )
        .filter((path): path is string => path !== null);
      return new OpInvalid(
        `Profile Annotation decode failed (${failedPaths.join(", ")})`,
        resultOp,
      );
    }
    if (media instanceof Error) {
      return new OpInvalid(
        `Web Media Profile decode failed (OP[${opIndex}])`,
        resultOp,
      );
    }
    if (
      media &&
      core.doc.credentialSubject.id !== media.doc.credentialSubject.id
    ) {
      return new OpInvalid(
        `Subject mismatch between Core Profile and Web Media Profile (OP[${opIndex}])`,
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
      const mismatchedPaths = annotations
        .map((annotation, index) =>
          core.doc.credentialSubject.id !== annotation.doc.credentialSubject.id
            ? `OP[${opIndex}].PA[${index}]`
            : null,
        )
        .filter((path): path is string => path !== null);
      return new OpInvalid(
        `Subject mismatch between Core Profile and Profile Annotation (${mismatchedPaths.join(", ")})`,
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
