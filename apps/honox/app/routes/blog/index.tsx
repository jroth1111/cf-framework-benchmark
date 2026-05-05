import { blogPosts } from "@cf-bench/dataset";

export const title = "Blog";

export default function Blog() {
	return (
		<div>
			<h1 class="h1">Blog</h1>
			<div class="grid cols-2">
				{blogPosts.map((post) => (
					<a class="card" data-testid="blog-post-card" href={`/blog/${post.slug}`}>
						<div style="font-weight:700">{post.title}</div>
						<div class="small muted">
							{post.dateISO} &bull; {post.readingMinutes} min read
						</div>
						<p class="muted">{post.excerpt}</p>
					</a>
				))}
			</div>
		</div>
	);
}
