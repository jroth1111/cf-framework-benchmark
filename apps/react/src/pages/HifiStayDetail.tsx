import { useParams } from "react-router-dom";
import { getListing } from "@cf-bench/dataset";
import { getHifiStayDetailParts } from "@cf-bench/hifi-shell";

export function HifiStayDetail() {
    const { id } = useParams<{ id: string }>();
    const listing = id ? getListing(id) : undefined;
    const parts = getHifiStayDetailParts(listing);

    return (
        <>
            <div dangerouslySetInnerHTML={{ __html: parts.body }} />
            {parts.script ? <script dangerouslySetInnerHTML={{ __html: parts.script }} /> : null}
        </>
    );
}
