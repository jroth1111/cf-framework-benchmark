import type { Handle } from "@sveltejs/kit";

export const handle: Handle = async ({ event, resolve }) => {
  const response = await resolve(event);
  if (!event.url.pathname.startsWith("/api/")) {
    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("text/html")) {
      response.headers.set("cache-control", "no-store");
    }
  }
  return response;
};
