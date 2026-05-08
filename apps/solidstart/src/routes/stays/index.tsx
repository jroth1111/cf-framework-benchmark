import { Stays } from "../../../../solid/src/pages/Stays";
import { BenchHeaders } from "../../lib/headers";

export default function StaysPage() {
  return (
    <>
      <BenchHeaders routeId="/stays" />
      <Stays />
    </>
  );
}
