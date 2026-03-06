export type BenchmarkPageMatch =
  | { page: "home" }
  | { page: "stays" }
  | { page: "stay"; id: string }
  | { page: "blog" }
  | { page: "post"; slug: string }
  | { page: "chart" }
  | { page: "media" };

export function matchBenchmarkPage(pathname: string): BenchmarkPageMatch | null;
export function renderControlPage(framework: string, input: URL | Request | string): string | null;
export function handleControlRequest(framework: string, request: Request, start: number): Response | null;
