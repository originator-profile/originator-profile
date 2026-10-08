import { serializeIfError } from "@originator-profile/core";
import {
  fetchCredentials,
  fetchOpMeta,
  fetchSiteProfile,
} from "@originator-profile/presentation";
import {
  verifyIntegrity,
  type InputDependency,
} from "@originator-profile/verify";
import type { FetchCredentialsMessageResponse } from "../credentials/types";
import { verificationMessenger } from "./events";
import { createTargetWatcher } from "./target-watcher";

const CREDENTIAL_SCRIPT_SELECTOR = [
  'script[type="application/cas+json"]',
  'script[type="application/ops+json"]',
].join(",");

const containsCredentialScript = (node: Node): boolean =>
  node instanceof Element &&
  (node.matches(CREDENTIAL_SCRIPT_SELECTOR) ||
    node.querySelector(CREDENTIAL_SCRIPT_SELECTOR) !== null);

/**
 * 入力依存対象が検証可能になる readiness
 *
 * NOTE: response は対象リソースの取得完了で検証可能になる。リソースを個別に
 * 追跡せず、Document の load (complete) まで待つことで近似する。
 */
const readinessOf = {
  response: "complete",
  "parsed-dom": "interactive",
  "rendered-result": "complete",
} as const satisfies Record<InputDependency, DocumentReadyState>;

const readinessOrder: DocumentReadyState[] = [
  "loading",
  "interactive",
  "complete",
];

function waitReadyState(state: DocumentReadyState): Promise<void> {
  const reached = () =>
    readinessOrder.indexOf(document.readyState) >=
    readinessOrder.indexOf(state);
  if (reached()) return Promise.resolve();
  return new Promise((resolve) => {
    const listener = () => {
      if (!reached()) return;
      document.removeEventListener("readystatechange", listener);
      resolve();
    };
    document.addEventListener("readystatechange", listener);
  });
}

/** 文書に設置されたクレデンシャルを取得する */
export async function fetchDocumentCredentials(): Promise<FetchCredentialsMessageResponse> {
  const { ops, cas } = await fetchCredentials(document);
  return {
    ops: serializeIfError(ops),
    cas: serializeIfError(cas),
    opMeta: fetchOpMeta(document),
    origin: window.origin,
    url: window.location.href,
  };
}

/**
 * 文書の検証を Service Worker に委ねる
 *
 * クレデンシャルの script 要素の挿入・削除を監視して Service Worker に通知し、
 * Service Worker からの取得・Target Integrity の計算の要求に応える。
 */
export function setupDocumentVerification() {
  // NOTE: Service Worker が受信できる状態になる前 (拡張機能の読み込み直後など) は
  // 問い合わせが失敗する。そのときは次に必要になったときに問い合わせ直す
  let registering: Promise<string | undefined> | undefined;
  const register = () => {
    registering ??= verificationMessenger
      .sendMessage("register", null)
      .catch((error: unknown) => {
        registering = undefined;
        throw error;
      });
    return registering;
  };
  void register().catch(() => {});

  /** NOTE: 送信先の指定はフレーム単位のため、別の文書に宛てた要求が届きうる */
  const accept = async (data: { documentId: string }) => {
    if (data.documentId !== (await register())) {
      throw new Error(`Message for another document: ${data.documentId}`);
    }
  };

  /** Service Worker に通知する。受信できなければ、検証を求められたときに通知し直す */
  const send = (message: () => Promise<unknown>) => {
    register()
      .then(message)
      .catch(() => {});
  };

  let started = false;
  let scheduled = false;
  let restored = false;
  let force = false;
  const notify = (options: { restored?: boolean; force?: boolean } = {}) => {
    restored ||= options.restored ?? false;
    force ||= options.force ?? false;
    if (!started || scheduled) return;
    scheduled = true;
    setTimeout(() => {
      const data = { restored, force };
      scheduled = false;
      restored = false;
      force = false;
      send(() => verificationMessenger.sendMessage("documentChanged", data));
    });
  };

  const targets = createTargetWatcher(() => {
    send(() => verificationMessenger.sendMessage("inputChanged", null));
  });
  /** 新しい検証が始まったら、その検証で計算した target から監視し直す */
  let rewatch = false;

  // NOTE: 構文解析中に挿入された CAS は、後続の OPS がまだ挿入されていない
  // ことがある。構文解析の完了 (interactive) を待ってから通知する。
  const start = () => {
    void waitReadyState("interactive").then(() => {
      started = true;
      notify();
    });
  };

  // NOTE: document.open() による内容の置き換えも、クレデンシャルの script 要素の
  // 削除と target の要素の削除としてここで検知する
  new MutationObserver((records) => {
    for (const { removedNodes } of records) targets.handleRemoved(removedNodes);
    const changed = records.some(
      ({ addedNodes, removedNodes }) =>
        [...addedNodes].some(containsCredentialScript) ||
        [...removedNodes].some(containsCredentialScript),
    );
    if (changed) notify();
  }).observe(document, { childList: true, subtree: true });

  // NOTE: ナビゲーションが開始される前に検証処理のためのネットワークアクセスを
  // 発生させてはならないため、プリレンダリング中の文書は有効化を待つ。
  if (document.prerendering) {
    document.addEventListener("prerenderingchange", start, { once: true });
  } else {
    start();
  }

  // bfcache から復元された場合、Content Script は再注入されないため改めて通知する
  window.addEventListener("pageshow", (event) => {
    if (event.persisted) notify({ restored: true });
  });

  verificationMessenger.onMessage("resync", async ({ data }) => {
    await accept(data);
    notify({ force: data.force });
  });

  verificationMessenger.onMessage(
    "fetchDocumentCredentials",
    async ({ data }) => {
      await accept(data);
      rewatch = true;
      return fetchDocumentCredentials();
    },
  );

  verificationMessenger.onMessage(
    "fetchDocumentSiteProfile",
    async ({ data }) => {
      await accept(data);
      return serializeIfError(await fetchSiteProfile(document));
    },
  );

  verificationMessenger.onMessage("awaitInputDependency", async ({ data }) => {
    await accept(data);
    return waitReadyState(readinessOf[data.dependency]);
  });

  verificationMessenger.onMessage(
    "verifyDocumentIntegrity",
    async ({ data }) => {
      await accept(data);
      if (rewatch) {
        rewatch = false;
        targets.reset();
      }
      targets.watch(data.content);
      return serializeIfError(await verifyIntegrity(data.content));
    },
  );
}
