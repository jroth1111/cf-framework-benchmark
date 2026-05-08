import { computed, defineComponent, h, onMounted } from "vue";
import { useRoute } from "vue-router";
import { getListing } from "@cf-bench/dataset";
import { attachHifiBookingForms, getHifiStayDetailParts } from "@cf-bench/hifi-shell";

export default defineComponent({
	name: "HifiStayDetailPage",
	setup() {
		const route = useRoute();
		const parts = computed(() => getHifiStayDetailParts(getListing(String(route.params.id || ""))));
		onMounted(() => {
			attachHifiBookingForms();
		});
		return () => [
			h("script", { async: true, src: "/__bench/sdk/maps.js" }),
			h("script", { async: true, src: "/__bench/sdk/analytics.js" }),
			h("div", { innerHTML: parts.value.body }),
		];
	},
});
