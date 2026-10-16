(function () {
  "use strict";

  const STAGE_LABELS = {
    reachability: "CAサーバーへの接続",
    authentication: "認証情報",
  };
  const STATUS_LABELS = {
    ok: "OK",
    ng: "NG",
    unverified: "未確認",
  };
  // 接続確認 (10秒) + OIDC トークン更新 (最大60秒) + 認証確認 (10秒) より長くする。
  const TIMEOUT_MS = 90000;

  function start() {
    const config = window.profileCaDiagnostics || {};
    const button = document.getElementById("profile-ca-diagnostics-check");
    const status = document.getElementById("profile-ca-diagnostics-status");
    const form = document.getElementById("profile-ca-settings");

    if (!button || !status) {
      return;
    }

    let edited = false;
    form?.addEventListener("input", function () {
      edited = true;
    });

    function show(state, nodes) {
      status.className = `notice notice-${state} inline`;
      status.replaceChildren(...nodes);
    }

    function paragraph(text) {
      const element = document.createElement("p");
      element.textContent = text;
      return element;
    }

    function showResult(data) {
      const list = document.createElement("ul");
      for (const [key, stage] of Object.entries(data.stages || {})) {
        const item = document.createElement("li");
        const label = document.createElement("strong");
        label.textContent = `${STAGE_LABELS[key] || key}：${STATUS_LABELS[stage.status] || stage.status}`;
        item.append(label, ` ${stage.message}`);
        list.append(item);
      }
      const nodes = [list];
      if (edited) {
        nodes.unshift(
          paragraph(
            "保存されていない変更があります。この結果は保存済みの設定で確認したものです。",
          ),
        );
      }
      show(data.state || "warning", nodes);
    }

    button.addEventListener("click", async function () {
      button.disabled = true;
      status.setAttribute("aria-busy", "true");
      show("info", [paragraph("確認中です…")]);

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
      try {
        const response = await fetch(config.ajaxUrl, {
          method: "POST",
          credentials: "same-origin",
          signal: controller.signal,
          body: new URLSearchParams({
            action: "profile_ca_diagnostics",
            nonce: config.nonce,
          }),
        });
        const payload = await response.json();
        if (!payload.success) {
          show("error", [
            paragraph(payload.data?.message || "確認できませんでした。"),
          ]);
          return;
        }
        showResult(payload.data);
      } catch {
        show("error", [
          paragraph(
            "確認結果を取得できませんでした。時間を置いてもう一度お試しください。",
          ),
        ]);
      } finally {
        clearTimeout(timer);
        button.disabled = false;
        status.setAttribute("aria-busy", "false");
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
