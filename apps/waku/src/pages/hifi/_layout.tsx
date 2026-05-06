import type { ReactNode } from 'react';

type HifiLayoutProps = { children: ReactNode };

export default async function HifiLayout({ children }: HifiLayoutProps) {
  return (
    <>
      <script async src="/__bench/sdk/maps.js" />
      <script async src="/__bench/sdk/analytics.js" />
      {children}
    </>
  );
}

export const getConfig = async () =>
  ({
    render: 'static',
  }) as const;
