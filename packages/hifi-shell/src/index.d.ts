import type { Listing } from "@cf-bench/dataset";

/**
 * Returns the SSR HTML body for the /hifi/stays index page (excluding the
 * page <h1> and outer wrapper). Frameworks consume this verbatim via
 * `dangerouslySetInnerHTML` / `{@html}` / `innerHTML`.
 */
export function renderHifiStaysListBody(listings: readonly Listing[]): string;

/**
 * Returns the SSR HTML body for /hifi/stays/:id (excluding the outer
 * wrapper). Frameworks consume this verbatim. The output contains all six
 * required selectors: stay-hero-image, stay-gallery, stay-reviews,
 * stay-booking-form, stay-booking-total, stay-map.
 */
export function renderHifiStayDetailBody(listing: Listing): string;

/**
 * Returns the inline booking-form handler script body that must run on every
 * hifi detail page. The script attaches a submit handler, computes the
 * booking total client-side, and reveals the stay-booking-total element.
 */
export function getHifiBookingScript(): string;

/**
 * Idempotent client-side equivalent of getHifiBookingScript. Frameworks whose
 * SSR templates cannot execute injected <script> tags (Svelte's {@html},
 * Solid's innerHTML) call this from their mount/hydrate hook instead.
 */
export function attachHifiBookingForms(): void;

/**
 * Returns the document <head> markup for hifi pages: two async <script> tags
 * pointing at /__bench/sdk/maps.js and /__bench/sdk/analytics.js. Frameworks
 * inject this into their respective head slots.
 */
export function getHifiHeadHtml(): string;

/**
 * Returns the four pieces a framework needs to render a hifi detail page:
 * head HTML, body HTML, the inline booking script body, and the not-found
 * fallback HTML. Pure helper so callers can compose without re-deriving
 * pieces individually.
 */
export type HifiDetailParts = {
  head: string;
  body: string;
  script: string;
  notFound: string;
};

export function getHifiStayDetailParts(listing: Listing | undefined): HifiDetailParts;
