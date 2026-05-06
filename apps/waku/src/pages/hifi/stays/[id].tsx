import { getListing, listings } from '@cf-bench/dataset';
import { getHifiStayDetailParts } from '@cf-bench/hifi-shell';
import type { PageProps } from 'waku/router';
import { HifiBookingMount } from '../../../components/HifiBookingMount';

export default async function HifiStayDetailPage({ id }: PageProps<'/hifi/stays/[id]'>) {
  const listing = getListing(id);
  const parts = getHifiStayDetailParts(listing);
  const bodyHtml = listing ? parts.body : parts.notFound;
  const title = listing ? listing.title : 'Stay not found';

  return (
    <>
      <title>{title}</title>
      <div dangerouslySetInnerHTML={{ __html: bodyHtml }} />
      <HifiBookingMount />
    </>
  );
}

export const getConfig = async () =>
  ({
    render: 'static',
    staticPaths: listings.map((listing) => listing.id),
  }) as const;
