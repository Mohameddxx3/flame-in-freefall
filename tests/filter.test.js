import { describe, it, expect } from "vitest";
import { applyFilters, getFacets, defaultFilters, sortRows } from "../src/lib/filter.js";
import { score } from "../src/lib/hazard.js";

// Inline dataset. Each case is covered on purpose, and no expected value depends on mock-experiments.json.
// Hazard scores are computed by score() with the default weights (0.55 / 0.10 / 0.35).
//   T-A: spread 3, O2 21.7, 320 s  -> 65
//   T-B: spread 5, O2 22.0, 45 s   -> 75
//   T-F: spread 2, O2 16.0, 90 s   -> 49
//   T-G: spread 2, O2 null, no duration -> 25 (partial)
//   T-C, T-D, T-E: not scoring_eligible -> hazard null
const raw = [
    {
        id: "T-A",
        name: "Cotton fabric upward",
        program: "Saffire",
        fuel_type: "Cotton",
        fuel_category: "Solid",
        gravity_level: "Microgravity (0g)",
        o2_percent: 21.7,
        spread_class: 3,
        duration_seconds: 320,
        scoring_eligible: true,
        flame_behavior: "Flame spreads along the fabric",
    },
    {
        id: "T-B",
        name: "PMMA slab",
        program: "BASS",
        fuel_type: "PMMA (acrylic)",
        fuel_category: "Solid",
        gravity_level: "Microgravity (0g)",
        o2_percent: 22.0,
        spread_class: 5,
        duration_seconds: 45,
        scoring_eligible: true,
        flame_behavior: "Dim blue flame that can flare up",
    },
    {
        id: "T-C",
        name: "Heptane droplet",
        program: "FLEX",
        fuel_type: "Heptane",
        fuel_category: "Liquid",
        gravity_level: "Microgravity (0g)",
        o2_percent: 21.0,
        spread_class: null,
        duration_seconds: 60,
        scoring_eligible: false,
        flame_behavior: "Spherical flame around the droplet",
    },
    {
        id: "T-D",
        name: "Methane diffusion",
        program: "BASS",
        fuel_type: "Methane",
        fuel_category: "Gas",
        gravity_level: "Microgravity (0g)",
        o2_percent: 23.0,
        spread_class: null,
        duration_seconds: 120,
        scoring_eligible: false,
        flame_behavior: "Diffusion flame on a fuel stream",
    },
    {
        id: "T-E",
        name: "Earth cotton fabric",
        program: "Earth reference",
        fuel_type: "Cotton",
        fuel_category: "Solid",
        gravity_level: "Earth (1g)",
        o2_percent: 21.0,
        spread_class: 4,
        duration_seconds: 150,
        scoring_eligible: false,
        flame_behavior: "Flame rises due to convection",
    },
    {
        id: "T-F",
        name: "Polyethylene strip",
        program: "Saffire",
        fuel_type: "Polyethylene",
        fuel_category: "Solid",
        gravity_level: "Microgravity (0g)",
        o2_percent: 16.0,
        spread_class: 2,
        duration_seconds: 90,
        scoring_eligible: true,
        flame_behavior: "Flame weakens at low oxygen",
    },
    {
        id: "T-G",
        name: "Null oxygen fabric",
        program: "Saffire",
        fuel_type: "Cotton",
        fuel_category: "Solid",
        gravity_level: "Microgravity (0g)",
        o2_percent: null,
        spread_class: 2,
        duration_seconds: null,
        scoring_eligible: true,
        flame_behavior: "Missing oxygen value",
    },
];
const data = raw.map((row) => ({ ...row, hazard: score(row) }));

const f = (patch) => ({ ...defaultFilters(), ...patch });
const ids = (rows) => rows.map((r) => r.id);
const sorted = (rows) => ids(rows).sort();

describe("hazard values used by these tests", () => {
    it("computes the expected scores", () => {
        const byId = Object.fromEntries(data.map((r) => [r.id, r.hazard?.score ?? null]));
        expect(byId).toEqual({
            "T-A": 65,
            "T-B": 75,
            "T-C": null,
            "T-D": null,
            "T-E": null,
            "T-F": 49,
            "T-G": 25,
        });
        expect(data.find((r) => r.id === "T-G").hazard.partial).toBe(true);
    });
});

