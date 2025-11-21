import { _ } from "@originator-profile/ui";
import JsonView from "@uiw/react-json-view";
import {
  CaInvalid,
  CasVerificationFailure,
  CasVerifyFailed,
  CaVerifyFailed,
  CoreProfileNotFound,
  OpsDecodingFailure,
  OpsInvalid,
  OpsVerificationFailure,
  OpsVerifyFailed,
  SiteProfileInvalid,
  SiteProfileVerifyFailed,
} from "@originator-profile/verify";
import { Icon } from "@iconify/react";
import { stringifyWithError } from "@originator-profile/core";
import { SupportedCa } from "./credentials";
import { ContentAttestation } from "@originator-profile/model";

interface CodedError extends Error {
  code: string;
}

function isCodedError(error: Error): error is CodedError {
  return typeof (error as CodedError).code === "string";
}

function DisplayCheck({ label }: { label: string }) {
  return (
    <div className="text-sm flex items-center mb-2">
      <Icon icon="ic:round-check" className="size-5 text-success" />
      <div>{label}</div>
    </div>
  );
}

function DisplayCancel({ label }: { label: string }) {
  return (
    <div className="text-sm flex items-center mb-2">
      <Icon icon="ic:round-cancel" className="size-5 text-danger" />
      <div>{label}</div>
    </div>
  );
}

function CredentialCheck({
  error,
}: {
  error: SiteProfileInvalid | SiteProfileVerifyFailed;
}) {
  return (
    <>
      <DisplayCheck label={"Core Profile"} />
      <DisplayCheck label={"Profile Annotation"} />
      <DisplayCheck label={"Web Media Profile"} />
      {error.result.credential instanceof Error ? (
        <DisplayCancel label={"Website Profile"} />
      ) : (
        <DisplayCheck label={"Website Profile"} />
      )}
    </>
  );
}

function OriginatorsCheck({
  errors,
  label,
}: {
  errors: Error[];
  label: string;
}) {
  const cpNotFound = errors.filter(
    (result) => result instanceof CoreProfileNotFound,
  );

  if (cpNotFound.length > 0) return null;

  return (
    <>
      {errors.length > 0 ? (
        <DisplayCancel label={label} />
      ) : (
        <DisplayCheck label={label} />
      )}
    </>
  );
}

function OriginatorsCheckList({
  error,
}: {
  error: OpsVerificationFailure | OpsDecodingFailure;
}) {
  const cpErrors = error
    .filter((error) => error instanceof Error)
    .map((error) => error.result.core)
    .filter((result) => result instanceof Error);
  const paErrors = error
    .filter((error) => error instanceof Error)
    .map((error) => error.result.annotations)
    .flat()
    .filter((result) => result instanceof Error);
  const wmpErrors = error
    .filter((error) => error instanceof Error)
    .map((error) => error.result.media)
    .filter((result) => result instanceof Error);

  return (
    <>
      <OriginatorsCheck errors={cpErrors} label="Core Profile" />
      <OriginatorsCheck errors={paErrors} label="Profile Annotation" />
      <OriginatorsCheck errors={wmpErrors} label="Web Media Profile" />
    </>
  );
}

function ContentAttestationErrorDetails({
  attestation,
  index,
}: {
  attestation:
    | CaInvalid
    | CaVerifyFailed
    | CoreProfileNotFound<ContentAttestation>;
  index: number;
}) {
  let content;
  if ("doc" in attestation.result) {
    const ca = attestation.result.doc as SupportedCa;
    content = (
      <DisplayCancel
        label={`CA ${index} ${
          (ca.credentialSubject.type === "Article"
            ? ca.credentialSubject.headline
            : ca.credentialSubject.name) ?? "Unrecognized Content Name"
        }`}
      />
    );
  } else {
    content = <DisplayCancel label={`CA ${index} Unrecognized Content`} />;
  }
  return (
    <>
      {content}
      <details className="text-gray-700 pl-2 mb-2">
        <summary>Error at element(s): {index}</summary>
        <div className="relative my-4">
          <p>{`Code : ${attestation.code}`}</p>
          <p>{`Message : ${attestation.message}`}</p>
          <pre className="overflow-auto">
            <JsonView
              value={JSON.parse(stringifyWithError(attestation.result))}
            />
          </pre>
        </div>
      </details>
    </>
  );
}

function ContentAttestationCheckList({
  errors,
}: {
  errors: CasVerificationFailure;
}) {
  return (
    <>
      {errors.map((error, index) => {
        if (
          error.attestation instanceof CaInvalid ||
          error.attestation instanceof CaVerifyFailed ||
          error.attestation instanceof CoreProfileNotFound
        ) {
          const attestation = error.attestation;
          return (
            <ContentAttestationErrorDetails
              attestation={attestation}
              index={index}
              key={index}
            />
          );
        } else {
          const ca = error.attestation.doc as SupportedCa;
          return (
            <DisplayCheck
              label={`CA ${index} ${
                (ca.credentialSubject.type === "Article"
                  ? ca.credentialSubject.headline
                  : ca.credentialSubject.name) ?? "Unrecognized Content Name"
              }`}
              key={index}
            />
          );
        }
      })}
    </>
  );
}

