import { Hono } from "hono";
import { handleContractApi } from "@cf-bench/bench-contract";
import { getListing, getPost } from "@cf-bench/dataset";
import { render } from "./entry-server";

type Bindings = Env & {
  ASSETS?: {
    fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
  };
};

function cacheKind(pathname: string) {
  if (pathname === "/stays" || pathname === "/blog") return "list";
  if (/^\/stays\/[^/]+$/.test(pathname) || /^\/blog\/[^/]+$/.test(pathname)) return "detail";
  return null;
}

function cacheHeader(pathname: string, profile: string | null) {
  const kind = cacheKind(pathname);
  if (profile === "idiomatic" || profile === "mobile-cold") {
    if (kind === "detail") return "public, max-age=0, s-maxage=300, stale-while-revalidate=600";
    if (kind === "list") return "public, max-age=0, s-maxage=60, stale-while-revalidate=300";
  }
  return "no-store";
}

function isBenchRoute(pathname: string) {
  if (pathname === "/" || pathname === "/stays" || pathname === "/blog" || pathname === "/chart" || pathname === "/media") {
    return true;
  }
  return /^\/stays\/[^/]+$/.test(pathname) || /^\/blog\/[^/]+$/.test(pathname);
}

function needsClient(pathname: string) {
  return pathname === "/chart" || pathname === "/media";
}

function assetRequestFor(url: URL, request: Request) {
  const headers = new Headers(request.headers);
  headers.delete("sec-fetch-mode");
  headers.delete("sec-fetch-dest");
  headers.delete("sec-fetch-site");
  headers.delete("sec-fetch-user");
  return new Request(url.toString(), {
    method: request.method,
    headers,
  });
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function pageTitle(pathname: string) {
  if (pathname === "/") return "Cloudflare Framework Benchmark";
  if (pathname === "/stays") return "Stays";
  if (pathname === "/blog") return "Blog";
  if (pathname === "/chart") return "Chart";
  if (pathname === "/media") return "Media";
  const stayMatch = pathname.match(/^\/stays\/([^/]+)$/);
  const stayId = stayMatch?.[1] ?? "";
  if (stayId) return getListing(stayId)?.title ?? "Listing not found";
  const blogMatch = pathname.match(/^\/blog\/([^/]+)$/);
  const blogSlug = blogMatch?.[1] ?? "";
  if (blogSlug) return getPost(blogSlug)?.title ?? "Post not found";
  return "Hono + Vue Benchmark";
}

function htmlHeaders(pathname: string, profile: string | null, start: number) {
  return new Headers({
    "content-type": "text/html; charset=utf-8",
    "cache-control": cacheHeader(pathname, profile),
    "server-timing": `cf_bench;dur=${(performance.now() - start).toFixed(1)}`,
  });
}

const APP_HTML_PLACEHOLDER = "__CF_BENCH_APP_HTML__";
const CLIENT_ASSETS_RE = /__CF_BENCH_CLIENT_ASSETS_START__[\s\S]*?__CF_BENCH_CLIENT_ASSETS_END__/;
const CLIENT_MODULE_SCRIPT_RE = /\s*<script type="module" crossorigin src="\/assets\/index-[^"]+\.js"><\/script>/g;
const CLIENT_MODULE_PRELOAD_RE = /\s*<link rel="modulepreload" crossorigin href="\/assets\/[^"]+">/g;
const HYDRATION_TAIL =
  '<script>(function(){var w=globalThis;w.__CF_BENCH__=w.__CF_BENCH__||{};var h=(w.__CF_BENCH__.hydration=w.__CF_BENCH__.hydration||{});if(h.endMs==null)h.endMs=h.startMs??performance.now();})();</script>';

type ShellParts = {
  head: string;
  tail: string;
};

let shellPromise: Promise<ShellParts> | null = null;

function isValidShell(shell: string) {
  return (
    shell.includes("__CF_BENCH_ROUTE__") &&
    shell.includes("__CF_BENCH_TITLE__") &&
    shell.includes(APP_HTML_PLACEHOLDER)
  );
}

function splitShell(shell: string): ShellParts {
  const splitIndex = shell.indexOf(APP_HTML_PLACEHOLDER);
  if (splitIndex < 0) {
    throw new Error("Failed to load Vue shell: missing app placeholder");
  }

  return {
    head: shell.slice(0, splitIndex),
    tail: shell.slice(splitIndex + APP_HTML_PLACEHOLDER.length),
  };
}

function resolveShellParts(shell: ShellParts, pathname: string, includeClient: boolean): ShellParts {
  const route = escapeHtml(pathname);
  const title = escapeHtml(pageTitle(pathname));
  const head = shell.head
    .replaceAll("__CF_BENCH_ROUTE__", route)
    .replaceAll("__CF_BENCH_TITLE__", title)
    .replace(CLIENT_ASSETS_RE, "")
    .replace(includeClient ? /$^/ : CLIENT_MODULE_SCRIPT_RE, "")
    .replace(includeClient ? /$^/ : CLIENT_MODULE_PRELOAD_RE, "");
  const tailWithoutMarkers = shell.tail
    .replaceAll("__CF_BENCH_ROUTE__", route)
    .replaceAll("__CF_BENCH_TITLE__", title)
    .replace(CLIENT_ASSETS_RE, "");

  return {
    head,
    tail: includeClient ? tailWithoutMarkers : `${HYDRATION_TAIL}${tailWithoutMarkers}`,
  };
}

function createDocumentStream(head: string, appStream: ReadableStream<Uint8Array>, tail: string) {
  const encoder = new TextEncoder();

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      controller.enqueue(encoder.encode(head));
      const reader = appStream.getReader();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value) controller.enqueue(value);
        }
        controller.enqueue(encoder.encode(tail));
        controller.close();
      } catch (error) {
        controller.error(error);
      } finally {
        reader.releaseLock();
      }
    },
    cancel(reason) {
      return appStream.cancel(reason);
    },
  });
}

async function getShell(env: Bindings, request: Request) {
  if (!env.ASSETS) return null;
  if (!shellPromise) {
    const shellUrl = new URL("/index.html", request.url);
    shellPromise = env.ASSETS.fetch(assetRequestFor(shellUrl, request)).then(async (response: Response) => {
      if (!response.ok) {
        throw new Error(`Failed to load Vue shell: ${response.status}`);
      }
      const shell = await response.text();
      if (!isValidShell(shell)) {
        throw new Error("Failed to load Vue shell: missing benchmark placeholders");
      }
      return splitShell(shell);
    });
  }
  return shellPromise;
}

async function renderDocument(request: Request, env: Bindings) {
  const shell = await getShell(env, request);
  if (!shell) return new Response("Not found", { status: 404 });

  const url = new URL(request.url);
  const start = performance.now();
  const includeClient = needsClient(url.pathname);
  const { head, tail } = resolveShellParts(shell, url.pathname, includeClient);
  const appStream = await render(url.pathname);

  return new Response(createDocumentStream(head, appStream, tail), {
    status: 200,
    headers: htmlHeaders(url.pathname, request.headers.get("x-cf-bench-profile"), start),
  });
}

const app = new Hono<{ Bindings: Bindings }>();

app.all("*", async (c) => {
  const api = handleContractApi("hono-vue", c.req.raw);
  if (api) return api;

  const url = new URL(c.req.raw.url);
  if (isBenchRoute(url.pathname)) {
    return renderDocument(c.req.raw, c.env);
  }

  if (c.env.ASSETS) {
    return c.env.ASSETS.fetch(assetRequestFor(url, c.req.raw));
  }

  return c.text("Not found", 404);
});

export default app;
