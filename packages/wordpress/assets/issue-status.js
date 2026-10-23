(function () {
  "use strict";

  const NOTICE_ID = "profile-ca-issue-failure";

  function start() {
    const config = window.profileCaIssueStatus || {};
    const { select, dispatch, subscribe } = window.wp.data;
    const editor = () => select("core/editor");

    async function refresh(postId) {
      try {
        const response = await fetch(config.ajaxUrl, {
          method: "POST",
          credentials: "same-origin",
          body: new URLSearchParams({
            action: "profile_ca_issue_status",
            nonce: config.nonce,
            post_id: String(postId),
          }),
        });
        const payload = await response.json();
        if (!payload.success) {
          return;
        }
        const notices = dispatch("core/notices");
        if (payload.data.message) {
          notices.createNotice("error", payload.data.message, {
            id: NOTICE_ID,
            isDismissible: true,
            actions: config.settingsUrl
              ? [{ label: "CAサーバーへの接続確認", url: config.settingsUrl }]
              : [],
          });
        } else {
          notices.removeNotice(NOTICE_ID);
        }
      } catch {
        // 通知は補助的な情報のため、取得できなくても編集は続けられる。
      }
    }

    // 編集画面を開いたとき（投稿 ID が決まったとき）と、保存が終わるたびに確認する。
    // CA は公開・更新の保存処理の中で発行されるため、保存の完了後には結果が記録されている。
    let currentPostId = null;
    let wasSaving = false;
    subscribe(function () {
      const postId = editor().getCurrentPostId();
      const saving = editor().isSavingPost() && !editor().isAutosavingPost();
      if (postId && postId !== currentPostId) {
        currentPostId = postId;
        void refresh(postId);
      } else if (postId && wasSaving && !saving) {
        void refresh(postId);
      }
      wasSaving = saving;
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
