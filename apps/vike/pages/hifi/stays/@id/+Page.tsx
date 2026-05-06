import { useEffect } from "react";
import { attachHifiBookingForms, getHifiStayDetailParts } from "@cf-bench/hifi-shell";
import { useData } from "vike-react/useData";
import type { Data } from "./+data";

export default function Page() {
  const { listing } = useData<Data>();
  const parts = getHifiStayDetailParts(listing ?? undefined);
  const bodyHtml = listing ? parts.body : parts.notFound;

  useEffect(() => {
    attachHifiBookingForms();
  }, []);

  return <div dangerouslySetInnerHTML={{ __html: bodyHtml }} />;
}
