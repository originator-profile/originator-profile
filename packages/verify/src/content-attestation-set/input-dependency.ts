import type {
  ContentAttestation,
  ContentAttestationSet,
  Target,
} from "@originator-profile/model";
import { JwtVcDecoder } from "@originator-profile/securing-mechanism";
import { pointer } from "../result/pointer";
import { normalizeCasItem } from "./normalize-cas-item";

/**
 * target の入力依存対象
 *
 * - `response`: リソースの取得結果。取得の完了で検証可能になる
 * - `parsed-dom`: 構文解析後の DOM。readiness が `interactive` で検証可能になる
 * - `rendered-result`: レンダリング結果。readiness が `complete` で検証可能になる
 *
 * @see https://docs.originator-profile.org/ja/opb/verifier-processing-model/content-attestation-set/
 */
export type InputDependency = "response" | "parsed-dom" | "rendered-result";

/** target の種類ごとの入力依存対象 */
export const targetInputDependency = {
  ExternalResourceTargetIntegrity: "response",
  HtmlTargetIntegrity: "parsed-dom",
  TextTargetIntegrity: "parsed-dom",
  VisibleTextTargetIntegrity: "rendered-result",
} as const satisfies Record<Target["type"], InputDependency>;

/**
 * Content Attestation Set の target が依存する入力を列挙する
 *
 * 検証を開始してよい時点を決めるために、署名を検証せずに復号する。
 * 復号できない CA は、検証の段で失敗するため無視する。
 * @param cas Content Attestation Set
 * @returns target ごとの JSONPath と入力依存対象
 */
export function listInputDependencies(
  cas: ContentAttestationSet,
): { pointer: string; dependency: InputDependency }[] {
  const decode = JwtVcDecoder<ContentAttestation>();
  return cas.flatMap((ca, i) => {
    const decoded = decode(normalizeCasItem(ca).attestation);
    if (decoded instanceof Error) return [];
    return decoded.doc.target.map((target, j) => ({
      pointer: pointer("cas", i, "attestation", "target", j),
      dependency: targetInputDependency[target.type],
    }));
  });
}
