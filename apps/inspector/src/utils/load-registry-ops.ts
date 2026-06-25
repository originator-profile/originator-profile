import type { OriginatorProfileSet } from "@originator-profile/model";

let cache: OriginatorProfileSet | undefined;

export async function loadRegistryOps(): Promise<OriginatorProfileSet> {
  if (cache !== undefined) return cache;
  const url = chrome.runtime.getURL("registry-ops.json");
  const response = await fetch(url);
  cache = (await response.json()) as OriginatorProfileSet;
  return cache;
}
