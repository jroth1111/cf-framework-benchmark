import { defineEventHandler } from 'h3';
import { handleMedia } from '@cf-bench/bench-contract';

export default defineEventHandler((event) =>
  handleMedia(new URL(event.node.req.url || '/api/media', 'https://cf-bench.local'))
);
