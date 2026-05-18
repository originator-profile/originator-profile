import { useParams } from "react-router";
import useSWR from "swr";
import { fetchVerificationResult } from "./messaging";
import { LinkVerificationResult } from "./types";

const VERIFICATION_KEY = "link_verification";

export function useLinkVerification() {
  const params = useParams<{ tabId: string }>();
  const tabId = Number(params.tabId);

  const { data } = useSWR<LinkVerificationResult, Error>(
    [VERIFICATION_KEY, tabId],
    ([, id]: [string, number]) =>
      fetchVerificationResult(id).catch(() => ({ status: "none" })),
    {
      refreshInterval: (data) => (!data || data.status === "none" ? 500 : 0),
    },
  );

  return data;
}
