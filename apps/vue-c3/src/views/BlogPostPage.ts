import { computed, defineComponent, h } from "vue";
import { RouterLink, useRoute } from "vue-router";
import { getPost } from "@cf-bench/dataset";

export default defineComponent({
	name: "BlogPostPage",
	setup() {
		const route = useRoute();
		const post = computed(() => getPost(String(route.params.slug || "")) ?? null);
		return () => {
			if (!post.value) {
				return h("div", [
					h("h1", { class: "h1" }, "Post not found"),
					h(
						RouterLink,
						{ class: "pill", to: "/blog" },
						{
							default: () => "← Back to blog",
						},
					),
				]);
			}
			return h("div", [
				h(
					RouterLink,
					{ class: "pill", to: "/blog" },
					{
						default: () => "← Back to blog",
					},
				),
				h("h1", { class: "h1" }, post.value.title),
				h("div", { class: "small muted" }, `${post.value.dateISO} • ${post.value.readingMinutes} min read`),
				h("div", { class: "card", style: { marginTop: "12px" } }, [
					h("div", {
						"data-testid": "blog-html",
						innerHTML: post.value.html,
					}),
				]),
			]);
		};
	},
});
