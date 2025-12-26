import { component$ } from "@qwik.dev/core";
import { useDocumentHead, useLocation } from "@qwik.dev/router";

export const RouterHead = component$(() => {
  const head = useDocumentHead();
  const loc = useLocation();

  return (
    <>
      <title>{head.title || "CF Bench — Qwik"}</title>
      {head.meta.map((m) => (
        <meta key={m.key} {...m} />
      ))}
      <link rel="canonical" href={loc.url.href} />
    </>
  );
});
