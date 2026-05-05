import { queryMedia } from '@cf-bench/dataset';
import { MediaClient } from '../components/MediaClient';

export default async function MediaPage() {
  const items = queryMedia({ page: 1, pageSize: 18 }).results;

  return (
    <>
      <title>CF Bench Media</title>
      <section className="hero">
        <p className="eyebrow">Media</p>
        <h1 className="h1">Media feed</h1>
        <p className="muted">Pre-rendered feed cards with client-side player interactions.</p>
      </section>
      <MediaClient items={items} />
    </>
  );
}

export const getConfig = async () => ({ render: 'static' } as const);
