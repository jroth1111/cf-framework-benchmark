import type {} from "hono";
declare module "hono" {
	interface ContextRenderer {
		(content: string | Promise<string>, props?: { title?: string; hifi?: boolean }): Response | Promise<Response>;
	}
}
