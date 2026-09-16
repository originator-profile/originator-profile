(function () {
  "use strict";

  function start() {
    var config = window.profileCaBulk || {};
    var form = document.getElementById("profile-ca-bulk-form");

    if (!form) {
      return;
    }

    var elements = {
      postType: document.getElementById("profile-ca-bulk-post-type"),
      category: document.getElementById("profile-ca-bulk-category"),
      dateFrom: document.getElementById("profile-ca-bulk-date-from"),
      dateTo: document.getElementById("profile-ca-bulk-date-to"),
      mode: document.getElementById("profile-ca-bulk-mode"),
      reissueWarning: document.getElementById(
        "profile-ca-bulk-reissue-warning",
      ),
      reissueConfirmWrap: document.getElementById(
        "profile-ca-bulk-reissue-confirm-wrap",
      ),
      reissueConfirm: document.getElementById(
        "profile-ca-bulk-reissue-confirm",
      ),
      preview: document.getElementById("profile-ca-bulk-preview"),
      start: document.getElementById("profile-ca-bulk-start"),
      resume: document.getElementById("profile-ca-bulk-resume"),
      pause: document.getElementById("profile-ca-bulk-pause"),
      retry: document.getElementById("profile-ca-bulk-retry"),
      cancel: document.getElementById("profile-ca-bulk-cancel"),
      refresh: document.getElementById("profile-ca-bulk-refresh"),
      status: document.getElementById("profile-ca-bulk-status"),
      progress: document.getElementById("profile-ca-bulk-progress"),
      counts: document.getElementById("profile-ca-bulk-counts"),
      successCount: document.getElementById("profile-ca-bulk-success-count"),
      failedCount: document.getElementById("profile-ca-bulk-failed-count"),
      skippedCount: document.getElementById("profile-ca-bulk-skipped-count"),
      previewSection: document.getElementById(
        "profile-ca-bulk-preview-section",
      ),
      previewCount: document.getElementById("profile-ca-bulk-preview-count"),
      previewBody: document.getElementById("profile-ca-bulk-preview-body"),
      logBody: document.getElementById("profile-ca-bulk-log-body"),
    };
    var state = {
      job: null,
      requestInFlight: false,
      requestSequence: 0,
      latestRequest: 0,
      running: false,
      loopActive: false,
      cancelRequested: false,
      cancelSent: false,
    };

    function makeError(message, networkFailure) {
      var error = new Error(message);
      error.bulkRequestError = true;
      error.networkFailure = Boolean(networkFailure);
      return error;
    }

    function valueAsText(value) {
      if ("string" === typeof value || "number" === typeof value) {
        return String(value);
      }
      return "";
    }

    function formatCount(value) {
      var count = Number(value);
      if (!Number.isFinite(count)) {
        return "0";
      }
      return count.toLocaleString("ja-JP");
    }

    function clearNode(node) {
      while (node.firstChild) {
        node.removeChild(node.firstChild);
      }
    }

    function setStatus(message, type) {
      var paragraph = document.createElement("p");
      paragraph.textContent = valueAsText(message);
      clearNode(elements.status);
      elements.status.appendChild(paragraph);
      elements.status.classList.remove(
        "notice-error",
        "notice-success",
        "notice-warning",
        "notice-info",
      );
      elements.status.classList.add("notice-" + (type || "info"));
    }

    function safeHref(value) {
      var href = valueAsText(value).trim();
      if (/^https?:\/\//i.test(href)) {
        return href;
      }
      if (/^\/(?!\/)/.test(href)) {
        return href;
      }
      return "";
    }

    function appendCell(row, value) {
      var cell = document.createElement("td");
      cell.textContent = valueAsText(value);
      row.appendChild(cell);
      return cell;
    }

    function appendLogRow(body, entry) {
      var row = document.createElement("tr");
      appendCell(row, entry && entry.id);

      var titleCell = document.createElement("td");
      var title = valueAsText(entry && entry.title) || "(無題)";
      var href = safeHref(entry && entry.url);
      if (href) {
        var link = document.createElement("a");
        link.href = href;
        link.textContent = title;
        titleCell.appendChild(link);
      } else {
        titleCell.textContent = title;
      }
      row.appendChild(titleCell);

      appendCell(row, statusLabel(entry && entry.status));
      appendCell(row, entry && entry.message);
      body.appendChild(row);
    }

    function statusLabel(status) {
      var labels = {
        ready: "発行対象",
        success: "成功",
        failed: "失敗",
        skipped: "スキップ",
      };
      var key = valueAsText(status);
      return labels[key] || key;
    }

    function renderLog(log) {
      clearNode(elements.logBody);
      if (!Array.isArray(log) || 0 === log.length) {
        return;
      }

      log.forEach(function (entry) {
        appendLogRow(elements.logBody, entry || {});
      });
    }

    function renderPreview(data) {
      var sample =
        data && Array.isArray(data.sample) ? data.sample.slice(0, 20) : [];
      var count =
        data && Number.isFinite(Number(data.count)) ? Number(data.count) : 0;
      elements.previewCount.textContent =
        "除外前の候補件数: " +
        formatCount(count) +
        "件。先頭20件を表示しています。";
      clearNode(elements.previewBody);

      if (0 === sample.length) {
        var emptyRow = document.createElement("tr");
        var emptyCell = document.createElement("td");
        emptyCell.colSpan = 4;
        emptyCell.textContent = "候補はありません。";
        emptyRow.appendChild(emptyCell);
        elements.previewBody.appendChild(emptyRow);
      } else {
        sample.forEach(function (entry) {
          appendLogRow(elements.previewBody, entry || {});
        });
      }
      elements.previewSection.hidden = false;
    }

    function hasFailedIds(job) {
      return Boolean(
        job && Array.isArray(job.failed_ids) && job.failed_ids.length,
      );
    }

    function renderJob(job) {
      if (!job || "object" !== typeof job) {
        elements.progress.textContent = "";
        elements.counts.hidden = true;
        renderLog([]);
        setStatus("実行中の一括発行ジョブはありません。", "info");
        updateButtons();
        return;
      }

      var counts =
        job.counts && "object" === typeof job.counts ? job.counts : {};
      elements.progress.textContent =
        "進捗: " +
        formatCount(job.processed) +
        " / " +
        formatCount(job.total) +
        "件";
      elements.successCount.textContent = formatCount(counts.success);
      elements.failedCount.textContent = formatCount(counts.failed);
      elements.skippedCount.textContent = formatCount(counts.skipped);
      elements.counts.hidden = false;
      renderLog(job.log);

      if ("running" === job.status) {
        if (state.running) {
          setStatus("一括発行を実行しています。", "info");
        } else if (state.cancelRequested) {
          setStatus(
            "処理中の1件が完了後に一括発行をキャンセルします。",
            "warning",
          );
        } else {
          setStatus(
            "実行中のジョブがあります。「一括発行を再開」を押すと続行します。",
            "warning",
          );
        }
      } else if ("completed" === job.status) {
        if (hasFailedIds(job)) {
          setStatus(
            "一括発行が完了しました。失敗した記事を再試行できます。",
            "warning",
          );
        } else {
          setStatus("一括発行が完了しました。", "success");
        }
      } else if ("cancelled" === job.status) {
        setStatus("一括発行をキャンセルしました。", "warning");
      } else {
        setStatus("ジョブの状態を確認できません。", "error");
      }
      updateButtons();
    }

    function collectFilters() {
      var postType = elements.postType.value;
      var categoryValue = elements.category.value;
      var category = /^\d+$/.test(categoryValue)
        ? parseInt(categoryValue, 10)
        : 0;
      if (!Number.isFinite(category) || category < 0) {
        category = 0;
      }
      if (["all", "post", "page"].indexOf(postType) < 0) {
        postType = "all";
      }

      var mode = elements.mode.value;
      if (["missing", "all"].indexOf(mode) < 0) {
        mode = "missing";
      }
      return {
        post_type: postType,
        category: String(category),
        date_from: elements.dateFrom.value.trim(),
        date_to: elements.dateTo.value.trim(),
        mode: mode,
      };
    }

    function validateFilters(filters) {
      var datePattern = /^\d{4}-\d{2}-\d{2}$/;
      if (filters.date_from && !datePattern.test(filters.date_from)) {
        return "開始日はYYYY-MM-DD形式で指定してください。";
      }
      if (filters.date_to && !datePattern.test(filters.date_to)) {
        return "終了日はYYYY-MM-DD形式で指定してください。";
      }
      if (
        filters.date_from &&
        filters.date_to &&
        filters.date_from > filters.date_to
      ) {
        return "開始日は終了日以前の日付を指定してください。";
      }
      return "";
    }

    function getValidatedFilters() {
      var filters = collectFilters();
      var error = validateFilters(filters);
      if (error) {
        setStatus(error, "error");
        return null;
      }
      return filters;
    }

    function updateModeVisibility() {
      var reissue = "all" === elements.mode.value;
      elements.reissueWarning.hidden = !reissue;
      elements.reissueConfirmWrap.hidden = !reissue;
      if (!reissue) {
        elements.reissueConfirm.checked = false;
      }
    }

    function applyJobFilters(filters) {
      if (!filters || "object" !== typeof filters) {
        return;
      }
      if (["all", "post", "page"].indexOf(filters.post_type) >= 0) {
        elements.postType.value = filters.post_type;
      }
      if (undefined !== filters.category) {
        var categoryValue = String(filters.category);
        var categoryExists = false;
        for (var index = 0; index < elements.category.options.length; index++) {
          if (elements.category.options[index].value === categoryValue) {
            categoryExists = true;
            break;
          }
        }
        elements.category.value = categoryExists ? categoryValue : "0";
      }
      if ("string" === typeof filters.date_from) {
        elements.dateFrom.value = filters.date_from;
      }
      if ("string" === typeof filters.date_to) {
        elements.dateTo.value = filters.date_to;
      }
      if (["missing", "all"].indexOf(filters.mode) >= 0) {
        elements.mode.value = filters.mode;
      }
      updateModeVisibility();
    }

    function updateButtons() {
      var jobRunning = Boolean(state.job && "running" === state.job.status);
      var busy = state.requestInFlight;
      var filtersLocked = busy || state.running || jobRunning;
      [
        elements.postType,
        elements.category,
        elements.dateFrom,
        elements.dateTo,
        elements.mode,
        elements.reissueConfirm,
      ].forEach(function (control) {
        control.disabled = filtersLocked;
      });
      elements.preview.disabled = busy || state.running || jobRunning;
      elements.start.disabled = busy || state.running || jobRunning;
      elements.resume.hidden = !(
        jobRunning &&
        !state.running &&
        !state.cancelRequested
      );
      elements.resume.disabled = busy;
      elements.pause.hidden = !state.running;
      elements.pause.disabled = state.requestInFlight && state.cancelRequested;
      elements.retry.hidden = !(
        state.job &&
        "completed" === state.job.status &&
        hasFailedIds(state.job)
      );
      elements.retry.disabled = busy || state.running;
      elements.cancel.hidden = !jobRunning;
      elements.cancel.disabled = busy && state.cancelRequested;
      elements.refresh.disabled =
        busy || state.running || state.cancelRequested;
    }

    function appendFilters(params, filters) {
      var values = filters || collectFilters();
      params.set("post_type", values.post_type);
      params.set("category", values.category);
      params.set("date_from", values.date_from);
      params.set("date_to", values.date_to);
      params.set("mode", values.mode);
    }

    function jobFromData(data) {
      if (data && data.job && "object" === typeof data.job) {
        return data.job;
      }
      if (data && "object" === typeof data && data.id) {
        return data;
      }
      return null;
    }

    function statusJobFromData(data) {
      if (data && Object.prototype.hasOwnProperty.call(data, "job")) {
        return data.job && "object" === typeof data.job ? data.job : null;
      }
      return jobFromData(data);
    }

    async function request(operation, options) {
      if (state.requestInFlight) {
        throw makeError("別のリクエストを処理中です。", false);
      }
      if (!config.ajaxUrl || !config.nonce) {
        throw makeError("一括発行の通信設定を読み込めませんでした。", false);
      }

      var requestId = state.requestSequence + 1;
      state.requestSequence = requestId;
      state.latestRequest = requestId;
      state.requestInFlight = true;
      updateButtons();

      var params = new URLSearchParams();
      params.set("action", "profile_ca_bulk");
      params.set("nonce", config.nonce);
      params.set("operation", operation);
      appendFilters(params, options && options.filters);

      if (["step", "retry", "cancel"].indexOf(operation) >= 0) {
        if (!state.job || !state.job.id) {
          state.requestInFlight = false;
          updateButtons();
          throw makeError(
            "操作対象のジョブがありません。状態を再取得してください。",
            false,
          );
        }
        params.set("job_id", String(state.job.id));
      }
      if (
        options &&
        Object.prototype.hasOwnProperty.call(options, "confirmReissue")
      ) {
        params.set("confirm_reissue", options.confirmReissue ? "1" : "0");
      }

      try {
        var response = await fetch(config.ajaxUrl, {
          method: "POST",
          credentials: "same-origin",
          headers: {
            Accept: "application/json",
          },
          body: params,
        });
        var payload;
        try {
          payload = await response.json();
        } catch (error) {
          throw makeError("サーバーから不正な応答を受け取りました。", true);
        }
        if (requestId !== state.latestRequest) {
          return null;
        }
        if (!response.ok || !payload || true !== payload.success) {
          var message =
            payload && payload.data && payload.data.message
              ? valueAsText(payload.data.message)
              : "一括発行のリクエストに失敗しました。";
          throw makeError(message, false);
        }
        return payload.data;
      } catch (error) {
        if (error && error.bulkRequestError) {
          throw error;
        }
        throw makeError("サーバーに接続できませんでした。", true);
      } finally {
        if (requestId === state.latestRequest) {
          state.requestInFlight = false;
          updateButtons();
        }
      }
    }

    function showRequestError(error) {
      state.running = false;
      state.cancelRequested = false;
      state.cancelSent = false;
      if (error && error.networkFailure) {
        setStatus(
          "通信に失敗しました。サーバー側で処理済みの可能性があります。「状態を再取得」を押してください。",
          "error",
        );
      } else {
        setStatus(
          error && error.message ? error.message : "一括発行に失敗しました。",
          "error",
        );
      }
      updateButtons();
    }

    async function loadStatus() {
      setStatus("状態を読み込んでいます。", "info");
      try {
        var data = await request("status");
        state.job = statusJobFromData(data);
        state.running = false;
        state.cancelRequested = false;
        state.cancelSent = false;
        if (state.job) {
          applyJobFilters(state.job.filters);
        }
        renderJob(state.job);
      } catch (error) {
        showRequestError(error);
      }
    }

    async function preview() {
      if (
        state.requestInFlight ||
        state.running ||
        (state.job && "running" === state.job.status)
      ) {
        return;
      }
      var filters = getValidatedFilters();
      if (!filters) {
        return;
      }
      setStatus("プレビューを取得しています。", "info");
      try {
        var data = await request("preview", { filters: filters });
        if (null === data) {
          return;
        }
        renderPreview(data);
        setStatus("プレビューを取得しました。", "success");
      } catch (error) {
        showRequestError(error);
      }
    }

    async function begin() {
      if (
        state.requestInFlight ||
        state.running ||
        (state.job && "running" === state.job.status)
      ) {
        return;
      }
      var filters = getValidatedFilters();
      if (!filters) {
        return;
      }
      if ("all" === filters.mode && !elements.reissueConfirm.checked) {
        setStatus("再発行の確認欄にチェックしてください。", "error");
        elements.reissueConfirm.focus();
        return;
      }

      state.cancelRequested = false;
      state.cancelSent = false;
      setStatus("一括発行を開始しています。", "info");
      try {
        var data = await request("start", {
          filters: filters,
          confirmReissue:
            "all" === filters.mode && elements.reissueConfirm.checked,
        });
        if (null === data) {
          return;
        }
        state.job = jobFromData(data);
        if (!state.job) {
          throw makeError(
            "サーバーからジョブ情報を受け取れませんでした。",
            false,
          );
        }
        renderJob(state.job);
        if ("running" === state.job.status) {
          state.running = true;
          renderJob(state.job);
          await runLoop();
        }
      } catch (error) {
        showRequestError(error);
      }
    }

    async function runLoop() {
      if (state.loopActive) {
        return;
      }
      state.loopActive = true;
      var requestFailed = false;
      try {
        while (state.running) {
          if (
            state.cancelRequested ||
            !state.job ||
            "running" !== state.job.status
          ) {
            state.running = false;
            break;
          }

          var data;
          try {
            data = await request("step");
          } catch (error) {
            requestFailed = true;
            showRequestError(error);
            break;
          }
          if (null === data) {
            break;
          }

          var job = jobFromData(data);
          if (!job) {
            requestFailed = true;
            showRequestError(
              makeError(
                "サーバーからジョブ情報を受け取れませんでした。",
                false,
              ),
            );
            break;
          }
          state.job = job;
          renderJob(state.job);
          if ("running" !== state.job.status || state.cancelRequested) {
            state.running = false;
          }
        }
      } finally {
        state.loopActive = false;
        updateButtons();
        if (
          !requestFailed &&
          state.cancelRequested &&
          state.job &&
          "running" === state.job.status &&
          !state.cancelSent
        ) {
          await cancelJob();
        }
      }
    }

    function pause() {
      if (!state.running) {
        return;
      }
      var requestInFlight = state.requestInFlight;
      state.running = false;
      setStatus(
        requestInFlight
          ? "処理中の記事が完了したら一時停止します。"
          : "一時停止しました。",
        "warning",
      );
      updateButtons();
    }

    function resume() {
      if (
        state.requestInFlight ||
        state.loopActive ||
        !state.job ||
        "running" !== state.job.status
      ) {
        return;
      }
      state.cancelRequested = false;
      state.cancelSent = false;
      state.running = true;
      renderJob(state.job);
      runLoop();
    }

    async function retry() {
      if (
        state.requestInFlight ||
        state.running ||
        !state.job ||
        "completed" !== state.job.status ||
        !hasFailedIds(state.job)
      ) {
        return;
      }
      state.cancelRequested = false;
      state.cancelSent = false;
      setStatus("失敗した記事を再試行する準備をしています。", "info");
      try {
        var data = await request("retry");
        if (null === data) {
          return;
        }
        state.job = jobFromData(data);
        if (!state.job) {
          throw makeError(
            "サーバーからジョブ情報を受け取れませんでした。",
            false,
          );
        }
        renderJob(state.job);
        if ("running" === state.job.status) {
          state.running = true;
          renderJob(state.job);
          await runLoop();
        }
      } catch (error) {
        showRequestError(error);
      }
    }

    async function cancelJob() {
      if (
        state.cancelSent ||
        state.requestInFlight ||
        !state.job ||
        "running" !== state.job.status
      ) {
        return;
      }
      state.cancelSent = true;
      state.running = false;
      setStatus("一括発行をキャンセルしています。", "warning");
      try {
        var data = await request("cancel");
        if (null === data) {
          return;
        }
        state.job = jobFromData(data);
        state.cancelRequested = false;
        state.cancelSent = false;
        if (state.job) {
          renderJob(state.job);
        }
      } catch (error) {
        state.cancelRequested = false;
        state.cancelSent = false;
        showRequestError(error);
      }
    }

    function requestCancel() {
      if (
        state.cancelSent ||
        state.cancelRequested ||
        !state.job ||
        "running" !== state.job.status
      ) {
        return;
      }
      state.cancelRequested = true;
      state.running = false;
      setStatus(
        state.requestInFlight
          ? "処理中の1件が完了後に一括発行をキャンセルします。"
          : "一括発行をキャンセルしています。",
        "warning",
      );
      updateButtons();
      if (!state.requestInFlight && !state.loopActive) {
        cancelJob();
      }
    }

    elements.preview.addEventListener("click", preview);
    elements.start.addEventListener("click", begin);
    elements.resume.addEventListener("click", resume);
    elements.pause.addEventListener("click", pause);
    elements.retry.addEventListener("click", retry);
    elements.cancel.addEventListener("click", requestCancel);
    elements.refresh.addEventListener("click", loadStatus);
    elements.mode.addEventListener("change", function () {
      updateModeVisibility();
      elements.previewSection.hidden = true;
    });
    [
      elements.postType,
      elements.category,
      elements.dateFrom,
      elements.dateTo,
    ].forEach(function (control) {
      control.addEventListener("change", function () {
        elements.previewSection.hidden = true;
      });
    });

    updateModeVisibility();
    updateButtons();
    loadStatus();
  }

  if ("loading" === document.readyState) {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
