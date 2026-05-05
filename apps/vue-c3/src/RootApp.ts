import { defineComponent, h } from "vue";
import { RouterView } from "vue-router";

export default defineComponent({
	name: "RootApp",
	setup() {
		return () =>
			h("div", [
				h("header", { class: "container nav" }, [
					h("a", { class: "brand", href: "/" }, "CF Bench"),
					h("nav", { class: "links" }, [
						h("a", { class: "pill", href: "/stays" }, "Stays"),
						h("a", { class: "pill", href: "/chart" }, "Chart"),
						h("a", { class: "pill", href: "/media" }, "Media"),
						h("a", { class: "pill", href: "/blog" }, "Blog"),
					]),
				]),
				h("main", { class: "container" }, [
					h(RouterView),
					h("div", { class: "footer" }, "Benchmark route surface on Cloudflare Workers."),
				]),
			]);
	},
});
