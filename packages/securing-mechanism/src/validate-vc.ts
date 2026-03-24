import type { ZodType } from "zod";
import { VcValidateFailed } from "./errors";
import {
  SchemaValidationError,
  UnverifiedVc,
  VcValidationFailure,
  VcValidationResult,
} from "./types";

/** データモデルへの適合性確認のためのバリデーター */
export function VcValidator<V extends UnverifiedVc>(schema: ZodType) {
  /**
   * VC の妥当性確認
   * @param vc VC (未検証 or 検証済み)
   * @return 妥当性確認結果
   */
  function validate(vc: V): VcValidationResult<V, VcValidationFailure<V>> {
    const result = schema.safeParse(vc.doc);
    if (!result.success) {
      const issues = result.error.issues.map((i) => ({
        path: i.path.join("."),
        message: i.message,
      }));
      return new VcValidateFailed(result.error.message, {
        ...vc,
        error: new SchemaValidationError(issues),
      });
    }

    return vc;
  }
  return validate;
}

/** データモデルへの適合性確認のためのバリデーター */
export type VcValidator<V extends UnverifiedVc> = ReturnType<
  typeof VcValidator<V>
>;
