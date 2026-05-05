import { useState, useEffect } from "hono/jsx";

interface MediaItem {
	id: string;
	title: string;
	channel: string;
	publishedISO: string;
	description: string;
}

declare global {
	interface Window {
		__CF_BENCH__: {
			media?: {
				ready?: boolean;
				openDurationMs?: number;
				nextDurationMs?: number;
				currentId?: string;
				error?: boolean;
				errorMessage?: string;
			};
			hydration?: { startMs?: number; endMs?: number };
		};
	}
}

function getBench() {
	const g = globalThis as typeof globalThis & { __CF_BENCH__: Window["__CF_BENCH__"] };
	g.__CF_BENCH__ = g.__CF_BENCH__ || {};
	const media = (g.__CF_BENCH__.media = g.__CF_BENCH__.media || { ready: false });
	return media;
}

export default function MediaIsland() {
	const [items, setItems] = useState<MediaItem[]>([]);
	const [selected, setSelected] = useState(0);
	const [loaded, setLoaded] = useState(false);

	useEffect(() => {
		fetch("/api/media?pageSize=30")
			.then((res) => res.json())
			.then((payload: { results?: MediaItem[] }) => {
				const list = Array.isArray(payload?.results) ? payload.results : [];
				setItems(list);
				setLoaded(true);
				const media = getBench();
				media.ready = true;
				if (list.length > 0) media.currentId = list[0].id;
			})
			.catch((err: Error) => {
				setLoaded(true);
				const media = getBench();
				media.ready = true;
				media.error = true;
				media.errorMessage = err?.message ?? String(err);
			});
	}, []);

	function openAt(index: number) {
		const started = performance.now();
		setSelected(index);
		requestAnimationFrame(() => {
			const media = getBench();
			media.openDurationMs = Math.max(1, performance.now() - started);
			media.currentId = items[index]?.id;
			media.ready = true;
		});
	}

	function nextItem() {
		if (!items.length) return;
		const started = performance.now();
		const next = (selected + 1) % items.length;
		setSelected(next);
		requestAnimationFrame(() => {
			const media = getBench();
			media.nextDurationMs = Math.max(1, performance.now() - started);
			media.currentId = items[next]?.id;
			media.ready = true;
		});
	}

	const current = items[selected];

	return (
		<div class="grid cols-2">
			<div class="card">
				<h2 style="margin-top:0">Feed</h2>
				<div id="media-list" class="grid" style="max-height:540px; overflow:auto">
					{!loaded && <button class="btn" data-testid="media-card">Loading media…</button>}
					{loaded && items.length === 0 && <div class="muted">No media.</div>}
					{items.map((item, i) => (
						<button
							class="btn"
							data-testid="media-card"
							style="text-align:left"
							onClick={() => openAt(i)}
						>
							<div>
								<strong>{item.title}</strong>
							</div>
							<div class="small muted">{item.channel}</div>
						</button>
					))}
				</div>
			</div>
			<div class="card">
				<h2 style="margin-top:0">Player</h2>
				<div data-testid="media-player" id="media-player">
					{current ? (
						<div>
							<div>
								<strong>{current.title}</strong>
							</div>
							<div class="small muted">
								{current.channel} &bull; {current.publishedISO}
							</div>
							<p class="muted">{current.description}</p>
						</div>
					) : (
						<span class="muted">Select a media item.</span>
					)}
				</div>
				<button class="btn" data-testid="media-next" id="media-next" style="margin-top:12px" onClick={nextItem}>
					Next
				</button>
			</div>
		</div>
	);
}
