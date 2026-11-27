import { ContentList } from "../components/sidepanel/ContentList";
import type { TabView } from "../view";

type Props = Extract<TabView, { state: "ready" }>;

function Sidepanel(props: Props) {
  return (
    <main className="min-h-screen bg-gray-100" data-testid="sidepanel">
      {/* NOTE: タブが変わったら、開いているアコーディオンと詳細を閉じる */}
      <ContentList key={props.tabId} {...props} />
    </main>
  );
}

export default Sidepanel;
