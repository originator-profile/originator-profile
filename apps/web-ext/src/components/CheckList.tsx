import { Icon } from "@iconify/react";
import { stringifyWithError } from "@originator-profile/core";
import { _, ExternalLink } from "@originator-profile/ui";
import {
  CasVerificationFailure,
  CasVerifyFailed,
  DecodedOp,
  OpDecodingFailure,
  OpsDecodingFailure,
  OpsInvalid,
  OpsVerificationFailure,
  OpsVerificationResult,
  OpsVerifyFailed,
  OpVerificationFailure,
  SiteProfileInvalid,
  SiteProfileVerifyFailed,
  SpVerificationResult,
  VerifiedCas,
  VerifiedOp,
  VerifiedOps,
  VerifiedSp,
} from "@originator-profile/verify";
import JsonView from "@uiw/react-json-view";
import React from "react";
import { SupportedVerifiedCas } from "./credentials";

interface CodedError extends Error {
  code: string;
}

type DetailItemProps = {
  label: string;
  icon: "check" | "cancel" | "null";
  children: React.ReactNode;
  className?: string;
};

function isCodedError(error: unknown): error is CodedError {
  return (
    error instanceof Error && typeof (error as CodedError).code === "string"
  );
}

function findError(codedErrors: CodedError[], codes: string[]) {
  return codedErrors.find((error) => codes.includes(error.code));
}

function DisplayStatus({
  label,
  icon,
}: {
  label: string;
  icon: "check" | "cancel" | "null";
}) {
  const iconMap = {
    check: { icon: "ic:round-check", color: "text-success" },
    cancel: { icon: "ic:round-cancel", color: "text-danger" },
    null: { icon: "ic:round-warning", color: "text-caution" },
  } as const;

  const { icon: iconName, color } = iconMap[icon];

  return (
    <summary className="flex items-center text-base cursor-pointer">
      <Icon
        icon="solar:alt-arrow-right-bold"
        className="size-5 transition-transform icon"
      />
      <Icon icon={iconName} className={`size-5 ml-1 ${color}`} />
      <span className="ml-1">{label}</span>
    </summary>
  );
}

function DisplayResults({
  code,
  message,
  payload,
  showPayload = true,
  className,
}: {
  code?: string;
  message?: string;
  payload: unknown;
  showPayload?: boolean;
  className?: string;
}) {
  const safeValue = (() => {
    try {
      return JSON.parse(stringifyWithError(payload));
    } catch {
      return { error: "Failed to serialize payload" };
    }
  })();

  return (
    <div className={className}>
      {code && (
        <div className="text-gray-700 mb-1">
          <p className="font-bold mb-1">Code</p>
          <p>
            <ExternalLink
              href={`https://docs.originator-profile.org/error-reference/${code}/`}
            >
              {code}
            </ExternalLink>
          </p>
        </div>
      )}
      {message && (
        <div className="text-gray-700 mb-1">
          <p className="font-bold mb-1">Message</p>
          <p>{message}</p>
        </div>
      )}
      {showPayload ? (
        <div className="text-gray-700 mb-1">
          <p className="font-bold mb-1">payload</p>
          <pre className="overflow-auto">
            <JsonView value={safeValue} collapsed={true} />
          </pre>
        </div>
      ) : (
        <div className="mb-2" />
      )}
    </div>
  );
}

function DetailItem({ label, icon, children, className }: DetailItemProps) {
  return (
    <details className={`[&[open]>summary>.icon]:rotate-90 ${className ?? ""}`}>
      <DisplayStatus label={label} icon={icon} />
      {children}
    </details>
  );
}

// value がエラーかどうかを判定し、チェック or キャンセルのアイコンと内容を表示するコンポーネントです。
function ResultItem({
  label,
  value,
  showPayload = true,
  children,
  className,
}: {
  label: string;
  value: unknown;
  showPayload?: boolean;
  children?: React.ReactNode;
  className?: string;
}) {
  const isCodeError = isCodedError(value);
  const isError = value instanceof Error;

  return (
    <DetailItem
      label={label}
      icon={isError ? "cancel" : "check"}
      className={className}
    >
      {isCodeError ? (
        <DisplayResults
          code={value.code}
          message={value.message}
          payload={value}
          showPayload={showPayload}
          className="ml-7"
        />
      ) : (
        <DisplayResults
          payload={value}
          showPayload={showPayload}
          className="ml-7"
        />
      )}
      {children}
    </DetailItem>
  );
}

