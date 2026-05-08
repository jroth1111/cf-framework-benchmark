import { lazy } from "solid-js";
import { BenchHeaders } from "../lib/headers";

const Media = lazy(async () => {
  const mod = await import("../../../solid/src/pages/Media");
  return { default: mod.Media };
});

export default function MediaPage() {
  return (
    <>
      <BenchHeaders routeId="/media" />
      <Media />
    </>
  );
}
