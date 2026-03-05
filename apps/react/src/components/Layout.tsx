import React from "react";
import { NavLink } from "react-router-dom";

export function Layout({ children }: { children: React.ReactNode }) {
    return (
        <>
            <header className="container nav">
                <NavLink className="brand" to="/">
                    CF Bench
                </NavLink>
                <nav className="links">
                    <NavLink className="pill" to="/stays">Stays</NavLink>
                    <NavLink className="pill" to="/chart">Chart</NavLink>
                    <NavLink className="pill" to="/blog">Blog</NavLink>
                </nav>
            </header>
            <main className="container">
                {children}
                <div className="footer">
                    React SPA variant • client-side routing via react-router-dom.
                </div>
            </main>
        </>
    );
}
