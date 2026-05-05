import { createRoute } from "honox/factory";
import { getPost } from "@cf-bench/dataset";

export default createRoute((c) => {
	const slug = c.req.param("slug") ?? "";
	const post = getPost(slug);
	if (!post) {
		return c.render(
			<div>
				<h1 class="h1">Post not found</h1>
			</div>,
			{ title: "Post not found" }
		);
	}
	return c.render(
		<div>
			<a class="pill" href="/blog">
				← Back to blog
			</a>
			<h1 class="h1">{post.title}</h1>
			<div class="small muted">
				{post.dateISO} &bull; {post.readingMinutes} min read
			</div>
			<div class="card" style="margin-top:12px">
				<div data-testid="blog-html" dangerouslySetInnerHTML={{ __html: post.html }} />
			</div>
		</div>,
		{ title: post.title }
	);
});
