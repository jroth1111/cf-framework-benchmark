<script lang="ts">
  import { renderHifiStaysListBody } from "@cf-bench/hifi-shell";
  import type { PageData } from "./$types";

  export let data: PageData;
  $: bodyHtml = renderHifiStaysListBody(data.listings);
</script>

{@html bodyHtml}
