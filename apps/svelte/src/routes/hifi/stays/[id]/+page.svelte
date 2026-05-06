<script lang="ts">
  import { onMount } from "svelte";
  import { renderHifiStayDetailBody, attachHifiBookingForms } from "@cf-bench/hifi-shell";
  import type { Listing } from "@cf-bench/dataset";
  import type { PageData } from "./$types";

  export let data: PageData;
  $: bodyHtml = data.listing
    ? renderHifiStayDetailBody(data.listing as Listing)
    : "<h1 class=\"h1\">Stay not found</h1><div class=\"card\" style=\"padding:16px\"><p>Unknown listing.</p><a class=\"pill\" href=\"/hifi/stays\">Back</a></div>";

  onMount(() => {
    attachHifiBookingForms();
  });
</script>

{@html bodyHtml}
