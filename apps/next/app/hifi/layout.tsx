export default function HifiLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <script async src="/__bench/sdk/maps.js" />
      <script async src="/__bench/sdk/analytics.js" />
      {children}
    </>
  );
}
