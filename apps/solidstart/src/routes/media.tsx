import { lazy } from "solid-js";

const Media = lazy(async () => {
  const mod = await import("../../../solid/src/pages/Media");
  return { default: mod.Media };
});

export default function MediaPage() {
  return <Media />;
}