describe("applyFilters: basics", () => {
    it("returns all rows with default filters, hazard descending", () => {
        expect(ids(applyFilters(data, defaultFilters()))).toEqual([
            "T-B",
            "T-A",
            "T-F",
            "T-G",
            "T-C",
            "T-D",
            "T-E",
        ]);
    });

    it("returns an empty array for empty input", () => {
        expect(applyFilters([], defaultFilters())).toEqual([]);
    });

    it("does not mutate the input array or its rows", () => {
        const before = structuredClone(data);
        applyFilters(data, f({ sort: { key: "name", dir: "asc" }, fuelCategory: ["Solid"] }));
        expect(data).toEqual(before);
    });

    it("returns an empty array when nothing matches", () => {
        expect(applyFilters(data, f({ fuelType: ["Paper"] }))).toEqual([]);
    });
});

describe("applyFilters: list fields", () => {
    it("uses OR inside one field", () => {
        expect(ids(applyFilters(data, f({ fuelCategory: ["Liquid", "Gas"] })))).toEqual([
            "T-C",
            "T-D",
        ]);
    });

    it("uses AND across fields", () => {
        expect(ids(applyFilters(data, f({ fuelCategory: ["Solid"], program: ["BASS"] })))).toEqual([
            "T-B",
        ]);
    });

    it("combines Solid and Saffire", () => {
        expect(
            ids(applyFilters(data, f({ fuelCategory: ["Solid"], program: ["Saffire"] })))
        ).toEqual(["T-A", "T-F", "T-G"]);
    });

    it("filters by gravity level", () => {
        expect(ids(applyFilters(data, f({ gravity: ["Earth (1g)"] })))).toEqual(["T-E"]);
    });
});

describe("applyFilters: O2 range", () => {
    it("hides null-O2 rows while an O2 range is set", () => {
        expect(sorted(applyFilters(data, f({ o2: { min: 20, max: 30 } })))).toEqual([
            "T-A",
            "T-B",
            "T-C",
            "T-D",
            "T-E",
        ]);
    });

    it("keeps null-O2 rows when no O2 filter is set", () => {
        expect(ids(applyFilters(data, defaultFilters()))).toContain("T-G");
    });

    it("includes both edges of the range", () => {
        expect(sorted(applyFilters(data, f({ o2: { min: 21, max: 22 } })))).toEqual([
            "T-A",
            "T-B",
            "T-C",
            "T-E",
        ]);
    });

    it("supports min only", () => {
        expect(ids(applyFilters(data, f({ o2: { min: 22.5, max: null } })))).toEqual(["T-D"]);
    });

    it("supports max only", () => {
        expect(ids(applyFilters(data, f({ o2: { min: null, max: 16 } })))).toEqual(["T-F"]);
    });
});

describe("applyFilters: O2 buckets (FR-EX-02)", () => {
    it("below21 selects O2 under 21", () => {
        expect(
            ids(applyFilters(data, f({ o2: { min: null, max: null, buckets: ["below21"] } })))
        ).toEqual(["T-F"]);
    });

    it('"21" selects 21 up to 22 (exclusive)', () => {
        expect(
            sorted(applyFilters(data, f({ o2: { min: null, max: null, buckets: ["21"] } })))
        ).toEqual(["T-A", "T-C", "T-E"]);
    });

    it('"22-30" selects 22 to 30 inclusive', () => {
        expect(
            sorted(applyFilters(data, f({ o2: { min: null, max: null, buckets: ["22-30"] } })))
        ).toEqual(["T-B", "T-D"]);
    });

    it("combines buckets with OR", () => {
        expect(
            sorted(
                applyFilters(
                    data,
                    f({ o2: { min: null, max: null, buckets: ["below21", "22-30"] } })
                )
            )
        ).toEqual(["T-B", "T-D", "T-F"]);
    });

    it("hides null-O2 rows when a bucket is set", () => {
        expect(
            ids(applyFilters(data, f({ o2: { min: null, max: null, buckets: ["21"] } })))
        ).not.toContain("T-G");
    });
});

describe("applyFilters: free-text query", () => {
    it("matches fuel type case-insensitively", () => {
        expect(ids(applyFilters(data, f({ query: "pmma" })))).toEqual(["T-B"]);
    });

    it("matches flame behavior text", () => {
        expect(ids(applyFilters(data, f({ query: "FLARE" })))).toEqual(["T-B"]);
    });

    it("matches program name", () => {
        expect(sorted(applyFilters(data, f({ query: "saffire" })))).toEqual(["T-A", "T-F", "T-G"]);
    });

    it("matches row id", () => {
        expect(ids(applyFilters(data, f({ query: "t-c" })))).toEqual(["T-C"]);
    });

    it("treats regex characters as plain text", () => {
        expect(() => applyFilters(data, f({ query: "(*[" }))).not.toThrow();
        expect(applyFilters(data, f({ query: "(*[" }))).toEqual([]);
    });

    it("matches parentheses literally", () => {
        expect(ids(applyFilters(data, f({ query: "(acrylic)" })))).toEqual(["T-B"]);
    });

    it("handles Arabic text without throwing", () => {
        expect(applyFilters(data, f({ query: "احتراق" }))).toEqual([]);
    });

    it("ignores surrounding spaces", () => {
        expect(ids(applyFilters(data, f({ query: "   pmma   " })))).toEqual(["T-B"]);
    });
});

