import { queryMedia } from "@cf-bench/dataset";
import { MediaClient } from "./MediaClient";

export default function MediaPage() {
  const items = queryMedia({ pageSize: 30 }).results;

  return (
    <>
      <h1 className="h1">Media Feed (SPA-like)</h1>
      <MediaClient items={items} />
    </>
  );
}
