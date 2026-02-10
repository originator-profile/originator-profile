import { OpVc } from "@originator-profile/model";
import {
  UnverifiedJwtVc,
  VerifiedJwtVc,
} from "@originator-profile/securing-mechanism";
import {
  OpDecodingFailure,
  OpsDecodingFailure,
  OpsVerificationFailure,
  OpVerificationFailure,
} from "./types";

/**
 * Originator Profile Set 無効
 *
 * Originator Profile Set が無効な形式です。詳細は result プロパティに格納される OpInvalid クラスインスタンスのメッセージを確認してください。
 */
export class OpsInvalid extends Error {
  static get code() {
    return "ERR_ORIGINATOR_PROFILE_SET_INVALID";
  }
  readonly code = OpsInvalid.code;

  constructor(
    message: string,
    public result: OpsDecodingFailure,
  ) {
    super(message);
  }
}

/**
 * Originator Profile 無効
 *
 * Originator Profile が無効な形式です。次の原因で使用されます。
 *
 *  - Core Profile の復号に失敗した
 *  - Profile Annotation の復号に失敗した
 *  - Web Media Profile の復号に失敗した
 *  - Core Profile と Profile Annotation の `credentialSubject.id` が不一致
 *  - Core Profile と Web Media Profile の `credentialSubject.id` が不一致
 */
export class OpInvalid extends Error {
  static get code() {
    return "ERR_ORIGINATOR_PROFILE_INVALID";
  }
  readonly code = OpInvalid.code;

  constructor(
    message: string,
    public result: OpDecodingFailure,
  ) {
    super(message);
  }
}

/**
 * Core Profile 未発見
 *
 * Core Profile が見つかりませんでした。次の原因で使用されます。
 *
 * - Core Profile が Originator Profile Set に含まれていない
 * - Core Profile の検証結果が見つからなかった
 */
export class CoreProfileNotFound<T extends OpVc> extends Error {
  static get code() {
    return "ERR_CORE_PROFILE_NOT_FOUND";
  }
  readonly code = CoreProfileNotFound.code;

  constructor(
    message: string,
    public result: UnverifiedJwtVc<T>,
  ) {
    super(message);
  }
}

/**
 * Originator Profile Set 検証失敗
 *
 * Originator Profile Set の検証に失敗しました。詳細は result プロパティに格納される OpVerifyFailed クラスインスタンスのメッセージを確認してください。
 **/
export class OpsVerifyFailed extends Error {
  static get code() {
    return "ERR_ORIGINATOR_PROFILE_SET_VERIFY_FAILED";
  }
  readonly code = OpsVerifyFailed.code;

  constructor(
    message: string,
    public result: OpsVerificationFailure,
  ) {
    super(message);
  }
}

/**
 * Originator Profile 検証失敗
 *
 * Originator Profile の検証に失敗しました。次の原因で使用されます。
 *
 * - Core Profile の検証に失敗した
 * - Profile Annotation の検証に失敗した
 * - Web Media Profile の検証に失敗した
 *
 * ここでの検証の失敗とは、次の原因を含みます。
 *
 * - 復号に失敗した
 * - Core Profile の検証結果が見つからなかった
 * - Profile Annotation 発行者の Core Profile が見つからなかった
 * - Web Media Profile 発行者の Core Profile が見つからなかった
 * - 署名の検証に失敗した
 **/
export class OpVerifyFailed extends Error {
  static get code() {
    return "ERR_ORIGINATOR_PROFILE_VERIFY_FAILED";
  }
  readonly code = OpVerifyFailed.code;

  constructor(
    message: string,
    public result: OpVerificationFailure,
  ) {
    super(message);
  }
}

/**
 * 証明書の有効期限エラー
 *
 * 証明書の有効期限チェックに失敗しました。次の原因で使用されます。
 *
 * - 証明書の有効期限が開始していない (validFrom より前)
 * - 証明書の有効期限が切れている (validUntil より後)
 *
 * なお、validFrom と validUntil はオプショナルフィールドのため、
 * 片方のみが指定されている場合もあります。
 **/
export class CertificateExpired<T extends OpVc> extends Error {
  static get code() {
    return "ERR_CERTIFICATE_EXPIRED";
  }
  readonly code = CertificateExpired.code;

  constructor(
    message: string,
    public result: VerifiedJwtVc<T>,
  ) {
    super(message);
  }
}
