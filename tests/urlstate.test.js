import { describe, it, expect } from "vitest";
import {
    encodeState,
    decodeState,
    getRoute,
    MAX_QUERY_LENGTH,
    MAX_COMPARE,
} from "../src/lib/urlstate.js";
import { defaultFilters } from "../src/lib/filter.js";

// Builds a filter object, merging o2 so the buckets key is always present (matches defaultFilters()).
const f = (patch = {}) => ({
    ...defaultFilters(),
    ...patch,
    o2: { ...defaultFilters().o2, ...(patch.o2 ?? {}) },
});

describe("encodeState", () => {
    it("encodes default filters as just the route", () => {
        expect(encodeState(defaultFilters())).toBe("#/explore");
    });

    it("replaces an invalid route with explore", () => {
        expect(encodeState(defaultFilters(), "bad?route")).toBe("#/explore");
        expect(encodeState(defaultFilters(), "#evil")).toBe("#/explore");
    });

    it("writes compare IDs once each, drops invalid IDs, and caps at MAX_COMPARE", () => {
        const hash = encodeState(
            f({ compare: ["SAF-01", "bad id,x", "SAF-01", "SAF-02", "SAF-03", "SAF-04"] })
        );
        expect(decodeState(hash).compare).toEqual(["SAF-01", "SAF-02", "SAF-03"]);
        expect(decodeState(hash).compare.length).toBeLessThanOrEqual(MAX_COMPARE);
    });
});

describe("round-trip: decodeState(encodeState(x)) === x", () => {
    it("restores a full filter object", () => {
        const filters = f({
            fuelCategory: ["Solid"],
            fuelType: ["PMMA", "SIBAL fabric"],
            gravity: ["Microgravity (0g)"],
            o2: { min: 21, max: 30 },
            query: "blue flame",
            sort: { key: "o2", dir: "asc" },
            compare: ["SAF-01", "SAF-04"],
        });
        expect(decodeState(encodeState(filters))).toEqual(filters);
    });

    it("keeps | and , inside list values", () => {
        const filters = f({ fuelType: ["a|b", "c,d"] });
        expect(decodeState(encodeState(filters)).fuelType).toEqual(["a|b", "c,d"]);
    });

    it("keeps %, +, &, =, spaces and parentheses inside list values", () => {
        const tricky = ["50%", "a+b", "x&y", "k=v", "Microgravity (0g)", "two  spaces"];
        const filters = f({ fuelType: tricky });
        expect(decodeState(encodeState(filters)).fuelType).toEqual(tricky);
    });

    it("keeps Arabic text in list values and in the query", () => {
        const filters = f({ fuelType: ["خشب"], query: "احتراق الورق" });
        const back = decodeState(encodeState(filters));
        expect(back.fuelType).toEqual(["خشب"]);
        expect(back.query).toBe("احتراق الورق");
    });

    it("keeps special characters in the query", () => {
        const q = 'pmma & 50% + "quote" = x|y';
        expect(decodeState(encodeState(f({ query: q }))).query).toBe(q);
    });

    it("restores a min-only O2 range", () => {
        const back = decodeState(encodeState(f({ o2: { min: 30, max: null } })));
        expect(back.o2.min).toBe(30);
        expect(back.o2.max).toBeNull();
    });

    it("restores a max-only O2 range", () => {
        const back = decodeState(encodeState(f({ o2: { min: null, max: 21 } })));
        expect(back.o2.min).toBeNull();
        expect(back.o2.max).toBe(21);
    });

    it("restores O2 buckets", () => {
        const filters = f({ o2: { min: null, max: null, buckets: ["below21", "22-30"] } });
        expect(decodeState(encodeState(filters)).o2.buckets).toEqual(["below21", "22-30"]);
    });
});

describe("decodeState: validation", () => {
    it("returns default filters when there is no question mark", () => {
        expect(decodeState("#/explore")).toEqual(defaultFilters());
    });

    it("never throws on malformed hashes", () => {
        const hashes = [
            "",
            "#",
            "#/explore?",
            "#/explore?o2=abc",
            "#/explore?sort=bad",
            "#/explore?fuel=%E0%A4%A",
            "#/explore?cmp=,,,",
            "#/explore?o2b=%",
            "#/explore?q=%",
            "#" + "x".repeat(5000),
        ];
        for (const hash of hashes) {
            expect(() => decodeState(hash)).not.toThrow();
        }
    });

    it("ignores unknown keys and invalid values", () => {
        expect(decodeState("#/explore?evil=1&o2=abc&sort=bad.up")).toEqual(defaultFilters());
    });

    it("rejects an O2 range where min is greater than max", () => {
        const o2 = decodeState("#/explore?o2=30-21").o2;
        expect(o2.min).toBeNull();
        expect(o2.max).toBeNull();
    });

    it("rejects non-numeric O2 bounds such as exponents or hex", () => {
        expect(decodeState("#/explore?o2=1e3-").o2.min).toBeNull();
        expect(decodeState("#/explore?o2=0x10-").o2.min).toBeNull();
    });

    it("keeps only valid bucket names", () => {
        expect(decodeState("#/explore?o2b=foo|22-30").o2.buckets).toEqual(["22-30"]);
    });

    it("parses a valid sort and ignores an invalid one", () => {
        expect(decodeState("#/explore?sort=o2.asc").sort).toEqual({ key: "o2", dir: "asc" });
        expect(decodeState("#/explore?sort=o2.up").sort).toEqual(defaultFilters().sort);
        expect(decodeState("#/explore?sort=nope.asc").sort).toEqual(defaultFilters().sort);
    });

    it("limits compare to MAX_COMPARE ids and removes duplicates", () => {
        expect(decodeState("#/explore?cmp=a,b,c,d,e").compare).toEqual(["a", "b", "c"]);
        expect(decodeState("#/explore?cmp=SAF-01,SAF-01").compare).toEqual(["SAF-01"]);
    });

    it("caps the query at MAX_QUERY_LENGTH on both sides", () => {
        const long = "x".repeat(300);
        expect(decodeState(encodeState(f({ query: long }))).query.length).toBe(MAX_QUERY_LENGTH);
        expect(decodeState(`#/explore?q=${long}`).query.length).toBe(MAX_QUERY_LENGTH);
    });
});

describe("getRoute", () => {
    it("reads the route before the question mark", () => {
        expect(getRoute("#/explore?fuel=PMMA")).toBe("explore");
        expect(getRoute("#/insights")).toBe("insights");
    });

    it("returns an empty string when there is no route", () => {
        expect(getRoute("")).toBe("");
        expect(getRoute("#/")).toBe("");
    });

    it("returns an empty string for an uppercase or invalid route", () => {
        expect(getRoute("#/Explore")).toBe("");
        expect(getRoute("#/bad!name")).toBe("");
    });

    it("uses only the first path segment", () => {
        expect(getRoute("#/explore/extra")).toBe("explore");
    });
});
