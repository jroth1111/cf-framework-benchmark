import { fsRouter } from 'waku';
import adapter from 'waku/adapters/cloudflare';
import { handleBenchmarkRequest } from '@cf-bench/bench-contract';

const wakuWorker = adapter(
  fsRouter(import.meta.glob('./**/*.{tsx,ts}', { base: './pages' })),
  {
    handlers: {
      // Define additional Cloudflare Workers handlers here
      // https://developers.cloudflare.com/workers/runtime-apis/handlers/
      // async queue(
      //   batch: MessageBatch,
      //   _env: Env,
      //   _ctx: ExecutionContext,
      // ): Promise<void> {
      //   for (const message of batch.messages) {
      //     console.log('Received', message);
      //   }
      // },
    } satisfies ExportedHandler<Env>,
  },
);

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const bench = handleBenchmarkRequest('waku', request);
    if (bench) return bench;
    return wakuWorker.fetch(request, env, ctx);
  },
} satisfies ExportedHandler<Env>;
