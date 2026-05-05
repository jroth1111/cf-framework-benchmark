import { BENCH_MEDIA_PAGE_SIZE, queryMedia } from "@cf-bench/dataset";
import { MediaClientEntry } from "./MediaClientEntry";

export default function MediaPage() {
  const items = queryMedia({ pageSize: BENCH_MEDIA_PAGE_SIZE }).results;

  return (
    <>
      <h1 className="h1">Media Feed (SPA-like)</h1>
      <MediaClientEntry items={items} />
    </>
  );
}
