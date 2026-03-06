import React from "react";
import { renderToString } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { App } from "./App";

export function renderApp(route: string) {
    return renderToString(
        <React.StrictMode>
            <MemoryRouter initialEntries={[route]}>
                <App />
            </MemoryRouter>
        </React.StrictMode>
    );
}
