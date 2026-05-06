import { component$, Slot } from "@qwik.dev/core";

export default component$(() => {
  return (
    <>
      <script async src="/__bench/sdk/maps.js" />
      <script async src="/__bench/sdk/analytics.js" />
      <Slot />
    </>
  );
});
