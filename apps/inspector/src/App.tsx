import { useEffect } from "react";
import { Navigate, Route, Routes } from "react-router";
import { useNavigationRefetch, useTabTracking } from "./components/activeTab";
import { EnvironmentBanner } from "./components/environment";
import { overlayExtensionMessenger } from "./components/overlay/extension-events";
import Base from "./pages/Base";
import Credentials from "./pages/Credentials";
import DetailInfo from "./pages/DetailInfo";
import Org from "./pages/Org";
import Prohibition from "./pages/Prohibition";
import SiteProfile from "./pages/SiteProfile";
import Warning from "./pages/Warning";
import { buildPublUrl, paths } from "./utils/routes";

function App() {
  useTabTracking();
  useNavigationRefetch();

  useEffect(() => {
    const cleanup = overlayExtensionMessenger.onMessage(
      "select",
      ({ sender, data }) => {
        document.location.hash = buildPublUrl(
          sender.tab?.id,
          data.activeCa.attestation.doc,
        );
      },
    );

    return () => {
      cleanup();
    };
  }, []);

  return (
    <div className="flex flex-col">
      <EnvironmentBanner mode={import.meta.env.MODE} />
      <Routes>
        <Route path="/">
          <Route index element={<Navigate to="/tab" replace />} />
          <Route path={paths.base}>
            <Route index element={<Base />} />
            <Route path={paths.site}>
              <Route
                index
                element={
                  <div className="flex flex-col divide-y divide-gray-200">
                    <SiteProfile />
                  </div>
                }
              />
              <Route path={paths.org} element={<Org back="../.." />} />
            </Route>
            <Route path={paths.publ}>
              <Route
                index
                element={
                  <div className="flex flex-col divide-y divide-gray-200">
                    <SiteProfile />
                    <Credentials />
                  </div>
                }
              />
              <Route path={paths.org} element={<Org back="../.." />} />
            </Route>
            <Route path={paths.prohibition} element={<Prohibition />} />
            <Route path={paths.detail} element={<DetailInfo back=".." />} />
          </Route>
          <Route path={paths.warning} element={<Warning />} />
        </Route>
      </Routes>
    </div>
  );
}

export default App;
