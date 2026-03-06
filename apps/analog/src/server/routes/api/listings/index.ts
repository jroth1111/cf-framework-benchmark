import { defineEventHandler } from 'h3';
import { handleListings } from '@cf-bench/bench-contract';

export default defineEventHandler((event) =>
  handleListings(new URL(event.node.req.url || '/api/listings', 'https://cf-bench.local'))
);
