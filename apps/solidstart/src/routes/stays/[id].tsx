import { useParams } from "@solidjs/router";
import { StayDetail } from "../../../../solid/src/pages/StayDetail";

export default function StayDetailPage() {
  const params = useParams<{ id: string }>();
  return <StayDetail id={params.id} />;
}
