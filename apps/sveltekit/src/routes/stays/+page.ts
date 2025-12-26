// Disable SSR for /stays to avoid skeleton rendering without test-id markers
// Client-side rendering ensures data-testid="stay-card" appears immediately
export const ssr = false;
