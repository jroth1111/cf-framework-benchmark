import { queryListings } from '@cf-bench/dataset';
import { renderHifiStaysListBody } from '@cf-bench/hifi-shell';

export default async function HifiStaysPage() {
  const listings = queryListings({ page: 1, pageSize: 12 }).results;
  const bodyHtml = renderHifiStaysListBody(listings);
  return (
    <>
      <title>Stays (hifi)</title>
      <div dangerouslySetInnerHTML={{ __html: bodyHtml }} />
    </>
  );
}

export const getConfig = async () => ({ render: 'static' } as const);
