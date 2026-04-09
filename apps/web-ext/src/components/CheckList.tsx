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
import get from "just-safe-get";
import React from "react";
import { twMerge } from "tailwind-merge";
import { SupportedVerifiedCas } from "./credentials";

interface CodedError extends Error {
  code: string;
}

type DetailItemProps = {
  label: React.ReactNode;
  testId?: string;
  icon: "check" | "cancel" | "null";
  isOpen?: boolean;
  children: React.ReactNode;
  className?: string;
};

type Period = {
  issuedAt: Date;
  expiredAt: Date;
};

function isCodedError(error: unknown): error is CodedError {
  return (
    error instanceof Error && typeof (error as CodedError).code === "string"
  );
}

function findError(codedErrors: CodedError[], codes: string[]) {
  return codedErrors.find((error) => codes.includes(error.code));
}

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function toStringDate(v: unknown): string | undefined {
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "string") return v;
  return undefined;
}

function getByPaths<T = unknown>(
  value: unknown,
  paths: (string | string[])[],
): T | undefined {
  if (!isObj(value)) return undefined;

  for (const path of paths) {
    const result = get(value, path);
    if (result !== undefined) return result as T;
  }

  return undefined;
}

function findIssuer(value: unknown): string | undefined {
  const raw = getByPaths(value, [
    ["doc", "issuer"],
    ["result", "doc", "issuer"],
  ]);
  return typeof raw === "string" ? raw : undefined;
}

function findMediaName(value: unknown): string | undefined {
  const raw = getByPaths(value, [["doc", "credentialSubject", "name"]]);
  return typeof raw === "string" ? raw : undefined;
}

function findIssuedAt(value: unknown): Date | undefined {
  const raw = getByPaths(value, [["issuedAt"], ["result", "issuedAt"]]);
  return raw instanceof Date ? raw : undefined;
}

function findExpiredAt(value: unknown): Date | undefined {
  const raw = getByPaths(value, [["expiredAt"], ["result", "expiredAt"]]);
  return raw instanceof Date ? raw : undefined;
}

function isExpiredSoon(expiredAt: Date | undefined, months = 1): boolean {
  if (!expiredAt) return false;

  const now = new Date();
  const threshold = new Date();
  threshold.setMonth(threshold.getMonth() + months);

  return expiredAt <= threshold && expiredAt >= now;
}

function getCommonPeriod(periods: Period[]): Period | undefined {
  if (periods.length === 0) return undefined;

  const start = new Date(
    Math.max(...periods.map((period) => period.issuedAt.getTime())),
  );

  const end = new Date(
    Math.min(...periods.map((period) => period.expiredAt.getTime())),
  );

  return start.getTime() <= end.getTime()
    ? { issuedAt: start, expiredAt: end }
    : undefined;
}

function extractPeriods(sources: unknown[]): Period[] {
  return sources.flatMap((source) => {
    const issuedAt = findIssuedAt(source);
    const expiredAt = findExpiredAt(source);
    return issuedAt && expiredAt ? [{ issuedAt, expiredAt }] : [];
  });
}

function MultipleValidity({
  period,
  className,
}: {
  period: Period;
  className?: string;
}) {
  return (
    <div className={twMerge("text-gray-700 mb-1", className)}>
      <p className="font-bold mb-1">
        {isExpiredSoon(period.expiredAt) ? (
          <span className="flex" title="The certificate is about to expire">
            Common Validity Period
            <Icon
              icon="ic:round-warning"
              className="size-4 ml-1 text-caution"
            />
          </span>
        ) : (
          "Common Validity Period"
        )}
      </p>
      <p>
        {toStringDate(period.issuedAt)} ～ {toStringDate(period.expiredAt)}
      </p>
    </div>
  );
}

function opToSources(
  op: OpVerificationFailure | OpDecodingFailure | VerifiedOp | DecodedOp,
): unknown[] {
  return [op.core, ...(op.annotations ?? []), ...(op.media ?? [])];
}

function opsToSources(
  originators: OpsVerificationFailure | OpsDecodingFailure | VerifiedOps,
): unknown[] {
  const list = originators.map((op) => (op instanceof Error ? op.result : op));
  return list.flatMap(opToSources);
}

