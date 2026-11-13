import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import Ajv from "ajv";

const schema = JSON.parse(
    readFileSync(new URL("../schema/experiment.schema.json", import.meta.url))
);
const ajv = new Ajv({ allErrors: true });
const validate = ajv.compile(schema);

// Full solid row, following SRS 4.2 field by field.
const good = {
    id: "SAF-01",
    name: "Saffire-I fabric test 1",
    program: "Saffire",
    platform: "Cygnus (after ISS)",
    phenomenon: "Solid flame spread",
    fuel_type: "SIBAL fabric",
    fuel_category: "Solid",
    gravity_level: "Microgravity (0g)",
    o2_percent: 21.7,
    pressure_kpa: null,
    flow_speed_cm_s: 20,
    flow_direction: "Concurrent",
    sample_geometry: "40.6 x 94 cm, 0.37 mm fabric",
    flame_behavior: "Flame spreads along the fabric surface",
    spread_class: 3,
    duration_seconds: null,
    scoring_eligible: true,
    takeaway: "Fabric flames can spread differently in microgravity.",
    source_url: "https://ntrs.nasa.gov/citations/20180005168",
    source_note: "Saffire-I fire safety experiment",
    verified_by: "QA",
};

const liquid = {
    ...good,
    id: "FLEX-01",
    name: "Heptane droplet",
    program: "FLEX",
    platform: "ISS Combustion Integrated Rack",
    phenomenon: "Droplet burning",
    fuel_type: "n-heptane",
    fuel_category: "Liquid",
    flow_speed_cm_s: 0,
    flow_direction: "None",
    sample_geometry: "Large droplet",
    spread_class: null,
    scoring_eligible: false,
};

const earthRef = {
    ...good,
    id: "EARTH-01",
    name: "Earth reference flammability test",
    program: "Earth reference",
    platform: "Earth lab",
    phenomenon: "Earth reference",
    gravity_level: "Earth (1g)",
    o2_percent: 21.0,
    flow_speed_cm_s: 0,
    flow_direction: "None",
    spread_class: null,
    scoring_eligible: false,
    source_url: "https://ntrs.nasa.gov/citations/20160010292",
};

const errorsOf = (row) => {
    validate(row);
    return ajv.errorsText(validate.errors);
};

describe("experiment schema: valid rows", () => {
    it("accepts a scored solid row", () => {
        expect(validate(good), errorsOf(good)).toBe(true);
    });

    it("accepts a liquid row with no spread data", () => {
        expect(validate(liquid), errorsOf(liquid)).toBe(true);
    });

    it("accepts the Earth reference row (not scored, not ranked)", () => {
        expect(validate(earthRef), errorsOf(earthRef)).toBe(true);
    });

    it("accepts null for optional numeric fields", () => {
        const row = { ...good, o2_percent: null, pressure_kpa: null, flow_speed_cm_s: null };
        expect(validate(row), errorsOf(row)).toBe(true);
    });
});

describe("experiment schema: scoring rules (SRS 4.2)", () => {
    it("rejects a scored row without spread_class", () => {
        expect(validate({ ...good, spread_class: null })).toBe(false);
    });

    it("rejects a liquid or gas row that carries a spread_class", () => {
        expect(validate({ ...liquid, spread_class: 3 })).toBe(false);
    });
});

describe("experiment schema: field rules", () => {
    it("rejects a bad id format", () => {
        expect(validate({ ...good, id: "saf1" })).toBe(false);
    });

    it("rejects an unknown enum value", () => {
        expect(validate({ ...good, fuel_category: "Powder" })).toBe(false);
        expect(validate({ ...good, program: "NASA" })).toBe(false);
    });

    it("rejects a non-https source link", () => {
        expect(validate({ ...good, source_url: "http://example.com" })).toBe(false);
    });

    it("rejects an invented key", () => {
        expect(validate({ ...good, surprise: 1 })).toBe(false);
    });

    it("rejects O2 above 100 and spread_class outside 1 to 5", () => {
        expect(validate({ ...good, o2_percent: 120 })).toBe(false);
        expect(validate({ ...good, spread_class: 6 })).toBe(false);
        expect(validate({ ...good, spread_class: 0 })).toBe(false);
    });

    it("rejects a negative duration", () => {
        expect(validate({ ...good, duration_seconds: -5 })).toBe(false);
    });

    it("rejects a missing required field", () => {
        const { source_url, ...withoutSource } = good;
        expect(validate(withoutSource)).toBe(false);
    });
});
