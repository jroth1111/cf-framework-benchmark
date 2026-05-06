import { queryListings } from "@cf-bench/dataset";
import { renderHifiStaysListBody } from "@cf-bench/hifi-shell";

export default function HifiStaysPage() {
  const { results } = queryListings({ page: 1, pageSize: 12 });
  return <div dangerouslySetInnerHTML={{ __html: renderHifiStaysListBody(results) }} />;
}
