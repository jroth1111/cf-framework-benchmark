import { defineEventHandler } from 'h3';
import { handleBench } from '@cf-bench/bench-contract';

export default defineEventHandler(() => handleBench('analog'));
