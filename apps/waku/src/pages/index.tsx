export default async function HomePage() {
  return (
    <>
      <title>CF Bench</title>
      <section className="hero">
        <p className="eyebrow">Cloudflare Workers benchmark</p>
        <h1 className="h1">Cloudflare Framework Benchmark</h1>
        <p className="muted">
          Shared benchmark routes for stays, blog, chart, and media on Cloudflare Workers.
        </p>
      </section>
      <section className="grid cols-3 section">
        <a className="card feature-card" href="/stays">
          <strong>Stays flow</strong>
          <p className="muted">Multi-page listing index and detail routes with shared benchmark data.</p>
        </a>
        <a className="card feature-card" href="/chart">
          <strong>Chart flow</strong>
          <p className="muted">Interactive price chart with benchmark-ready controls and markers.</p>
        </a>
        <a className="card feature-card" href="/media">
          <strong>Media flow</strong>
          <p className="muted">Pre-rendered feed cards with client-side open and next interactions.</p>
        </a>
      </section>
    </>
  );
}
export const getConfig = async () => {
  return {
    render: 'static',
  } as const;
};
