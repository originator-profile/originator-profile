export const messages = {
  rtb: "広告取引検証",
  loading: {
    text: "読み込み中…",
    color: "default",
  },
  missing: {
    text: "広告取引の検証情報はありません。",
    color: "default",
  },
  match: {
    text: "運用型広告取引 (RTB) 記載情報との整合性が検証できました。",
    color: "success",
  },
  mismatch: {
    text: "運用型広告取引 (RTB) 記載情報との整合性がありません。",
    color: "danger",
  },
} as const;
