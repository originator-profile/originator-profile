import { decodeOps } from "@originator-profile/verify";
import dotenv from "dotenv";

dotenv.config();

export async function decodeRegistry(
  /** Core Profile Issuers OPS (JSON 文字列) */
  input: string = process.env.REGISTRY_OPS ?? "",
) {
  let ops;
  try {
    ops = JSON.parse(input);
  } catch (e) {
    return e as SyntaxError;
  }

  const decoded = decodeOps(ops);
  if (decoded instanceof Error) return decoded;

  return { ops, decoded };
}
