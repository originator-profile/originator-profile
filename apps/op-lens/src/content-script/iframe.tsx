import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

const init = () => {
  const root = document.createElement("div");
  if (!root) return;
  document.body.appendChild(root);
  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
};

init();
