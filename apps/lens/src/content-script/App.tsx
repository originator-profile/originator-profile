import { useEffect, useState } from "react";
import { HighlightView } from "../components/overlay";
import type { Highlight } from "../overlay/protocol";
import { lensOverlayWindowMessenger } from "../overlay/window-protocol";

function App() {
  const [highlight, setHighlight] = useState<Highlight>();

  useEffect(() => {
    const cleanupShow = lensOverlayWindowMessenger.onMessage(
      "showHighlight",
      ({ data }) => setHighlight(data),
    );
    lensOverlayWindowMessenger.sendMessage(
      "requestHighlight",
      null,
      window.parent,
    );
    return () => {
      cleanupShow();
    };
  }, []);

  if (!highlight) return null;
  return (
    // NOTE: 範囲は画面の外にもはみ出す。はみ出しで overlay の文書がスクロール
    // できるようにならないよう、画面に固定した箱で切り取る
    <div className="fixed inset-0 overflow-hidden" data-testid="overlay">
      <HighlightView
        key={highlight.kind === "content" ? highlight.key : "page"}
        highlight={highlight}
      />
    </div>
  );
}

export default App;
