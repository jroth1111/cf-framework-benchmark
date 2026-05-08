import { defineComponent, h } from "vue";
import { queryListings } from "@cf-bench/dataset";
import { renderHifiStaysListBody } from "@cf-bench/hifi-shell";

export default defineComponent({
	name: "HifiStaysPage",
	setup() {
		const listings = queryListings({ page: 1, pageSize: 12 }).results;
		const bodyHtml = renderHifiStaysListBody(listings);
		return () => [
			h("script", { async: true, src: "/__bench/sdk/maps.js" }),
			h("script", { async: true, src: "/__bench/sdk/analytics.js" }),
			h("div", { innerHTML: bodyHtml }),
		];
	},
});
