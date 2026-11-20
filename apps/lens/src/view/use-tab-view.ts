import { useMemo } from "react";
import { useParams } from "react-router";
import { useSubscribedTabVerification } from "../components/activeTab";
import { tabViewOf } from "./tab-view";

/**
 * 表示中のタブの表示を得る (要 `tab/:tabId` ルート)
 */
export function useTabView() {
  const params = useParams<{ tabId: string }>();
  const tabId = Number(params.tabId);
  const subscribed = useSubscribedTabVerification(tabId);
  const view = useMemo(() => tabViewOf(tabId, subscribed), [tabId, subscribed]);
  return view;
}
