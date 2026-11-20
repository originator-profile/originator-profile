import { AppBar } from "../components/sidepanel/AppBar";
import { ContentList } from "../components/sidepanel/ContentList";
import type { TabView } from "../view";

type Props = Extract<TabView, { state: "ready" }>;

function Sidepanel(props: Props) {
  return (
    <div className="flex min-h-screen flex-col bg-gray-100">
      <AppBar />
      <main data-testid="sidepanel">
        <ContentList {...props} />
      </main>
    </div>
  );
}

export default Sidepanel;
