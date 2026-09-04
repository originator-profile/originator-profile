import type {
  ContentAttestation,
  CoreProfile,
  Jwk,
  OpVc,
  WebMediaProfile,
} from "@originator-profile/model";
import type { Certificate } from "../originator-profile-set/types";
import { childPointer, pointer } from "./pointer";
import { toProblemDetails } from "./to-problem-details";
import type { ProblemDetails, SecuringResult } from "./types";

/** 復号した Originator Profile のペイロード */
export type OriginatorPayload = {
  /** 復号できなかった場合は null */
  core: CoreProfile | null;
  annotations?: (Certificate | null)[];
  media?: (WebMediaProfile | null)[];
};

/** 復号した Content Attestation Set の要素 */
export type CasPayload = {
  main: boolean;
  /** 復号できなかった場合は null */
  attestation: ContentAttestation | null;
};

/** 変換中に集める securing mechanism の検証結果と問題 */
export type Collector = {
  securingResults: SecuringResult[];
  errors: ProblemDetails[];
};

/** 収集先を作る */
export const createCollector = (): Collector => ({
  securingResults: [],
  errors: [],
});

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

/** 検証パッケージのエラーは、失敗した対象を result に保持する */
const failureOf = (error: Error): Record<string, unknown> | undefined => {
  const result = "result" in error ? error.result : undefined;
  return isObject(result) ? result : undefined;
};

const asRecord = (value: unknown): Record<string, unknown> | undefined =>
  isObject(value) ? value : undefined;

const asString = (value: unknown): string | undefined =>
  typeof value === "string" ? value : undefined;

const asDate = (value: unknown): Date | undefined =>
  value instanceof Date ? value : undefined;

const asJwk = (value: unknown): Jwk | undefined =>
  isObject(value) ? (value as Jwk) : undefined;

/** 値のないプロパティを落とす */
const compact = <T extends object>(value: T): T =>
  Object.fromEntries(
    Object.entries(value).filter(([, v]) => v !== undefined),
  ) as T;

/** VC が持つ securing mechanism 由来の情報を取り出す */
function toSecuringResult(
  vc: Record<string, unknown> | undefined,
  at: string,
  status: boolean,
): SecuringResult {
  const doc = asRecord(vc?.doc);

  return compact({
    pointer: at,
    status,
    source: asString(vc?.source),
    mediaType: asString(vc?.mediaType),
    algorithm: asString(vc?.algorithm),
    issuedAt: asDate(vc?.issuedAt),
    expiredAt: asDate(vc?.expiredAt),
    verificationKey: asJwk(vc?.verificationKey),
    controller: asString(doc?.issuer),
  });
}

/**
 * VC の検証結果を、復号したペイロードと収集物に分解する
 * @param value 検証済み VC、または検証・復号に失敗したエラー
 * @param at 位置を指す JSONPath
 * @param collect 収集先
 * @returns 復号できたペイロード。復号できなければ null
 */
export function convertVc<T extends OpVc>(
  value: unknown,
  at: string,
  collect: Collector,
): T | null {
  if (value instanceof Error) {
    const failure = failureOf(value);
    collect.securingResults.push(toSecuringResult(failure, at, false));
    collect.errors.push(toProblemDetails(value, at));
    return (failure?.doc as T) ?? null;
  }

  if (!isObject(value)) return null;
  collect.securingResults.push(toSecuringResult(value, at, true));
  return (value.doc as T) ?? null;
}

/** Originator Profile の復号結果・検証結果が持つ形 */
type OpLike = {
  core: unknown;
  annotations?: unknown[];
  media?: unknown[];
};

/**
 * Originator Profile の検証結果を、復号したペイロードと収集物に分解する
 * @param op 検証済み OP、または検証・復号に失敗したエラー
 * @param at 位置を指す JSONPath
 * @param collect 収集先
 */
export function convertOp(
  op: unknown,
  at: string,
  collect: Collector,
): OriginatorPayload {
  if (op instanceof Error) {
    collect.errors.push(toProblemDetails(op, at));
  }

  const source = (op instanceof Error ? failureOf(op) : op) as
    | OpLike
    | undefined;
  if (!source) return { core: null };

  return {
    core: convertVc<CoreProfile>(
      source.core,
      childPointer(at, "core"),
      collect,
    ),
    ...(source.annotations && {
      annotations: source.annotations.map((annotation, index) =>
        convertVc<Certificate>(
          annotation,
          childPointer(at, "annotations", index),
          collect,
        ),
      ),
    }),
    ...(source.media && {
      media: source.media.map((m, index) =>
        convertVc<WebMediaProfile>(
          m,
          childPointer(at, "media", index),
          collect,
        ),
      ),
    }),
  };
}

/**
 * Originator Profile Set の検証結果を、復号したペイロードと収集物に分解する
 * @param ops 検証済み OPS、または検証・復号に失敗したエラー
 * @param collect 収集先
 */
export function convertOps(
  ops: unknown,
  collect: Collector,
): OriginatorPayload[] {
  if (ops instanceof Error) {
    collect.errors.push(toProblemDetails(ops, pointer("originators")));
  }

  const list = (ops instanceof Error ? failureOf(ops) : ops) as
    | unknown[]
    | undefined;
  if (!Array.isArray(list)) return [];

  return list.map((op, index) =>
    convertOp(op, pointer("originators", index), collect),
  );
}

/**
 * Content Attestation Set の検証結果を、復号したペイロードと収集物に分解する
 * @param cas 検証済み CAS、または検証に失敗した結果
 * @param at 対象の文書の位置を指す JSONPath
 * @param collect 収集先
 */
export function convertCas(
  cas: { main: boolean; attestation: unknown }[],
  at: string,
  collect: Collector,
): CasPayload[] {
  return cas.map(({ main, attestation }, index) => ({
    main,
    attestation: convertVc<ContentAttestation>(
      attestation,
      childPointer(at, "cas", index, "attestation"),
      collect,
    ),
  }));
}
