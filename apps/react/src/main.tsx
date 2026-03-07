import React from "react";
import { hydrateRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { App, preloadRoute } from "./App";
import "./main.css";

async function bootstrap() {
    await preloadRoute(window.location.pathname);

    hydrateRoot(
        document.getElementById("root")!,
        <React.StrictMode>
            <BrowserRouter>
                <App />
            </BrowserRouter>
        </React.StrictMode>
    );

    requestAnimationFrame(() => {
        const w = window as any;
        w.__CF_BENCH__ = w.__CF_BENCH__ || {};
        const hydration = (w.__CF_BENCH__.hydration = w.__CF_BENCH__.hydration || {});
        hydration.endMs = performance.now();
    });
}

void bootstrap();
