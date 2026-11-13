// BE-10 / BE-12. Runs in the BUILD script only (SRS 4.4: single source of truth).
// The UI and the assistant read row.hazard and never call score() themselves.
// row.hazard is written to experiments.json, so breakdown is available for the tooltip (FR-EX-09).

export const KEYS = Object.freeze(["spread", "oxygen", "duration"]);
export const DEFAULT_WEIGHTS = Object.freeze({ spread: 0.55, oxygen: 0.1, duration: 0.35 });

// Duration thresholds in seconds (SRS 4.4: minutes = 1, tens of seconds = 0.5, seconds = 0.25).
export const DURATION_THRESHOLDS = Object.freeze({ minutes: 60, tens: 10 });

const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
const isNum = (x) => typeof x === "number" && Number.isFinite(x);

/** Throws if weights are missing, negative, or do not sum to 1 (tolerance 1e-9). */
export function validateWeights(weights) {
    const errors = [];
    for (const k of KEYS) {
        if (!isNum(weights?.[k]) || weights[k] < 0) {
            errors.push(`weight "${k}" must be a number >= 0`);
        }
    }
    if (errors.length === 0) {
        const sum = KEYS.reduce((s, k) => s + weights[k], 0);
        if (Math.abs(sum - 1) > 1e-9) errors.push(`weights must sum to 1, got ${sum}`);
    }
    if (errors.length > 0) {
        throw new Error(`Invalid hazard weights: ${errors.join("; ")}`);
    }
    return weights;
}

/** D term from duration in seconds. Returns null when the duration is missing. */
export function durationTerm(seconds) {
    if (!isNum(seconds)) return null;
    if (seconds >= DURATION_THRESHOLDS.minutes) return 1;
    if (seconds >= DURATION_THRESHOLDS.tens) return 0.5;
    return 0.25;
}

/**
 * score(row, weights) -> { score, breakdown, partial } or null when the row is not scoring_eligible.
 *
 * - Missing inputs are skipped and the remaining weights are re-normalized (partial = true).
 * - If no input is available, score is null (the UI must show "Not rated" or "Insufficient data").
 * - breakdown[k].points are integers that sum exactly to score (largest-remainder rounding),
 *   so the tooltip never shows numbers that disagree with the total.
 */
export function score(row, weights = DEFAULT_WEIGHTS) {
    if (!row || row.scoring_eligible !== true) return null;
    validateWeights(weights);

    const values = {
        spread: isNum(row.spread_class) ? clamp((row.spread_class - 1) / 4, 0, 1) : null,
        oxygen: isNum(row.o2_percent) ? clamp((row.o2_percent - 15) / 25, 0, 1) : null,
        duration: durationTerm(row.duration_seconds),
    };

    const breakdown = {};
    for (const k of KEYS) {
        breakdown[k] = {
            value: values[k],
            weight: weights[k],
            used: values[k] !== null,
            points: null,
        };
    }

    const used = KEYS.filter((k) => values[k] !== null);
    const partial = used.length < KEYS.length;
    const weightUsed = used.reduce((s, k) => s + weights[k], 0);

    if (used.length === 0 || weightUsed === 0) {
        return { score: null, breakdown, partial: true };
    }

    // Exact contribution of each used term, on the 0-100 scale.
    const exact = used.map((k) => ({
        k,
        exact: (100 * weights[k] * values[k]) / weightUsed,
    }));

    const total = exact.reduce((s, e) => s + e.exact, 0);
    const target = Math.round(total);

    // Largest-remainder rounding: points are integers and sum exactly to the score.
    const floored = exact.map((e) => ({ ...e, floor: Math.floor(e.exact) }));
    const remaining = Math.max(0, target - floored.reduce((s, e) => s + e.floor, 0));
    const byRemainder = [...floored].sort(
        (a, b) => b.exact - b.floor - (a.exact - a.floor) || a.k.localeCompare(b.k)
    );
    const bump = new Set();
    for (let i = 0; i < remaining && i < byRemainder.length; i++) bump.add(byRemainder[i].k);

    for (const e of floored) {
        breakdown[e.k].points = e.floor + (bump.has(e.k) ? 1 : 0);
    }

    return { score: target, breakdown, partial };
}

/** Top N scored rows. Reads row.hazard.score only. Ties: higher O2, then name. */
export function rankTop(rows, n = 5) {
    return rows
        .filter((r) => r.hazard && isNum(r.hazard.score))
        .sort((a, b) => {
            if (b.hazard.score !== a.hazard.score) return b.hazard.score - a.hazard.score;
            const ao = isNum(a.o2_percent) ? a.o2_percent : -1;
            const bo = isNum(b.o2_percent) ? b.o2_percent : -1;
            if (bo !== ao) return bo - ao;
            return String(a.name ?? "").localeCompare(String(b.name ?? ""));
        })
        .slice(0, n);
}
