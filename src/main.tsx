import React from "react";
import ReactDOM from "react-dom/client";
import { getCurrentWindow } from "@tauri-apps/api/window";
import App from "./App";
import QuickCapture from "./QuickCapture";

const winLabel = (() => {
  try {
    return getCurrentWindow().label;
  } catch {
    return "main";
  }
})();

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    {winLabel === "capture" ? <QuickCapture /> : <App />}
  </React.StrictMode>,
);
