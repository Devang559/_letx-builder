import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles.css";
import "@pdfslick/react/dist/pdf_viewer.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
