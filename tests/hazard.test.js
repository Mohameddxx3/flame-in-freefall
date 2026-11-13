import { describe, it, expect } from "vitest";
import {
    score,
    rankTop,
    durationTerm,
    validateWeights,
    DEFAULT_WEIGHTS,
} from "../src/lib/hazard.js";

const row = (patch) => ({
    scoring_eligible: true,
    spread_class: 3,
    o2_percent: 21.7,
    duration_seconds: 320,
    ...patch,
});

describe("durationTerm", () => {
    it("maps seconds to 1 / 0.5 / 0.25 at the thresholds", () => {
        expect(durationTerm(60)).toBe(1);
        expect(durationTerm(59)).toBe(0.5);
        expect(durationTerm(10)).toBe(0.5);
        expect(durationTerm(9.9)).toBe(0.25);
        expect(durationTerm(null)).toBe(null);
    });
});

describe("validateWeights", () => {
    it("accepts the default weights", () => {
        expect(() => validateWeights(DEFAULT_WEIGHTS)).not.toThrow();
    });
    it("throws when the weights do not sum to 1", () => {
        expect(() => validateWeights({ spread: 0.5, oxygen: 0.1, duration: 0.35 })).toThrow(
            /sum to 1/
        );
    });
    it("throws on a missing or negative weight", () => {
        expect(() => validateWeights({ spread: 0.55, oxygen: 0.1 })).toThrow();
        expect(() => validateWeights({ spread: 1.2, oxygen: -0.2, duration: 0 })).toThrow();
    });
});

describe("score", () => {
    it("matches a hand calculation (spread 3, O2 21.7, 320 s)", () => {
        // S = 0.5, O = 6.7 / 25 = 0.268, D = 1
        // 100 * (0.55*0.5 + 0.10*0.268 + 0.35*1) = 65.18 -> 65
        const result = score(row());
        expect(result.score).toBe(65);
        expect(result.partial).toBe(false);
        expect(result.breakdown.spread.used).toBe(true);
    });

    it("returns null for rows that are not scoring_eligible", () => {
        expect(score(row({ scoring_eligible: false }))).toBe(null);
        expect(score({})).toBe(null);
    });

    it("skips missing inputs and re-normalizes (partial)", () => {
        // S = 0.75, D = 0.25, O2 missing. score = round(100 * 0.5 / 0.9) = 56
        const result = score(row({ spread_class: 4, o2_percent: null, duration_seconds: 8 }));
        expect(result.score).toBe(56);
        expect(result.partial).toBe(true);
        expect(result.breakdown.oxygen.used).toBe(false);
    });

    it("clamps O2 below 15 to 0 and at or above 40 to 1", () => {
        expect(score(row({ o2_percent: 10 })).breakdown.oxygen.value).toBe(0);
        expect(score(row({ o2_percent: 40 })).breakdown.oxygen.value).toBe(1);
        expect(score(row({ o2_percent: 85 })).breakdown.oxygen.value).toBe(1);
    });

    it("gives score null when every input is missing", () => {
        const result = score(row({ spread_class: null, o2_percent: null, duration_seconds: null }));
        expect(result.score).toBe(null);
        expect(result.partial).toBe(true);
    });

    it("gives 100 for the worst case", () => {
        expect(score(row({ spread_class: 5, o2_percent: 40, duration_seconds: 600 })).score).toBe(
            100
        );
    });

    it("gives 9 for the mildest scored case (duration floor is 0.25, so 0 is not reachable)", () => {
        expect(score(row({ spread_class: 1, o2_percent: 15, duration_seconds: 1 })).score).toBe(9);
    });

    it("breakdown points always sum exactly to the score", () => {
        const cases = [
            row(),
            row({ spread_class: 4, o2_percent: null, duration_seconds: 8 }),
            row({ spread_class: 2, o2_percent: 30, duration_seconds: null }),
            row({ spread_class: 5, o2_percent: 16, duration_seconds: 12 }),
        ];
        for (const c of cases) {
            const result = score(c);
            const sum = Object.values(result.breakdown).reduce((s, b) => s + (b.points ?? 0), 0);
            expect(sum).toBe(result.score);
        }
    });

    it("default weights add up to 1", () => {
        const sum = Object.values(DEFAULT_WEIGHTS).reduce((a, b) => a + b, 0);
        expect(sum).toBeCloseTo(1, 10);
    });
});

describe("rankTop", () => {
    const rows = [
        { id: "a", name: "A", o2_percent: 21, hazard: { score: 50 } },
        { id: "b", name: "B", o2_percent: 22, hazard: { score: 50 } },
        { id: "c", name: "C", o2_percent: 21, hazard: { score: 80 } },
        { id: "d", name: "D", o2_percent: 21, hazard: null },
    ];

    it("returns the top N scored rows and skips unscored ones", () => {
        expect(rankTop(rows, 5).map((r) => r.id)).toEqual(["c", "b", "a"]);
        expect(rankTop(rows, 1).map((r) => r.id)).toEqual(["c"]);
    });

    it("breaks ties by name when score and O2 are equal", () => {
        const tied = [
            { id: "x", name: "Zeta", o2_percent: 21, hazard: { score: 40 } },
            { id: "y", name: "Alpha", o2_percent: 21, hazard: { score: 40 } },
        ];
        expect(rankTop(tied, 5).map((r) => r.id)).toEqual(["y", "x"]);
    });

    it("returns fewer rows when N is larger than the scored set", () => {
        expect(rankTop(rows, 10)).toHaveLength(3);
    });
});
