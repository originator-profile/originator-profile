import type {
  DocumentFrame,
  SupportedCa,
} from "@originator-profile/extension-common";
import type { ContentAttestation } from "@originator-profile/model";

/** 提示するコンテンツの区分 */
export type ContentCategory =
  | "article"
  | "advertorial"
  | "media"
  | "unknown"
  | "advertisement";

/**
 * 区分の並び順
 *
 * NOTE: OP Lens の要件「CA種別に応じた分類・順序で表示される」に従う。メインの
 * コンテンツが最初 (その区分ごと先頭に出す)、広告が最後で、そのあいだの順序は
 * 未確定。単体メディア (画像・音声・動画) に当たる CA の型はまだ無いため、どの
 * CA もこの区分には入らない。
 */
export const categoryOrder: ContentCategory[] = [
  "article",
  "advertorial",
  "media",
  "unknown",
  "advertisement",
];

/** 文書が読み込まれているフレーム */
export type ContentFrame = DocumentFrame;

/** 提示するコンテンツ */
export type Content = {
  /** コンテンツの同一性。発行者と CA ID の組 */
  key: string;
  category: ContentCategory;
  /** CA の型 (Article、OnlineAd など) */
  type: string;
  main: boolean;
  /** CA 発行者の OP ID */
  issuer: string;
  title?: string;
  /** サムネイルの URL */
  image?: string;
  attestation: ContentAttestation;
  /** コンテンツが出ているフレーム。文書の順に並ぶ */
  frames: ContentFrame[];
};

/** 文書の Content Attestation */
export type DocumentCas = {
  frame: ContentFrame;
  cas: { main: boolean; attestation: ContentAttestation | null }[];
};

const isSupported = (ca: ContentAttestation): ca is SupportedCa =>
  ["Article", "Advertorial", "OnlineAd"].includes(ca.credentialSubject.type);

function categoryOf(type: string): ContentCategory {
  switch (type) {
    case "Article":
      return "article";
    case "Advertorial":
      return "advertorial";
    case "OnlineAd":
      return "advertisement";
    default:
      return "unknown";
  }
}

function describe(ca: ContentAttestation): Pick<Content, "title" | "image"> {
  if (!isSupported(ca)) return {};
  const subject = ca.credentialSubject;
  return {
    title: subject.type === "OnlineAd" ? subject.name : subject.headline,
    image: subject.image?.id,
  };
}

function toContent(
  main: boolean,
  attestation: ContentAttestation,
): Omit<Content, "frames"> {
  const type = attestation.credentialSubject.type;
  return {
    key: `${attestation.issuer}:${attestation.credentialSubject.id}`,
    category: categoryOf(type),
    type,
    main,
    issuer: attestation.issuer,
    ...describe(attestation),
    attestation,
  };
}

/**
 * 文書群の Content Attestation を、提示する順に並べる
 *
 * 発行者と CA ID が同じものは同じコンテンツとみなす。CA は後のものを残し、
 * 出ているフレームはすべて集める。
 * @param documents 文書ごとの Content Attestation。トップレベル文書を先頭とする
 */
export function contentsOf(documents: DocumentCas[]): Content[] {
  const occurrences = documents.flatMap(({ frame, cas }) =>
    cas.flatMap(({ main, attestation }) =>
      attestation ? [{ content: toContent(main, attestation), frame }] : [],
    ),
  );
  const contents = new Map<string, Content>();
  for (const { content, frame } of occurrences) {
    const frames = contents.get(content.key)?.frames ?? [];
    contents.set(content.key, {
      ...content,
      frames: frames.includes(frame) ? frames : [...frames, frame],
    });
  }
  const rank = (content: Content) =>
    content.main ? -1 : categoryOrder.indexOf(content.category);
  return [...contents.values()].sort((a, b) => rank(a) - rank(b));
}

/** 区分ごとのコンテンツ */
export type ContentSection = {
  category: ContentCategory;
  contents: Content[];
};

/**
 * 並べたコンテンツを区分ごとにまとめる
 *
 * 区分は最初に現れた順に並ぶ。メインのコンテンツの区分が先頭になる。
 * @param contents {@link contentsOf} で並べたコンテンツ
 */
export const sectionsOf = (contents: Content[]): ContentSection[] =>
  Map.groupBy(contents, ({ category }) => category)
    .entries()
    .map(([category, contents]) => ({ category, contents }))
    .toArray();
