import type { Organization, TabView } from "../view";
import type { Highlight, HighlightLabel } from "./protocol";

type Ready = Extract<TabView, { state: "ready" }>;

/** 組織のタグ。名前が無ければ出さない */
export function labelOf(
  organization?: Organization,
): HighlightLabel | undefined {
  const subject = organization?.media?.credentialSubject;
  if (!subject) return undefined;
  return {
    name: subject.name,
    logo: subject.logo?.id,
    country: organization.country,
  };
}

/**
 * 開いているアコーディオンに対応する、ページ上の強調
 * @param view タブの表示
 * @param openKey 開いているアコーディオン。Web サイトの運営者は "site"、コンテンツは key
 * @returns 強調しなければ undefined
 */
export function highlightOf(
  { site, contents, issuers }: Ready,
  openKey: string | undefined,
): Highlight | undefined {
  if (openKey === "site") {
    const label = site.state === "present" && labelOf(site.operator);
    return label ? { kind: "page", label } : undefined;
  }
  const content = contents.find(({ key }) => key === openKey);
  if (!content) return undefined;
  return {
    kind: "content",
    key: content.key,
    frame: content.frame,
    targets: content.attestation.target,
    label: labelOf(issuers.get(content.issuer)),
  };
}
