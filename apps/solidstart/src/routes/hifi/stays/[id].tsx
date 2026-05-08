import { useParams } from "@solidjs/router";
import { Show, onMount } from "solid-js";
import { getListing } from "@cf-bench/dataset";
import { attachHifiBookingForms, renderHifiStayDetailBody } from "@cf-bench/hifi-shell";
import { BenchHeaders } from "../../../lib/headers";

export default function HifiStayDetailPage() {
  const params = useParams<{ id: string }>();
  const listing = () => getListing(params.id);

  onMount(() => {
    attachHifiBookingForms();
  });

  return (
    <>
      <BenchHeaders routeId="/hifi/stays/:id" />
      <script async src="/__bench/sdk/maps.js" />
      <script async src="/__bench/sdk/analytics.js" />
      <Show
        when={listing()}
        fallback={
          <>
            <h1 class="h1">Stay not found</h1>
            <div class="card" style="padding:16px">
              <p>Unknown listing.</p>
              <a class="pill" href="/hifi/stays">Back</a>
            </div>
          </>
        }
      >
        {(l) => <div innerHTML={renderHifiStayDetailBody(l())} />}
      </Show>
    </>
  );
}
