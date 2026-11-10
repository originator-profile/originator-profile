import { Navigate, Route, Routes } from "react-router";
import { useDocumentNavigation, useTabTracking } from "./components/activeTab";
import { EnvironmentBanner } from "./components/environment";
import Base from "./pages/Base";
import Detail from "./pages/Detail";
import Warning from "./pages/Warning";
import { paths } from "./utils/routes";

function App() {
  useTabTracking();
  useDocumentNavigation();

  return (
    <div className="flex flex-col">
      <EnvironmentBanner mode={import.meta.env.MODE} />
      <Routes>
        <Route path="/">
          <Route index element={<Navigate to="/tab" replace />} />
          <Route path={paths.base} element={<Base />} />
          <Route path={paths.warning} element={<Warning />} />
          <Route path={paths.detail} element={<Detail />} />
        </Route>
      </Routes>
    </div>
  );
}

export default App;
