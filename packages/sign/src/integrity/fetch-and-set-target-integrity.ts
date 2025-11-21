import type { RawTarget, Target } from "@originator-profile/model";
import type { HashAlgorithm } from "websri";
import { createIntegrity } from "./target-integrity";
import type { DocumentProvider } from "./types";

/** Integrityの計算に失敗 (例: 検証対象が存在しない) エラー */
export class IntegrityCalculationError extends Error {}

/**
 * 未署名 Content Attestation への Target Integrity の割り当て
 * target[].integrity を省略した場合、type に準じて content から integrity を計算します。
 * 一方、target[].integrity が含まれる場合、その値をそのまま使用します。
 * なお、いずれも target[].content プロパティが削除される点にご注意ください。
 * @see {@link https://docs.originator-profile.org/opb/content-integrity-descriptor/}
 * @throws {IntegrityCalculationError} Integrityの計算に失敗 (例: 検証対象が存在しない)
 * @example
 * ```ts
 * const uca = {
 *   // ...
 *   target: [
 *     {
 *       type: "<Target Integrityの種別>",
 *       cssSelector: "<CSS セレクター>",
 *     },
 *   ],
 * };
 *
 * await fetchAndSetTargetIntegrity("sha256", uca);
 *
 * console.log(uca.target);
 * // [
 * //   {
 * //     type: "<Target Integrityの種別>",
 * //     cssSelector: "<CSS セレクター>",
 * //     integrity: "sha256-..."
 * //   }
 * // ]
 * ```
 */
export async function fetchAndSetTargetIntegrity<
  T extends { target: ReadonlyArray<RawTarget> },
>(
  alg: HashAlgorithm,
  obj: T,
  documentProvider: DocumentProvider = async () => document,
): Promise<T & { target: ReadonlyArray<Target> }> {
  const target = await Promise.all(
    obj.target.map(async (raw: RawTarget, i) => {
      if (raw.integrity) {
        const { content: _, ...target } = raw;

        return target as Target;
      }

      const doc =
        raw.type === "ExternalResourceTargetIntegrity"
          ? undefined
          : await documentProvider(raw);

      const target = await createIntegrity(alg, raw, doc);

      if (!target) {
        throw new IntegrityCalculationError(
          `Failed to create integrity for element target[${i}].`,
        );
      }

      return target;
    }),
  );

  return Object.assign(obj, { target });
}
