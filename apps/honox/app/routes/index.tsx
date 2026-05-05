export const title = "honox benchmark";

export default function Home() {
	return (
		<div>
			<h1 class="h1">Framework benchmark harness</h1>
			<div class="grid cols-3">
				<div class="card">
					<h2>MPA listing flow</h2>
					<p class="muted">Listing index + detail routes.</p>
					<p>
						<a class="pill" href="/stays">Open stays</a>
					</p>
				</div>
				<div class="card">
					<h2>SPA chart flow</h2>
					<p class="muted">Interactive chart controls + canvas.</p>
					<p>
						<a class="pill" href="/chart">Open chart</a>
					</p>
				</div>
				<div class="card">
					<h2>Media feed flow</h2>
					<p class="muted">Open + next interactions with markers.</p>
					<p>
						<a class="pill" href="/media">Open media</a>
					</p>
				</div>
			</div>
		</div>
	);
}
