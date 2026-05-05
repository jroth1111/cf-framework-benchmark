import { AngularAppEngine, createRequestHandler } from '@angular/ssr';
import { handleContractApi } from '@cf-bench/bench-contract';
import { applyHtmlHeaders } from './app/bench-worker';

const angularApp = new AngularAppEngine({
	// It is safe to set allow `localhost`, so that SSR can run in local development,
	// as, in production, Cloudflare will ensure that `localhost` is not the host.
	allowedHosts: ['localhost'],
});

/**
 * This is a request handler used by the Angular CLI (dev-server and during build).
 */
export const reqHandler = createRequestHandler(async (req) => {
	const api = handleContractApi('angular', req);
	if (api) return api;

	const start = performance.now();
	const angularUrl = new URL(req.url);
	angularUrl.hostname = 'localhost';
	const headers = new Headers(req.headers);
	headers.set('host', 'localhost');
	const angularReq = new Request(angularUrl, {
		method: req.method,
		headers,
		body: req.method === 'GET' || req.method === 'HEAD' ? undefined : req.body,
		redirect: req.redirect,
		signal: req.signal,
	});
	const res = await angularApp.handle(angularReq);

	if (!res) return new Response('Page not found.', { status: 404 });

	return applyHtmlHeaders(
		res,
		new URL(req.url).pathname,
		req.headers.get('x-cf-bench-profile'),
		start
	);
});


export default { fetch: reqHandler };
