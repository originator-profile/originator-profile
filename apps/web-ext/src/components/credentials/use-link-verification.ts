import { useParams } from "react-router";
import useSWRImmutable from "swr/immutable";
import { fetchVerificationResult } from "./messaging";
import { LinkVerificationResult } from "./types";

const VERIFICATION_KEY = "link_verification";

export function useLinkVerification() {
  const params = useParams<{ tabId: string }>();
  const tabId = Number(params.tabId);

  const { data } = useSWRImmutable<LinkVerificationResult, Error>(
    [VERIFICATION_KEY, tabId],
    ([, id]: [string, number]) =>
      fetchVerificationResult(id).catch(
        () => ({ status: "none" }) as LinkVerificationResult,
      ),
  );

  return data;
}
