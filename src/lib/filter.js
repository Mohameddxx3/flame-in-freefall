// BE-07 / BE-09. Pure functions, no DOM.
// Contract: docs/contracts.md and SRS 7.3 (lib/filter.js: applyFilters(data, filters) -> rows).

export const O2_BUCKETS = Object.freeze(["below21", "21", "22-30", "above30"]);

// Bucket boundaries from SRS FR-EX-02. Each bucket is half-open except the last range.
const O2_BUCKET_TESTS = Object.freeze({
    below21: (v) => v < 21,
    21: (v) => v >= 21 && v < 22,
    "22-30": (v) => v >= 22 && v <= 30,
    above30: (v) => v > 30,
});

/**
 * Default filter state.
 * - Empty arrays mean "no filter" for that field.
 * - o2 can be a range { min, max } or a list of buckets { buckets: [...] }. Use one or the other.
 * - sort: null or an unknown key keeps the input order.
 */
export const defaultFilters = () => ({
    fuelCategory: [],
    fuelType: [],
    program: [],
    gravity: [],
    o2: { min: null, max: null, buckets: [] },
    query: "",
    sort: { key: "hazard", dir: "desc" },
    compare: [],
});

const hazardOf = (row) =>
    row.hazard && typeof row.hazard.score === "number" ? row.hazard.score : null;

const SORT_VALUE = {
    name: (r) => (r.name ?? "").toLowerCase(),
    o2: (r) => (typeof r.o2_percent === "number" ? r.o2_percent : null),
    duration: (r) => (typeof r.duration_seconds === "number" ? r.duration_seconds : null),
    hazard: hazardOf,
};

const inList = (list, value) => !list || list.length === 0 || list.includes(value);

/**
 * Free-text search over name, fuel_type, flame_behavior, program and id (case-insensitive).
 * Program and id are included on purpose so users can type "Saffire" or "SAF-01".
 */
function matchesQuery(row, query) {
    const q = (query ?? "").trim().toLowerCase();
    if (!q) return true;
    const haystack = [row.name, row.fuel_type, row.flame_behavior, row.program, row.id]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
    return haystack.includes(q);
}

/**
 * O2 filter. Rows with null O2 stay visible only when no O2 filter is active.
 * Once any O2 filter is active (range or buckets), null-O2 rows are hidden.
 */
function matchesO2(row, o2) {
    const buckets = o2?.buckets ?? [];
    const { min, max } = o2 ?? {};
    const hasMin = typeof min === "number";
    const hasMax = typeof max === "number";
    const hasBuckets = buckets.length > 0;

    if (!hasMin && !hasMax && !hasBuckets) return true;
    if (typeof row.o2_percent !== "number") return false;

    if (hasBuckets) {
        // OR across the selected buckets.
        return buckets.some((b) => O2_BUCKET_TESTS[b]?.(row.o2_percent) === true);
    }
    if (hasMin && row.o2_percent < min) return false;
    if (hasMax && row.o2_percent > max) return false;
    return true;
}

/** AND across fields, OR inside a field. Returns a new array and never mutates `data`. */
export function applyFilters(data, filters = defaultFilters()) {
    const base = defaultFilters();
    const f = { ...base, ...filters, o2: { ...base.o2, ...(filters?.o2 ?? {}) } };

    const rows = data.filter(
        (row) =>
            inList(f.fuelCategory, row.fuel_category) &&
            inList(f.fuelType, row.fuel_type) &&
            inList(f.program, row.program) &&
            inList(f.gravity, row.gravity_level) &&
            matchesO2(row, f.o2) &&
            matchesQuery(row, f.query)
    );
    return sortRows(rows, f.sort);
}

/**
 * Stable sort. Null values always go last, in both directions.
 * Null or unknown sort keys return a copy in the input order.
 */
export function sortRows(rows, sort = { key: "hazard", dir: "desc" }) {
    const getValue = SORT_VALUE[sort?.key];
    if (!getValue) return [...rows];
    const dir = sort.dir === "asc" ? 1 : -1;
    return rows
        .map((row, index) => ({ row, index, value: getValue(row) }))
        .sort((a, b) => {
            if (a.value === null && b.value === null) return a.index - b.index;
            if (a.value === null) return 1;
            if (b.value === null) return -1;
            if (a.value < b.value) return -1 * dir;
            if (a.value > b.value) return 1 * dir;
            return a.index - b.index;
        })
        .map((x) => x.row);
}

/** Counts non-empty values of a field. Keys are coerced to strings so sorting never breaks. */
function countBy(data, key) {
    const counts = new Map();
    for (const row of data) {
        const value = row[key];
        if (value === null || value === undefined || value === "") continue;
        counts.set(value, (counts.get(value) ?? 0) + 1);
    }
    return [...counts.entries()]
        .map(([value, count]) => ({ value, count }))
        .sort((a, b) => String(a.value).localeCompare(String(b.value)));
}

/**
 * Options for the filter UI, built from the data so new rows appear with no code change.
 * o2.min and o2.max are the data bounds, used as the slider limits.
 * o2.buckets lists the fixed FR-EX-02 buckets for the bucket selector.
 */
export function getFacets(data) {
    const o2Values = data.map((r) => r.o2_percent).filter((v) => typeof v === "number");
    return {
        fuelCategory: countBy(data, "fuel_category"),
        fuelType: countBy(data, "fuel_type"),
        program: countBy(data, "program"),
        gravity: countBy(data, "gravity_level"),
        o2: {
            min: o2Values.length ? Math.min(...o2Values) : null,
            max: o2Values.length ? Math.max(...o2Values) : null,
            unknownCount: data.length - o2Values.length,
            buckets: [...O2_BUCKETS],
        },
    };
}
