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
    <div className="h-screen w-screen" data-testid="overlay">
      <HighlightView
        key={highlight.kind === "content" ? highlight.key : "page"}
        highlight={highlight}
      />
    </div>
  );
}

export default App;
