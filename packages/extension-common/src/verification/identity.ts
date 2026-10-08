import { isExpired } from "@originator-profile/core";
import type { SourcedCredential } from "@originator-profile/presentation";
import {
  listInputDependencies,
  problemType,
  verifyAllowedUrl,
  type ProblemDetails,
} from "@originator-profile/verify";
import type { FrameCredentials } from "../credentials/types";
import type {
  InputIdentity,
  RegistryEntry,
  ResourceIdentity,
  SiteProfileEntry,
  VerificationEntry,
} from "./types";

/** 検証を完了できなかったことを表す問題の種類 */
export const VerificationIncomplete = problemType(
  "ERR_VERIFICATION_INCOMPLETE",
);

/** 結果が無効になった理由の種類 */
export const InvalidationType = {
  /** 用いた VC の有効期限を過ぎた */
  Expired: problemType("INVALIDATED_EXPIRED"),
  /** same-document navigation で allowedUrl の評価結果が一致しなくなった */
  AllowedUrlChanged: problemType("INVALIDATED_ALLOWED_URL_CHANGED"),
} as const;

/**
 * キーの順序によらない JSON 表現
 *
 * NOTE: chrome.storage から読み戻したオブジェクトはキーの順序が変わりうるため、
 * そのまま JSON.stringify で比べると内容が同じでも一致しない
 */
function canonicalize(value: unknown): string {
  return JSON.stringify(value, (_, nested: unknown) =>
    nested && typeof nested === "object" && !Array.isArray(nested)
      ? Object.fromEntries(
          Object.entries(nested).sort(([a], [b]) => (a < b ? -1 : 1)),
        )
      : nested,
  );
}

async function digest(value: unknown): Promise<string> {
  const data = new TextEncoder().encode(canonicalize(value));
  const hash = await crypto.subtle.digest("SHA-256", data);
  return btoa(String.fromCharCode(...new Uint8Array(hash)));
}

const identify = (
  credentials: SourcedCredential<unknown>[],
): Promise<ResourceIdentity[]> =>
  Promise.all(
    credentials.map(async ({ source, credential }) => ({
      source,
      digest: await digest(credential),
    })),
  );

/**
 * 文書から取得したクレデンシャルの入力同一性の判定手段を得る
 * @param credentials 文書から取得したクレデンシャル
 * @param url 文書の URL
 */
export async function toInputIdentity(
  credentials: Pick<FrameCredentials, "ops" | "cas">,
  url: string,
): Promise<InputIdentity> {
  return {
    cas: await identify(credentials.cas),
    ops: await identify(credentials.ops),
    targets: listInputDependencies(
      credentials.cas.map(({ credential }) => credential),
    ),
    evaluatedUrl: url,
  };
}

type Settled = Extract<VerificationEntry, { state: "settled" }>;

/** CA ごとの allowedUrl の評価結果。復号できなかった CA は null */
const evaluateAllowedUrl = (entry: Settled, url: string) =>
  Promise.all(
    (entry.result.outcome?.cas ?? []).map(({ attestation }) =>
      attestation
        ? verifyAllowedUrl(url, attestation.allowedUrl)
        : Promise.resolve(null),
    ),
  );

/**
 * allowedUrl の評価結果が、検証時の URL と現在の URL とで一致するか
 * @param entry 確定した検証結果
 * @param url 現在の document's URL
 */
export async function isAllowedUrlConsistent(
  entry: Settled,
  url: string,
): Promise<boolean> {
  if (url === entry.inputIdentity.evaluatedUrl) return true;
  const [evaluated, current] = await Promise.all([
    evaluateAllowedUrl(entry, entry.inputIdentity.evaluatedUrl),
    evaluateAllowedUrl(entry, url),
  ]);
  return JSON.stringify(evaluated) === JSON.stringify(current);
}

/**
 * 用いた VC の有効期間の終了 (exp、validUntil) のうち最も早いもの
 * @returns 有効期間の終了を持つ VC がなければ undefined
 */
export function earliestExpiration({
  securingResults,
}: Pick<RegistryEntry, "securingResults">): string | undefined {
  const expirations = securingResults
    .flatMap(({ expiredAt, validUntil }) => [expiredAt, validUntil])
    .flatMap((value) => (value ? [Date.parse(value)] : []));
  if (expirations.length === 0) return undefined;
  return new Date(Math.min(...expirations)).toISOString();
}

