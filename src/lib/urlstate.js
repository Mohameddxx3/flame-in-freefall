// BE-13. Hash scheme (SRS A.3):
// #/explore?cat=Solid&fuel=PMMA&g=Microgravity%20(0g)&o2=21-30&o2b=22-30|above30&q=pmma&sort=hazard.desc&cmp=SAF-01,SAF-04
//
// Encoding rules (one scheme, used everywhere):
// - Scalar values: encodeURIComponent once.
// - List values (cat, fuel, prog, g, o2b): each item is encodeURIComponent'd, joined with '|',
//   then the whole string is encodeURIComponent'd once more. This keeps '|', '&', '=', '%' safe.
// - cmp: IDs are validated against ID_RE (no ',' or '|' inside), so it stays comma-separated as in SRS A.3.
// Parsing is manual (no URLSearchParams), so a raw '+' is never turned into a space.
// The router reads only the part before '?'. decodeState reads only the part after it. Neither throws.
import { defaultFilters, O2_BUCKETS } from "./filter.js";

const LIST_KEYS = { fuelCategory: "cat", fuelType: "fuel", program: "prog", gravity: "g" };
const SORT_KEYS = ["name", "o2", "duration", "hazard"];
const SORT_DIRS = ["asc", "desc"];
const ROUTE_RE = /^[a-z]+$/;
const NUMBER_RE = /^\d+(\.\d+)?$/;
const ID_RE = /^[A-Za-z0-9-]+$/;
export const MAX_QUERY_LENGTH = 200;
export const MAX_COMPARE = 3;

function safeDecode(text) {
    try {
        return decodeURIComponent(text);
    } catch {
        return null;
    }
}

function encodeList(list) {
    return encodeURIComponent(list.map((v) => encodeURIComponent(String(v))).join("|"));
}

function decodeList(raw) {
    const outer = safeDecode(raw);
    if (outer === null) return [];
    return outer
        .split("|")
        .map(safeDecode)
        .filter((v) => v !== null && v !== "");
}

/** Splits the query part (after '?') into raw, still-encoded values. First occurrence wins. */
function parseParams(text) {
    const params = new Map();
    for (const segment of text.split("&")) {
        if (!segment) continue;
        const eq = segment.indexOf("=");
        const key = eq === -1 ? segment : segment.slice(0, eq);
        const value = eq === -1 ? "" : segment.slice(eq + 1);
        if (!params.has(key)) params.set(key, value);
    }
    return params;
}

/** Route name from a hash like '#/explore?x=1' -> 'explore'. Returns '' if missing or invalid. */
export function getRoute(hash = "") {
    const path = String(hash).replace(/^#\/?/, "").split("?")[0];
    const route = path.split("/")[0];
    return ROUTE_RE.test(route) ? route : "";
}

export function encodeState(filters = defaultFilters(), route = "explore") {
    const base = defaultFilters();
    const f = { ...base, ...filters, o2: { ...base.o2, ...(filters?.o2 ?? {}) } };
    const safeRoute = ROUTE_RE.test(route) ? route : "explore";
    const parts = [];

    for (const [field, short] of Object.entries(LIST_KEYS)) {
        if (f[field]?.length) parts.push(`${short}=${encodeList(f[field])}`);
    }

    const { min, max } = f.o2;
    if (typeof min === "number" || typeof max === "number") {
        parts.push(
            `o2=${typeof min === "number" ? min : ""}-${typeof max === "number" ? max : ""}`
        );
    }

    const buckets = (f.o2.buckets ?? []).filter((b) => O2_BUCKETS.includes(b));
    if (buckets.length) parts.push(`o2b=${encodeList(buckets)}`);

    const query = f.query.trim().slice(0, MAX_QUERY_LENGTH).trim();
    if (query) parts.push(`q=${encodeURIComponent(query)}`);

    const def = base.sort;
    if (
        SORT_KEYS.includes(f.sort.key) &&
        SORT_DIRS.includes(f.sort.dir) &&
        (f.sort.key !== def.key || f.sort.dir !== def.dir)
    ) {
        parts.push(`sort=${f.sort.key}.${f.sort.dir}`);
    }

    const cmp = [...new Set((f.compare ?? []).map(String))]
        .filter((id) => ID_RE.test(id))
        .slice(0, MAX_COMPARE);
    if (cmp.length) parts.push(`cmp=${encodeURIComponent(cmp.join(","))}`);

    return `#/${safeRoute}${parts.length ? `?${parts.join("&")}` : ""}`;
}

/** Never throws. Unknown keys and invalid values are ignored. */
export function decodeState(hash = "") {
    const filters = defaultFilters();
    const text = String(hash);
    const queryStart = text.indexOf("?");
    if (queryStart === -1) return filters;
    const params = parseParams(text.slice(queryStart + 1));

    for (const [field, short] of Object.entries(LIST_KEYS)) {
        if (params.has(short)) filters[field] = decodeList(params.get(short));
    }

    if (params.has("o2b")) {
        filters.o2.buckets = decodeList(params.get("o2b")).filter((b) => O2_BUCKETS.includes(b));
    }

    if (params.has("o2")) {
        const parts = (safeDecode(params.get("o2")) ?? "").split("-");
        if (parts.length === 2) {
            const [minText, maxText] = parts;
            const min = NUMBER_RE.test(minText) ? Number(minText) : null;
            const max = NUMBER_RE.test(maxText) ? Number(maxText) : null;
            if (min === null || max === null || min <= max) {
                filters.o2.min = min;
                filters.o2.max = max;
            }
        }
    }

    if (params.has("q")) {
        const q = safeDecode(params.get("q")) ?? "";
        filters.query = q.trim().slice(0, MAX_QUERY_LENGTH).trim();
    }

    if (params.has("sort")) {
        const [key, dir] = (safeDecode(params.get("sort")) ?? "").split(".");
        if (SORT_KEYS.includes(key) && SORT_DIRS.includes(dir)) filters.sort = { key, dir };
    }

    if (params.has("cmp")) {
        const ids = (safeDecode(params.get("cmp")) ?? "")
            .split(",")
            .map((s) => s.trim())
            .filter((id) => ID_RE.test(id));
        filters.compare = [...new Set(ids)].slice(0, MAX_COMPARE);
    }

    return filters;
}