function spToSources(sp: SpVerificationResult): unknown[] {
  const originators =
    sp instanceof Error ? sp.result.originators : sp.originators;
  const wsp = sp instanceof Error ? sp.result.sites : sp.sites;

  const opSources =
    originators instanceof Error
      ? opsToSources(originators.result)
      : opsToSources(originators);

  return [...opSources, ...wsp];
}

function casToSources(cas: CasVerificationFailure | VerifiedCas): unknown[] {
  return cas.map((ca) => ca.attestation);
}

function analyzeValidity<T>(value: T, toSources: (value: T) => unknown[]) {
  const sources = toSources(value);
  const periods = extractPeriods(sources);

  return {
    commonPeriod: getCommonPeriod(periods),
    shouldOpen: periods.some((p) => isExpiredSoon(p.expiredAt)),
  };
}

function DisplayStatus({
  label,
  testId,
  icon,
}: {
  label: React.ReactNode;
  testId?: string;
  icon: "check" | "cancel" | "null";
}) {
  const iconMap = {
    check: { icon: "ic:round-check", color: "text-success" },
    cancel: { icon: "ic:round-cancel", color: "text-danger" },
    null: { icon: "ic:round-warning", color: "text-caution" },
  } as const;

  const { icon: iconName, color } = iconMap[icon];

  return (
    <summary
      {...(testId ? { "data-testid": `result-${testId}` } : {})}
      className="flex items-center text-base cursor-pointer"
    >
      <Icon
        icon="solar:alt-arrow-right-bold"
        className="size-5 transition-transform icon"
      />
      <Icon
        data-testid={`status-${icon}`}
        icon={iconName}
        className={twMerge("size-5 ml-1", color)}
      />
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
  const issuer = findIssuer(payload);
  const issuedAt = findIssuedAt(payload);
  const expiredAt = findExpiredAt(payload);
  const issuedAtStr = toStringDate(issuedAt);
  const expiredAtStr = toStringDate(expiredAt);

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
          <p className="whitespace-pre-wrap">{message}</p>
        </div>
      )}
      {issuer && (
        <div className="text-gray-700 mb-1">
          <p className="font-bold mb-1" data-testid="issuer">
            Issuer
          </p>
          <p>{issuer}</p>
        </div>
      )}
      {issuedAtStr && expiredAtStr && (
        <div className="text-gray-700 mb-1">
          <p className="font-bold mb-1" data-testid="validity-period">
            {isExpiredSoon(expiredAt) ? (
              <span className="flex" title="The certificate is about to expire">
                Validity Period
                <Icon
                  icon="ic:round-warning"
                  className="size-4 ml-1 text-caution"
                  data-testid="caution-validity-period"
                />
              </span>
            ) : (
              "Validity Period"
            )}
          </p>
          <p>
            {issuedAtStr} ～ {expiredAtStr}
          </p>
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

function DetailItem({
  label,
  testId,
  icon,
  isOpen = false,
  children,
  className,
}: DetailItemProps) {
  return (
    <details
      open={isOpen}
      className={twMerge("[&[open]>summary>.icon]:rotate-90", className)}
    >
      <DisplayStatus label={label} testId={testId} icon={icon} />
      {children}
    </details>
  );
}

// value がエラーかどうかを判定し、チェック or キャンセルのアイコンと内容を表示するコンポーネントです。
// デコード済みではあるが、未検証のものに対しては警告マークを表示します。
function ResultItem({
  label,
  testId,
  value,
  showPayload = true,
  isVerified = true,
  isOpen = false,
  children,
  className,
}: {
  label: React.ReactNode;
  testId?: string;
  value: unknown;
  showPayload?: boolean;
  isVerified?: boolean;
  isOpen?: boolean;
  children?: React.ReactNode;
  className?: string;
}) {
  const isCodeError = isCodedError(value);
  const isError = value instanceof Error;

  return (
    <DetailItem
      label={label}
      testId={testId}
      icon={isError ? "cancel" : isVerified ? "check" : "null"}
      isOpen={isOpen || isError || isExpiredSoon(findExpiredAt(value))}
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
  const { commonPeriod } = analyzeValidity(op, opToSources);
  return (
    <div className="ml-7">
      {commonPeriod && <MultipleValidity period={commonPeriod} />}
      <ResultItem
        label={"Core Profile"}
        testId="core-profile"
        value={op.core}
        isVerified={"verificationKey" in op.core}
        className="mb-2"
      />
      {op.annotations?.map(
        // annotation が存在しなければ表示しません。
        (annotation, index) => (
          <ResultItem
            key={index}
            testId="profile-annotation"
            label={`Profile Annotation #${index}`}
            value={annotation}
            isVerified={"verificationKey" in annotation}
            className="mb-2"
          />
        ),
      )}
      {op.media?.map(
        // media が存在しなければ表示しません。
        (media, index) => (
          <ResultItem
            key={index}
            testId="web-media-profile"
            label={`Web Media Profile #${index}`}
            value={media}
            isVerified={"verificationKey" in media}
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
  const { commonPeriod } = analyzeValidity(originators, opsToSources);
  return (
    <div className="ml-7">
      {commonPeriod && <MultipleValidity period={commonPeriod} />}
      {originators.map((op, index) => {
        const isError = op instanceof Error;
        const name = (isError ? op.result.media : op.media)?.flatMap(
          (media) => {
            const n = findMediaName(media);
            return n ? [n] : [];
          },
        );
        const { shouldOpen } = isError
          ? analyzeValidity(op.result, opToSources)
          : analyzeValidity(op, opToSources);
        return (
          <ResultItem
            key={index}
            testId={`originator-profile-${index}`}
            label={
              <span title={name?.join(",")}>
                {`Originator Profile #${index}`}
              </span>
            }
            value={op}
            showPayload={false}
            isOpen={shouldOpen}
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
  testId,
}: {
  originators: OpsVerificationResult | CodedError;
  testId?: string;
}) {
  const isError = originators instanceof Error;
  const isOpsError =
    originators instanceof OpsInvalid || originators instanceof OpsVerifyFailed;
  const listValue = isOpsError
    ? originators.result
    : !isError
      ? originators
      : undefined;
  const { shouldOpen } = listValue
    ? analyzeValidity(listValue, opsToSources)
    : { shouldOpen: undefined };

  return (
    <ResultItem
      label="Originator Profile Set"
      testId={testId}
      value={originators}
      showPayload={false}
      isOpen={shouldOpen}
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
  const { commonPeriod, shouldOpen } = !isFetchError
    ? analyzeValidity(siteProfile, spToSources)
    : { commonPeriod: undefined, shouldOpen: undefined };

  return (
    <ResultItem
      label="Site Profile"
      testId="site-profile"
      value={siteProfile}
      showPayload={isFetchError}
      isOpen={shouldOpen}
      className="pl-4 mb-2"
    >
      {commonPeriod && (
        <MultipleValidity period={commonPeriod} className="ml-7" />
      )}
      {originatorValue && (
        <OriginatorProfileSetCheck
          originators={originatorValue}
          testId="originator-profile-set"
        />
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
  const { commonPeriod } = analyzeValidity(cas, casToSources);
  return (
    <>
      {commonPeriod && (
        <MultipleValidity period={commonPeriod} className="ml-7" />
      )}
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
  const canAnalyzeCas = !isError && cas.length > 0;
  let shouldOpen;

  if (isVerifyFailed) {
    shouldOpen = analyzeValidity(cas.result, casToSources)?.shouldOpen;
  } else if (canAnalyzeCas) {
    shouldOpen = analyzeValidity(cas, casToSources)?.shouldOpen;
  }

  return (
    <ResultItem
      label="Content Attestation Set"
      testId="content-attestation-set"
      value={cas}
      showPayload={false}
      isOpen={shouldOpen}
      className="pl-4 mb-2"
    >
      {isVerifyFailed && <ContentAttestationCheck cas={cas.result} />}
      {canAnalyzeCas && <ContentAttestationCheck cas={cas} />}
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

/** SP / OPS / CAS の検証結果をチェックリスト形式で表示する */
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
        <DetailItem
          label="Site Profile"
          testId="site-profile"
          icon="null"
          className="pl-4 mb-2"
        >
          <DisplayResults payload={sp} className="ml-7" />
        </DetailItem>
      )}
      {originatorProfileSet ? (
        <OriginatorProfileSetCheck
          originators={originatorProfileSet}
          testId="originator-profile-set-top"
        />
      ) : (
        <DetailItem
          label="Originator Profile Set"
          testId="originator-profile-set-top"
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
          testId="content-attestation-set"
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
