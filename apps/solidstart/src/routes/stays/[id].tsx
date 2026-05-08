import { useParams } from "@solidjs/router";
import { StayDetail } from "../../../../solid/src/pages/StayDetail";
import { BenchHeaders } from "../../lib/headers";

export default function StayDetailPage() {
  const params = useParams<{ id: string }>();
  return (
    <>
      <BenchHeaders routeId="/stays/:id" />
      <StayDetail id={params.id} />
    </>
  );
}
