import type { Jwk } from "@originator-profile/model";

/**
 * 検証中に検出された問題
 *
 * @see {@link https://www.w3.org/TR/vc-data-model-2.0/#problem-details}
 */
export type ProblemDetails = {
  /** 問題の種類を識別する URL */
  type: string;
  /** 短い説明 */
  title: string;
  /** この発生に固有の説明 */
  detail?: string;
  /** 問題を検出した位置を指す JSONPath。例: `$.originators[0].annotations[1]` */
  pointer?: string;
};

/**
 * VC ごとの securing mechanism の検証結果
 *
 * 復号したペイロードは {@link VerificationResult.outcome} が階層で保持し、
 * securing mechanism に由来する情報と検証の成否はこちらが持つ。
 * 対応は `pointer` で取る。
 */
export type SecuringResult = {
  /** 対応する {@link VerificationResult.outcome} 内の位置を指す JSONPath */
  pointer: string;
  /** 検証を通過したか */
  status: boolean;
  /** 保護された表現。JWT VC では JWT 文字列 */
  source?: string;
  /** メディアタイプ */
  mediaType?: string;
  /** 暗号アルゴリズム */
  algorithm?: string;
  /** 発行日時 */
  issuedAt?: Date;
  /** 有効期限 */
  expiredAt?: Date;
  /** 検証に用いた鍵 */
  verificationKey?: Jwk;
  /** 検証鍵の保有者 */
  controller?: string;
};

/**
 * 検証結果
 *
 * 階層を持つのは `outcome` だけで、securing mechanism の情報と検出した問題は
 * いずれも JSONPath で `outcome` 内の位置を指すフラットなリストとして持つ。
 * Error クラスを含まないため、メッセージ境界を跨いでも判定が変わらない。
 *
 * @see {@link https://www.w3.org/TR/vc-data-model-2.0/#verification}
 */
export type VerificationResult<T> =
  | {
      /** 検証を通過したか */
      status: true;
      /** 復号したペイロードの階層 */
      outcome: T;
      /** VC ごとの securing mechanism の検証結果 */
      securingResults: SecuringResult[];
      /** 無効性を意味しない通知 */
      warnings: ProblemDetails[];
      /** システムの正常な動作記録 */
      info: ProblemDetails[];
      /** 検証失敗の理由 */
      errors: ProblemDetails[];
    }
  | {
      status: false;
      outcome?: T;
      securingResults: SecuringResult[];
      warnings: ProblemDetails[];
      info: ProblemDetails[];
      errors: ProblemDetails[];
    };
