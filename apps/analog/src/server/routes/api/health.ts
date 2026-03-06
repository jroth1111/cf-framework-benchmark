import { defineEventHandler } from 'h3';
import { handleHealth } from '@cf-bench/bench-contract';

export default defineEventHandler(() => handleHealth());
