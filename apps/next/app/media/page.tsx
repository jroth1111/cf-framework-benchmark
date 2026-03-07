import { queryMedia } from "@cf-bench/dataset";
import { MediaClientEntry } from "./MediaClientEntry";

export default function MediaPage() {
  const items = queryMedia({ pageSize: 12 }).results;

  return (
    <>
      <h1 className="h1">Media Feed (SPA-like)</h1>
      <MediaClientEntry items={items} />
    </>
  );
}