function ErrorDetailCheck({ error }: { error: CodedError }) {
  return (
    <ul className="ml-7">
      <li className="text-xs mb-1">{`Code : ${error.code}`}</li>
      <li className="text-xs mb-1">{`Message : ${error.message}`}</li>
      {error instanceof OpsInvalid && (
        <OriginatorsCheckList error={error.result} />
      )}
      {error instanceof SiteProfileInvalid && (
        <>
          {error.result.originators instanceof OpsInvalid ? (
            <OriginatorsCheckList error={error.result.originators.result} />
          ) : (
            <CredentialCheck error={error} />
          )}
        </>
      )}
      {error instanceof SiteProfileVerifyFailed && (
        <>
          {error.result.originators instanceof OpsVerifyFailed ? (
            <OriginatorsCheckList error={error.result.originators.result} />
          ) : (
            <CredentialCheck error={error} />
          )}
        </>
      )}
      {error instanceof OpsVerifyFailed && (
        <OriginatorsCheckList error={error.result} />
      )}
      {error instanceof CasVerifyFailed && (
        <ContentAttestationCheckList errors={error.result} />
      )}
      <details className="text-gray-700 mb-5">
        <summary>{_("ErrorCheckList_ErrorDetails")}</summary>
        <div className="relative my-4">
          <pre className="overflow-auto">
            <JsonView value={JSON.parse(stringifyWithError(error))} />
          </pre>
        </div>
      </details>
    </ul>
  );
}

function CodedErrorCheck({
  errors,
  label,
}: {
  errors: Error[];
  label: string;
}) {
  const codedErrors = errors.filter(isCodedError);
  if (codedErrors.length === 0) {
    return (
      <div className="pl-4 mb-5 text-base flex items-center">
        <Icon icon="ic:round-check" className="size-5 text-success" />
        <span className="ml-2">{label}</span>
      </div>
    );
  }
  return (
    <div className="pl-4">
      <div className="text-base flex items-center">
        <Icon icon="ic:round-cancel" className="size-5 text-danger" />
        <span className="ml-2">{label}</span>
      </div>
      {codedErrors.map((error, index) => (
        <ErrorDetailCheck key={error.code ?? index} error={error} />
      ))}
    </div>
  );
}

/**
 * エラーをチェックリスト状に表示するコンポーネント
 *
 * Errorオブジェクトの配列を受け取り、エラーコードに応じてSP/OPS/CASのエラーをチェックリスト状に表示します。
 * SP/OPS/CASそれぞれでエラーの詳細内容を表示します。
 *
 * @param errors - Errorオブジェクトの配列
 * @remarks
 * 1. 対象となるデータ表現に対応するエラーが見つからなければチェックマークを表示します。
 * 2. エラーのうち、resultメンバーからより小さな粒度のエラーが取得できる場合には、それに合わせた入れ子のチェックリストを表示します。
 * 3. 未知のエラーは無視します。
 *
 */
function ErrorCheckList({ errors }: { errors: Error[] }) {
  const codedErrors = errors.filter(isCodedError);
  const hasOtherErrors = errors.length !== codedErrors.length;

  if (hasOtherErrors) return null;

  const spErrors = codedErrors.filter(
    (error) =>
      error.code === "ERR_SITE_PROFILE_FETCH_INVALID" ||
      error.code === "ERR_SITE_PROFILE_FETCH_FAILED" ||
      error.code === "ERR_SITE_PROFILE_INVALID" ||
      error.code === "ERR_SITE_PROFILE_VERIFY_FAILED",
  );
  const opsErrors = codedErrors.filter(
    (error) =>
      error.code === "ERR_ORIGINATOR_PROFILE_SET_INVALID" ||
      error.code === "ERR_ORIGINATOR_PROFILE_SET_VERIFY_FAILED" ||
      error.code === "ERR_FETCH_CREDENTIALS_MESSAGING_FAILED",
  );
  const casErrors = codedErrors.filter(
    (error) => error.code === "ERR_CONTENT_ATTESTATION_SET_VERIFY_FAILED",
  );

  return (
    <>
      <CodedErrorCheck label="Site Profile" errors={spErrors} />
      <CodedErrorCheck label="Originator Profile Set" errors={opsErrors} />
      {opsErrors.length === 0 && casErrors.length !== 0 && (
        <CodedErrorCheck label="Content Attestation Set" errors={casErrors} />
      )}
    </>
  );
}

export default ErrorCheckList;
