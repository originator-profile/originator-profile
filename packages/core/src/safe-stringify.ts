import { deserializeError, isErrorLike, serializeError } from "serialize-error";

function replaceErrors(key: string, value: unknown): unknown {
  if (value instanceof Error) {
    return serializeError(value);
  } else {
    return value;
  }
}

/**
 * Error クラスインスタンスを含むデータの文字列化
 * @param data Error クラスインスタンスかもしれないデータ
 * @param indent 整形時のインデント長
 * @returns JSON 文字列
 **/
export function stringifyWithError(data: unknown, indent?: number): string {
  return JSON.stringify(data, replaceErrors, indent);
}

function reviverErrors(key: string, value: unknown): unknown {
  if (isErrorLike(value)) {
    return deserializeError(value);
  } else {
    return value;
  }
}

/**
 * Error クラスインスタンスを含む文字列のデータ化
 * @param text JSON 文字列
 * @returns Error クラスインスタンスかもしれないデータ
 **/
/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
export function parseWithError(text: string): any {
  return JSON.parse(text, reviverErrors);
}

export function serializeIfError<T>(o: T): T | string {
  return isErrorLike(o) ? (serializeError(o) as string) : o;
}

export function deserializeIfError<T>(o: T | string): T | Error {
  return isErrorLike(o) ? deserializeError(o) : (o as T);
}
