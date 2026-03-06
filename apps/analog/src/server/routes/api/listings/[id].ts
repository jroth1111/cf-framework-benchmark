import { defineEventHandler } from 'h3';
import { handleListing } from '@cf-bench/bench-contract';

export default defineEventHandler((event) => handleListing(event.context.params?.id || ''));