/**
 * 時刻の境界を持たないレジストリの検証結果を、現在時刻でも使えるか
 *
 * 検証を通過した結果は、用いた VC の有効期間の終了がすべて現在時刻より後の場合に限る。
 * 通過しなかった結果は時刻の経過で通過に変わらないため、そのまま使える。
 */
export const isStillValid = (
  result: Pick<RegistryEntry, "status" | "securingResults">,
  now: Date,
) => {
  if (!result.status) return true;
  const expiration = earliestExpiration(result);
  return expiration === undefined || !isExpired(expiration, now);
};

/** 結果が時刻の境界を過ぎたか */
const isPastValidUntil = (
  { result }: { result: { validUntil?: string } },
  now: Date,
) => result.validUntil !== undefined && isExpired(result.validUntil, now);

/**
 * 保持している結果を再利用できるか
 *
 * 入力同一性が保たれ、現在時刻が時刻の境界より前の場合に限る。
 * 検証範囲は verifyDocument が常に同じ範囲を適用するため比べない。
 * @param entry 保持している検証の状態
 * @param current 現在の入力同一性の判定手段
 * @param now 現在時刻
 */
export async function isReusable(
  entry: VerificationEntry | undefined,
  current: InputIdentity,
  now: Date,
): Promise<boolean> {
  if (entry?.state !== "settled" || isPastValidUntil(entry, now)) return false;
  // NOTE: 検証を完了できなかった結果は検証の結果ではないため、入力が同じでも使わない
  if (
    entry.result.errors?.some(({ type }) => type === VerificationIncomplete)
  ) {
    return false;
  }
  const { evaluatedUrl: _, ...held } = entry.inputIdentity;
  const { evaluatedUrl, ...identity } = current;
  return (
    canonicalize(held) === canonicalize(identity) &&
    (await isAllowedUrlConsistent(entry, evaluatedUrl))
  );
}

/** 結果が rendered result に依存するか。bfcache から復元したら改めて検証する */
export const dependsOnRenderedResult = (entry: VerificationEntry | undefined) =>
  entry?.state === "settled" &&
  entry.inputIdentity.targets.some(
    ({ dependency }) => dependency === "rendered-result",
  );

/**
 * 結果を無効にする
 * @param entry 確定した検証結果
 * @param reason 無効になった理由
 * @param now 現在時刻
 */
export const invalidate = (
  entry: Settled,
  reason: ProblemDetails,
  now: Date,
): VerificationEntry => ({
  ...entry,
  state: "invalidated",
  invalidatedAt: now.toISOString(),
  reason,
});

/**
 * 現在時刻での検証の状態
 *
 * 時刻の境界を過ぎた結果は、書き込みを待たずに無効として扱う。
 * @param entry 保持している検証の状態
 * @param now 現在時刻
 */
export function resolveEntry(
  entry: VerificationEntry,
  now: Date,
): VerificationEntry {
  if (entry.state !== "settled" || !isPastValidUntil(entry, now)) return entry;
  return invalidate(
    entry,
    { type: InvalidationType.Expired, title: "Verification result expired" },
    now,
  );
}

/**
 * 現在時刻での Site Profile の検証の状態
 *
 * 時刻の境界を過ぎた結果は、書き込みを待たずに無効として扱う。
 */
export function resolveSiteProfileEntry(
  entry: SiteProfileEntry,
  now: Date,
): SiteProfileEntry {
  if (entry.state !== "settled" || !isPastValidUntil(entry, now)) return entry;
  return {
    ...entry,
    state: "invalidated",
    invalidatedAt: now.toISOString(),
    reason: {
      type: InvalidationType.Expired,
      title: "Verification result expired",
    },
  };
}

/** 再利用できる Site Profile の検証結果か。時刻の境界を過ぎていない確定した結果に限る */
export const isSiteProfileReusable = (
  entry: SiteProfileEntry | undefined,
  now: Date,
): entry is Extract<SiteProfileEntry, { state: "settled" }> =>
  entry?.state === "settled" && !isPastValidUntil(entry, now);