function SitesCheck({ siteProfile }: { siteProfile: SpVerificationResult }) {
  const sites =
    (siteProfile instanceof Error
      ? siteProfile.result?.sites
      : siteProfile.sites) ?? [];

  // Website Profile は配列ですが、空配列はエラー扱いされない仕様です。
  // OPS にエラーがある場合など Website Profile が検証されず空配列となる可能性があります。
  // そのため、空配列の場合は異常の可能性を示すために警告マークを表示します。
  return (
    <div className="ml-4">
      {sites.length > 0 ? (
        sites.map((s, index) => (
          <ResultItem
            key={index}
            label={`Website Profile #${index}`}
            value={s}
            className="mb-2"
          />
        ))
      ) : (
        <DetailItem label="Website Profile" icon="null" className="mb-2">
          <DisplayResults payload={sites} className="ml-7" />
        </DetailItem>
      )}
    </div>
  );
}

function DisplayOriginators({
  op,
}: {
  op: OpVerificationFailure | OpDecodingFailure | VerifiedOp | DecodedOp;
}) {
  return (
    <div className="ml-7">
      <ResultItem label={"Core Profile"} value={op.core} className="mb-2" />
      {op.annotations?.map(
        // annotation が存在しなければ表示しません。
        (annotation, index) => (
          <ResultItem
            key={index}
            label={`Profile Annotation #${index}`}
            value={annotation}
            className="mb-2"
          />
        ),
      )}
      {op.media?.map(
        // media が存在しなければ表示しません。
        (media, index) => (
          <ResultItem
            key={index}
            label={`Web Media Profile #${index}`}
            value={media}
            className="mb-2"
          />
        ),
      )}
    </div>
  );
}

function OriginatorsCheckList({
  originators,
}: {
  originators: OpsVerificationFailure | OpsDecodingFailure | VerifiedOps;
}) {
  return (
    <div className="ml-7">
      {originators.map((op, index) => {
        const isError = op instanceof Error;
        return (
          <ResultItem
            key={index}
            label={`Originator Profile #${index}`}
            value={op}
            showPayload={false}
            className="mb-2"
          >
            <DisplayOriginators op={isError ? op.result : op} />
          </ResultItem>
        );
      })}
    </div>
  );
}

function OriginatorProfileSetCheck({
  originators,
}: {
  originators: OpsVerificationResult | CodedError;
}) {
  const isError = originators instanceof Error;
  const isOpsError =
    originators instanceof OpsInvalid || originators instanceof OpsVerifyFailed;
  const listValue = isOpsError
    ? originators.result
    : !isError
      ? originators
      : undefined;

  return (
    <ResultItem
      label="Originator Profile Set"
      value={originators}
      showPayload={false}
      className="pl-4 mb-2"
    >
      {listValue && <OriginatorsCheckList originators={listValue} />}
    </ResultItem>
  );
}

function SiteProfileCheck({
  siteProfile,
}: {
  siteProfile: CodedError | VerifiedSp;
}) {
  const isError = siteProfile instanceof Error;
  const isSiteError =
    siteProfile instanceof SiteProfileInvalid ||
    siteProfile instanceof SiteProfileVerifyFailed;
  const isFetchError = isError && !isSiteError;
  const originatorValue = isSiteError
    ? siteProfile.result.originators
    : !isError
      ? siteProfile.originators
      : undefined;

  return (
    <ResultItem
      label="Site Profile"
      value={siteProfile}
      showPayload={isFetchError}
      className="pl-4 mb-2"
    >
      {originatorValue && (
        <OriginatorProfileSetCheck originators={originatorValue} />
      )}
      {!isFetchError && <SitesCheck siteProfile={siteProfile} />}
    </ResultItem>
  );
}

function ContentAttestationCheck({
  cas,
}: {
  cas: CasVerificationFailure | VerifiedCas;
}) {
  return (
    <>
      {cas.map((ca, index) => {
        return (
          <ResultItem
            key={index}
            label={`Content Attestation #${index}`}
            value={ca.attestation}
            className="pl-7 mb-2"
          />
        );
      })}
    </>
  );
}

function ContentAttestationSetCheck({
  cas,
}: {
  cas: CodedError | VerifiedCas;
}) {
  const isError = cas instanceof Error;
  const isVerifyFailed = cas instanceof CasVerifyFailed;

  return (
    <ResultItem
      label="Content Attestation Set"
      value={cas}
      showPayload={false}
      className="pl-4 mb-2"
    >
      {isVerifyFailed && <ContentAttestationCheck cas={cas.result} />}
      {!isError && cas.length > 0 && <ContentAttestationCheck cas={cas} />}
    </ResultItem>
  );
}

