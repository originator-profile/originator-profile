import { useEffect } from "react";
import { Routes, Route, Navigate } from "react-router";
import { overlayExtensionMessenger } from "./components/overlay/extension-events";
import Base from "./pages/Base";
import Credentials from "./pages/Credentials";
import Org from "./pages/Org";
import Prohibition from "./pages/Prohibition";
import SiteProfile from "./pages/SiteProfile";
import { buildPublUrl, paths } from "./utils/routes";

function App() {
  useEffect(() => {
    const cleanup = overlayExtensionMessenger.onMessage(
      "select",
      ({ sender, data }) => {
        document.location.hash = buildPublUrl(
          sender.tab.id,
          data.activeCa.attestation.doc,
        );
      },
    );

    return () => {
      cleanup();
    };
  }, []);

  return (
    <Routes>
      <Route path="/">
        <Route index element={<Navigate to="/tab" replace />} />
        <Route path={paths.base}>
          <Route index element={<Base />} />
          <Route path={paths.site}>
            <Route index element={<SiteProfile />} />
            <Route path={paths.org} element={<Org back="../.." />} />
          </Route>
          <Route path={paths.publ}>
            <Route
              index
              element={
                <div className="flex flex-col">
                  <SiteProfile />
                  <Credentials />
                </div>
              }
            />
            <Route path={paths.org} element={<Org back="../.." />} />
          </Route>
          <Route path={paths.prohibition} element={<Prohibition />} />
        </Route>
      </Route>
    </Routes>
  );
}

export default App;
