import { defineComponent, h } from "vue";
import { RouterLink } from "vue-router";
import { blogPosts } from "@cf-bench/dataset";

export default defineComponent({
	name: "BlogPage",
	setup() {
		return () =>
			h("div", [
				h("h1", { class: "h1" }, "Blog"),
				h(
					"div",
					{ class: "grid cols-2" },
					blogPosts.map((post) =>
						h(
							RouterLink,
							{
								key: post.slug,
								to: `/blog/${post.slug}`,
								"data-testid": "blog-post-card",
								class: "card",
							},
							{
								default: () => [
									h("div", { style: { fontWeight: "700" } }, post.title),
									h("div", { class: "small muted" }, `${post.dateISO} • ${post.readingMinutes} min read`),
									h("p", { class: "muted" }, post.excerpt),
								],
							},
						),
					),
				),
			]);
	},
});
