/** ProblemDetails の種類 (URL) からエラーコードを取り出す */
export const codeOf = (type: string): string =>
  type.split("/").filter(Boolean).pop() ?? type;
