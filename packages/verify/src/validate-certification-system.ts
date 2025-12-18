import { CertificationSystem } from "@originator-profile/model";
import typeOf from "just-typeof";
import { CertificationSystemValidationFailed } from "./errors";

/** 認証制度ペイロードの確認のためのバリデーター */
export function CertificationSystemValidator() {
  return function validate(
    payload: unknown,
  ): true | CertificationSystemValidationFailed {
    if (typeOf(payload) !== "object") {
      return new CertificationSystemValidationFailed("should be an object", {
        payload,
      });
    }

    const keys = Object.keys(payload as object);
    const entries = Object.entries(payload as object);

    if (!CertificationSystem.required.every((k) => keys.includes(k))) {
      return new CertificationSystemValidationFailed(
        "should be contain required properties",
        { payload },
      );
    }

    for (const entry of entries) {
      const [key, value] = entry;
      const propertySchema = CertificationSystem.properties[
        key as keyof typeof CertificationSystem.properties
      ] as unknown as object;
      if (typeOf(propertySchema) !== "object") {
        return new CertificationSystemValidationFailed(
          "should not contain additional properties",
          { payload },
        );
      }

      if ("const" in propertySchema && value !== propertySchema.const)
        return new CertificationSystemValidationFailed(
          `should be contain value of '${value}' in '${key}' property`,
          { payload },
        );
      if ("type" in propertySchema && typeof value !== propertySchema.type)
        return new CertificationSystemValidationFailed(
          `should be contain ${propertySchema.type as string} value in '${key}' property`,
          { payload },
        );
    }
    return true;
  };
}

export type CertificationSystemValidator = ReturnType<
  typeof CertificationSystemValidator
>;

/**
 * 認証制度の検証
 * @param payload ペイロード
 * @return 検証結果
 */
export function validateCertificationSystem(
  payload: unknown,
): CertificationSystem | CertificationSystemValidationFailed {
  const validator = CertificationSystemValidator();
  const result = validator(payload);
  if (result !== true) {
    return result;
  }
  return payload as CertificationSystem;
}
