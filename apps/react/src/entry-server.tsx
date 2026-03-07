import React from "react";
import { renderToString } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { AppServer } from "./App.server";

export function renderApp(route: string) {
    return renderToString(
        <React.StrictMode>
            <MemoryRouter initialEntries={[route]}>
                <AppServer />
            </MemoryRouter>
        </React.StrictMode>
    );
}
