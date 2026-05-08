import { queryListings } from "@cf-bench/dataset";
import { renderHifiStaysListBody } from "@cf-bench/hifi-shell";

export function HifiStays() {
    const { results } = queryListings({ page: 1, pageSize: 12 });
    return (
        <>
            <script async src="/__bench/sdk/maps.js" />
            <script async src="/__bench/sdk/analytics.js" />
            <div dangerouslySetInnerHTML={{ __html: renderHifiStaysListBody(results) }} />
        </>
    );
}
