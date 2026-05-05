import { Home } from "../../../solid/src/pages/Home";
import { BenchHeaders } from "../lib/headers";

export default function IndexPage() {
  return (
    <>
      <BenchHeaders cacheControl="no-store" />
      <Home />
    </>
  );
}
