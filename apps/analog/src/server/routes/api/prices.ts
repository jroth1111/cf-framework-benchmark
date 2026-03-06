import { defineEventHandler } from 'h3';
import { handlePrices } from '@cf-bench/bench-contract';

export default defineEventHandler((event) =>
  handlePrices(new URL(event.node.req.url || '/api/prices', 'https://cf-bench.local'))
);
