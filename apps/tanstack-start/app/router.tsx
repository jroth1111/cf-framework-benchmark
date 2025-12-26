import { createRouter as createTanStackRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export function createRouter() {
  return createTanStackRouter({
    routeTree,
    scrollRestoration: true,
  });
}

let router: ReturnType<typeof createRouter> | null = null;

export function getRouter() {
  if (typeof window === "undefined") return createRouter();
  if (!router) router = createRouter();
  return router;
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof createRouter>;
  }
}
