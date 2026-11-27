import Loading from "../components/Loading";
import Sidepanel from "../templates/Sidepanel";
import { useTabView } from "../view";

function Base() {
  const view = useTabView();
  if (view.state === "loading") return <Loading origin={view.origin} />;
  return <Sidepanel {...view} />;
}

export default Base;
