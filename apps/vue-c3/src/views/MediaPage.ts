import type { MediaItem } from "@cf-bench/dataset";
import { queryMedia } from "@cf-bench/dataset";
import { computed, defineComponent, h, onMounted, ref } from "vue";

function ensureBenchMedia() {
	const w = window as typeof window & { __CF_BENCH__?: Record<string, any> };
	w.__CF_BENCH__ = w.__CF_BENCH__ || {};
	w.__CF_BENCH__.media = w.__CF_BENCH__.media || { ready: false };
	return w.__CF_BENCH__.media;
}

export default defineComponent({
	name: "MediaPage",
	setup() {
		const items = queryMedia({ pageSize: 20 }).results;
		const selectedIndex = ref(0);
		const showPoster = ref(false);
		const selected = computed<MediaItem | null>(() => items[selectedIndex.value] ?? null);

		onMounted(() => {
			const media = ensureBenchMedia();
			media.ready = true;
			media.currentId = items[0]?.id || null;
		});

		function openByIndex(index: number) {
			const start = performance.now();
			selectedIndex.value = index;
			showPoster.value = true;
			requestAnimationFrame(() => {
				const media = ensureBenchMedia();
				media.openDurationMs = performance.now() - start;
				media.ready = true;
				media.currentId = items[index]?.id || null;
			});
		}

		function nextItem() {
			if (!items.length) return;
			const start = performance.now();
			const next = (selectedIndex.value + 1) % items.length;
			selectedIndex.value = next;
			showPoster.value = true;
			requestAnimationFrame(() => {
				const media = ensureBenchMedia();
				media.nextDurationMs = performance.now() - start;
				media.ready = true;
				media.currentId = items[next]?.id || null;
			});
		}

		return () =>
			h("div", [
				h("h1", { class: "h1" }, "Media Feed (SPA-like)"),
				h("div", { class: "grid cols-2", style: { gap: "16px" } }, [
					h("div", { class: "card", style: { padding: "14px" } }, [
						h("h2", { style: { marginTop: 0 } }, "Feed"),
						h(
							"div",
							{ style: { display: "grid", gap: "10px", maxHeight: "560px", overflow: "auto" } },
							items.map((item, index) =>
								h(
									"button",
									{
										key: item.id,
										"data-testid": "media-card",
										class: "card",
										style: {
											padding: "10px",
											textAlign: "left",
											background: "var(--panel)",
											cursor: "pointer",
											border: index === selectedIndex.value ? "1px solid var(--text)" : "1px solid var(--border)",
										},
										onClick: () => openByIndex(index),
									},
									[
										h("div", { style: { fontWeight: 600 } }, item.title),
										h("div", { class: "muted small" }, `${item.channel} • ${item.publishedISO}`),
									],
								),
							),
						),
					]),
					h("div", { class: "card", style: { padding: "14px" } }, [
						h("h2", { style: { marginTop: 0 } }, "Player"),
						h("div", { "data-testid": "media-player", style: { minHeight: "260px" } }, [
							selected.value
								? [
										showPoster.value
											? h("img", {
													src: selected.value.thumbnail,
													alt: selected.value.title,
													loading: "lazy",
													decoding: "async",
													fetchpriority: "low",
													style: {
														width: "100%",
														maxHeight: "280px",
														objectFit: "cover",
														borderRadius: "10px",
													},
												})
											: null,
										h("h3", selected.value.title),
										h("p", { class: "muted small" }, `${selected.value.channel} • ${selected.value.views.toLocaleString()} views`),
										h("p", { class: "muted" }, selected.value.description),
									]
								: h("p", { class: "muted" }, "Select a media item."),
						]),
						h(
							"button",
							{
								"data-testid": "media-next",
								class: "btn",
								disabled: !items.length,
								onClick: nextItem,
							},
							"Next",
						),
					]),
				]),
			]);
	},
});