describe("applyFilters: combined filters", () => {
    it("applies list, O2 range and query together", () => {
        const rows = applyFilters(
            data,
            f({ fuelCategory: ["Solid"], o2: { min: 21, max: 22 }, query: "fabric" })
        );
        expect(ids(rows)).toEqual(["T-A", "T-E"]);
    });
});

describe("sortRows", () => {
    it("sorts by hazard descending with nulls last", () => {
        expect(ids(sortRows(data, { key: "hazard", dir: "desc" }))).toEqual([
            "T-B",
            "T-A",
            "T-F",
            "T-G",
            "T-C",
            "T-D",
            "T-E",
        ]);
    });

    it("sorts by hazard ascending with nulls still last", () => {
        expect(ids(sortRows(data, { key: "hazard", dir: "asc" }))).toEqual([
            "T-G",
            "T-F",
            "T-A",
            "T-B",
            "T-C",
            "T-D",
            "T-E",
        ]);
    });

    it("sorts by name ascending", () => {
        expect(ids(sortRows(data, { key: "name", dir: "asc" }))).toEqual([
            "T-A",
            "T-E",
            "T-C",
            "T-D",
            "T-G",
            "T-B",
            "T-F",
        ]);
    });

    it("sorts by O2 descending with nulls last", () => {
        expect(ids(sortRows(data, { key: "o2", dir: "desc" }))).toEqual([
            "T-D",
            "T-B",
            "T-A",
            "T-C",
            "T-E",
            "T-F",
            "T-G",
        ]);
    });

    it("sorts by duration ascending with nulls last", () => {
        expect(ids(sortRows(data, { key: "duration", dir: "asc" }))).toEqual([
            "T-B",
            "T-C",
            "T-F",
            "T-D",
            "T-E",
            "T-A",
            "T-G",
        ]);
    });

    it("keeps input order for an unknown sort key", () => {
        expect(ids(sortRows(data, { key: "nope", dir: "asc" }))).toEqual([
            "T-A",
            "T-B",
            "T-C",
            "T-D",
            "T-E",
            "T-F",
            "T-G",
        ]);
    });

    it("keeps input order when sort is null", () => {
        expect(ids(sortRows(data, null))).toEqual([
            "T-A",
            "T-B",
            "T-C",
            "T-D",
            "T-E",
            "T-F",
            "T-G",
        ]);
    });

    it("is stable for equal values", () => {
        const rows = [
            { id: "x", o2_percent: 21 },
            { id: "y", o2_percent: 21 },
            { id: "z", o2_percent: 20 },
        ];
        expect(ids(sortRows(rows, { key: "o2", dir: "desc" }))).toEqual(["x", "y", "z"]);
    });

    it("does not mutate the input array", () => {
        const copy = [...data];
        sortRows(data, { key: "name", dir: "asc" });
        expect(data).toEqual(copy);
    });
});

describe("getFacets", () => {
    it("counts fuel categories", () => {
        expect(getFacets(data).fuelCategory).toEqual([
            { value: "Gas", count: 1 },
            { value: "Liquid", count: 1 },
            { value: "Solid", count: 5 },
        ]);
    });

    it("counts programs", () => {
        expect(getFacets(data).program).toEqual([
            { value: "BASS", count: 2 },
            { value: "Earth reference", count: 1 },
            { value: "FLEX", count: 1 },
            { value: "Saffire", count: 3 },
        ]);
    });

    it("counts gravity levels", () => {
        expect(getFacets(data).gravity).toEqual([
            { value: "Earth (1g)", count: 1 },
            { value: "Microgravity (0g)", count: 6 },
        ]);
    });

    it("reports the O2 range and unknown count, and lists the fixed buckets", () => {
        expect(getFacets(data).o2).toEqual({
            min: 16,
            max: 23,
            unknownCount: 1,
            buckets: ["below21", "21", "22-30", "above30"],
        });
    });

    it("returns null O2 bounds for empty data", () => {
        const o2 = getFacets([]).o2;
        expect(o2.min).toBeNull();
        expect(o2.max).toBeNull();
    });
});
