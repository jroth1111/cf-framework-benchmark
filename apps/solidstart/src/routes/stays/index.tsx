import { Stays } from "../../../../solid/src/pages/Stays";
import { BenchHeaders } from "../../lib/headers";

export default function StaysPage() {
  return (
    <>
      <BenchHeaders cacheControl="public, max-age=0, s-maxage=60" />
      <Stays />
    </>
  );
}
