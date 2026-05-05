import { useParams } from "@solidjs/router";
import { StayDetail } from "../../../../solid/src/pages/StayDetail";
import { BenchHeaders } from "../../lib/headers";

export default function StayDetailPage() {
  const params = useParams<{ id: string }>();
  return (
    <>
      <BenchHeaders cacheControl="public, max-age=0, s-maxage=300, stale-while-revalidate=600" />
      <StayDetail id={params.id} />
    </>
  );
}
