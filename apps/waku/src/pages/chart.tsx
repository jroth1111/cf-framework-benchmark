import { ChartClient } from '../components/ChartClient';

export default async function ChartPage() {
  return (
    <>
      <title>CF Bench Waku Chart</title>
      <section className="hero">
        <p className="eyebrow">Chart</p>
        <h1 className="h1">Chart flow</h1>
        <p className="muted">Client-hydrated canvas chart with Workers-backed price data.</p>
      </section>
      <ChartClient />
    </>
  );
}

export const getConfig = async () => ({ render: 'static' } as const);
