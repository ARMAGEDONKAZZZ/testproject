import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";

import "@/styles/index.css";
import "@/i18n";
import { queryClient } from "@/app/queryClient";
import { initSessionWiring } from "@/features/auth/session";
import { ToastViewport } from "@/components/Toast";
import { App } from "@/App";

initSessionWiring();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
        <ToastViewport />
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