function DisplayOtherErrors({ errors }: { errors: Error[] }) {
  return (
    <div className="pl-4">
      <h2 className="mt-4 mb-4 text-sm font-bold text-gray-700">
        {_("OtherErrors")}
      </h2>
      {errors.map((error, index) => (
        <DisplayResults key={index} payload={error} className="pl-2 mb-2" />
      ))}
    </div>
  );
}

/**
 * SP / OPS / CAS の検証結果をチェックリストとして表示するコンポーネント
 *
 * 検証済みの SP / OPS / CAS オブジェクトと、関連するErrorオブジェクトの配列を受け取り、
 * 各項目がエラーかどうかを判定したうえでチェックリスト形式で表示します。
 *
 * @param sp - VerifiedSp | undefined
 *   検証済みの SP
 * @param ops - VerifiedOps | undefined
 *   検証済みの OPS
 * @param cas - SupportedVerifiedCas | undefined
 *   検証済みの CAS
 * @param errors - Error[]
 *   各項目に対応するエラーオブジェクトの配列
 * @remarks
 * - エラーがない項目にはチェックマークを、エラーがある項目にはキャンセルマークを表示します。
 * - より細かい階層のデータが存在する場合は、入れ子構造のチェックリストとして表示します。
 * - `undefined` や空配列が渡された場合は、警告マークを表示します。
 * - 警告マークの「直接的なエラーではないが、異常の可能性がある状態」を示すために使用しています。
 *
 */
function CheckList({
  sp,
  ops,
  cas,
  errors,
}: {
  sp: VerifiedSp | undefined;
  ops: VerifiedOps | undefined;
  cas: SupportedVerifiedCas | undefined;
  errors: Error[];
}) {
  const codedErrors = errors.filter(isCodedError);
  const nonCodedErrors = errors.filter((e) => !isCodedError(e));

  const spError = findError(codedErrors, [
    "ERR_SITE_PROFILE_FETCH_INVALID",
    "ERR_SITE_PROFILE_FETCH_FAILED",
    "ERR_SITE_PROFILE_INVALID",
    "ERR_SITE_PROFILE_VERIFY_FAILED",
  ]);

  const siteProfile = spError ?? sp;

  const opsError = findError(codedErrors, [
    "ERR_ORIGINATOR_PROFILE_SET_INVALID",
    "ERR_ORIGINATOR_PROFILE_SET_VERIFY_FAILED",
    "ERR_FETCH_CREDENTIALS_MESSAGING_FAILED",
  ]);

  const originatorProfileSet = opsError ?? ops;

  const casError = findError(codedErrors, [
    "ERR_CONTENT_ATTESTATION_SET_VERIFY_FAILED",
  ]);

  const contentAttestationSet = casError ?? cas;
  // 検証済みの CAS は配列として渡されますが、空配列はエラー扱いされない仕様です。
  // そのため、空配列であることを明示的に判定して扱いを分岐します。
  const isEmptyVerifiedCas =
    Array.isArray(contentAttestationSet) && contentAttestationSet.length === 0;

  return (
    <>
      {siteProfile ? (
        <SiteProfileCheck siteProfile={siteProfile} />
      ) : (
        <DetailItem label="Site Profile" icon="null" className="pl-4 mb-2">
          <DisplayResults payload={sp} className="ml-7" />
        </DetailItem>
      )}
      {originatorProfileSet ? (
        <OriginatorProfileSetCheck originators={originatorProfileSet} />
      ) : (
        <DetailItem
          label="Originator Profile Set"
          icon="null"
          className="pl-4 mb-2"
        >
          <DisplayResults payload={ops} className="ml-7" />
        </DetailItem>
      )}
      {contentAttestationSet && !isEmptyVerifiedCas ? (
        <ContentAttestationSetCheck cas={contentAttestationSet} />
      ) : (
        <DetailItem
          label="Content Attestation Set"
          icon="null"
          className="pl-4 mb-2"
        >
          <DisplayResults payload={cas} className="ml-7" />
        </DetailItem>
      )}
      {nonCodedErrors.length !== 0 && (
        <DisplayOtherErrors errors={nonCodedErrors} />
      )}
    </>
  );
}

export default CheckList;
