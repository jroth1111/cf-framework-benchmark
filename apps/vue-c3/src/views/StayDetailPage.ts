import { computed, defineComponent, h } from "vue";
import { RouterLink, useRoute } from "vue-router";
import { formatUsd, getListing } from "@cf-bench/dataset";

export default defineComponent({
	name: "StayDetailPage",
	setup() {
		const route = useRoute();
		const listing = computed(() => getListing(String(route.params.id || "")) ?? null);
		return () => {
			if (!listing.value) {
				return h("div", [
					h("h1", { class: "h1" }, "Listing not found"),
					h(
						RouterLink,
						{ class: "pill", to: "/stays" },
						{
							default: () => "← Back to stays",
						},
					),
				]);
			}
			return h("div", [
				h(
					RouterLink,
					{ class: "pill", to: "/stays" },
					{
						default: () => "← Back to stays",
					},
				),
				h("h1", { class: "h1" }, listing.value.title),
				h("div", { class: "small muted" }, `${listing.value.city}, ${listing.value.country} • ${listing.value.neighborhood}`),
				h("div", { class: "card", style: { marginTop: "12px" } }, [
					h("div", { style: { marginBottom: "12px" } }, [
						h("strong", formatUsd(listing.value.pricePerNight)),
						" ",
						h("span", { class: "muted small" }, "/ night"),
					]),
					h("div", {
						"data-testid": "stay-description",
						innerHTML: listing.value.descriptionHtml,
					}),
				]),
			]);
		};
	},
});
