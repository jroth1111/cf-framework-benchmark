import { defineComponent, h } from "vue";
import { RouterLink, RouterView } from "vue-router";

function navLink(to: string, label: string) {
	return h(
		RouterLink,
		{ class: "pill", to },
		{
			default: () => label,
		},
	);
}

export default defineComponent({
	name: "RootApp",
	setup() {
		return () =>
			h("div", [
				h("header", { class: "container nav" }, [
					h(
						RouterLink,
						{ class: "brand", to: "/" },
						{
							default: () => "CF Bench",
						},
					),
					h("nav", { class: "links" }, [
						navLink("/stays", "Stays"),
						navLink("/chart", "Chart"),
						navLink("/media", "Media"),
						navLink("/blog", "Blog"),
					]),
				]),
				h("main", { class: "container" }, [
					h(RouterView),
					h("div", { class: "footer" }, "Hono + Vue variant. Hono owns routing while Vue renders the benchmark UI."),
				]),
			]);
	},
});
