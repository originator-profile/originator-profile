import Loading from "../components/Loading";
import Unsupported from "../components/Unsupported";
import Prohibition from "../templates/Prohibition";
import Sidepanel from "../templates/Sidepanel";
import { useTabView } from "../view";

function Base() {
  const view = useTabView();

  switch (view.state) {
    case "loading":
      return <Loading origin={view.origin} />;
    case "prohibited":
      return <Prohibition />;
    case "unsupported":
      return <Unsupported codes={view.codes} />;
    case "ready":
      return <Sidepanel {...view} />;
  }
}

export default Base;
