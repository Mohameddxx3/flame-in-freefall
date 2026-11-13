/*
 * Provisional MOCK-only Hazard Score.
 * Replace these weights and normalization rules with the approved SRS §4.4
 * formula when the validated scientific scoring method is supplied.
 * This is not a NASA metric or an operational fire-safety rating.
 */
export function calculateHazard(row) {
    if (!row || row.fuel_category !== "Solid" || row.scoring_eligible === false) {
        return { score: null, breakdown: {}, partial: false };
    }

    const breakdown = {};
    let total = 0;
    let available = 0;

    const add = (name, points, max, note) => {
        breakdown[name] = { points, max, note };
        total += points;
        available += max;
    };

    // Higher spread class indicates a more severe observed spread category.
    if (Number.isFinite(row.spread_class)) {
        const points = Math.max(0, Math.min(30, (row.spread_class / 5) * 30));
        add("Spread class", Math.round(points), 30, `Observed class: ${row.spread_class}.`);
    }

    // Relative spread-rate band; capped to avoid unbounded influence.
    if (Number.isFinite(row.spread_rate_cm_s)) {
        const points = Math.max(0, Math.min(25, (row.spread_rate_cm_s / 0.5) * 25));
        add("Spread rate", Math.round(points), 25, `Observed rate: ${row.spread_rate_cm_s} cm/s.`);
    }

    // Oxygen close to / above ambient reference receives more provisional points.
    if (Number.isFinite(row.o2_percent)) {
        const points = Math.max(0, Math.min(20, ((row.o2_percent - 15) / 10) * 20));
        add(
            "Oxygen concentration",
            Math.round(points),
            20,
            `O₂ concentration: ${row.o2_percent}%.`
        );
    }

    // Duration is treated only as a weak exposure proxy in this mock model.
    if (Number.isFinite(row.duration_seconds)) {
        const points = Math.max(0, Math.min(10, (row.duration_seconds / 300) * 10));
        add("Test duration", Math.round(points), 10, `Duration: ${row.duration_seconds} seconds.`);
    }

    // Gravity context is represented as a small contextual term, not a claim of risk.
    if (row.gravity_level) {
        add(
            "Gravity context",
            row.gravity_level.includes("Microgravity") ? 8 : 5,
            8,
            `Context: ${row.gravity_level}.`
        );
    }

    const partial = available < 93;
    const normalized = available ? Math.round((total / available) * 100) : 0;
    return {
        score: Math.max(0, Math.min(100, normalized)),
        breakdown,
        partial,
    };
}

// Backward-compatible named export if older code imports score().
export function score(row) {
    return calculateHazard(row);
}
