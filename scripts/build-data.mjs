import fs from "fs";
import path from "path";
import Papa from "papaparse";
import Ajv from "ajv";
import { score, validateWeights } from "../src/lib/hazard.js";

const ROOT = process.cwd();
const CSV_PATH = path.join(ROOT, "data/raw/experiments.csv");
const SCHEMA_PATH = path.join(ROOT, "schema/experiment.schema.json");
const WEIGHTS_PATH = path.join(ROOT, "config/hazard-weights.json");
const PACKAGE_PATH = path.join(ROOT, "package.json");
const OUTPUT_JSON_PATH = path.join(ROOT, "src/data/experiments.json");
const OUTPUT_META_PATH = path.join(ROOT, "src/data/meta.json");

const NUMERIC_FIELDS = new Set([
    "o2_percent",
    "pressure_kpa",
    "flow_speed_cm_s",
    "spread_class",
    "duration_seconds",
]);
const BOOLEAN_FIELDS = new Set(["scoring_eligible"]);

function fail(msg) {
    console.error(`❌ ${msg}`);
    process.exit(1);
}

function requireFile(p) {
    if (!fs.existsSync(p)) fail(`ملف غير موجود: ${p}`);
}

/**
 * Empty cell or "null" becomes null. Numeric and boolean fields are typed here.
 * Invalid numbers and booleans stay as strings so the schema reports them.
 * Text fields are never converted, so "2024" or "007" stay as text.
 */
function coerce(field, raw) {
    if (raw === undefined || raw === null) return null;
    const v = String(raw).trim();
    if (v === "" || v.toLowerCase() === "null") return null;

    if (NUMERIC_FIELDS.has(field)) {
        const n = Number(v);
        return Number.isFinite(n) ? n : v;
    }
    if (BOOLEAN_FIELDS.has(field)) {
        const l = v.toLowerCase();
        if (l === "true") return true;
        if (l === "false") return false;
        return v;
    }
    return v;
}

function main() {
    console.log("🔄 جاري بناء بيانات الـ Backend...");

    [CSV_PATH, SCHEMA_PATH, WEIGHTS_PATH, PACKAGE_PATH].forEach(requireFile);

    const schema = JSON.parse(fs.readFileSync(SCHEMA_PATH, "utf-8"));
    const weights = JSON.parse(fs.readFileSync(WEIGHTS_PATH, "utf-8"));
    const pkg = JSON.parse(fs.readFileSync(PACKAGE_PATH, "utf-8"));

    validateWeights(weights);

    // 1. Parse CSV with a real parser (handles commas and quotes inside text fields).
    const csvText = fs.readFileSync(CSV_PATH, "utf-8");
    const parsed = Papa.parse(csvText, {
        header: true,
        skipEmptyLines: "greedy",
        transformHeader: (h) => h.trim(),
    });
    if (parsed.errors.length > 0) {
        const lines = parsed.errors.map((e) => `  - row ${e.row ?? "?"}: ${e.message}`);
        fail(`أخطاء في قراءة الـ CSV:\n${lines.join("\n")}`);
    }

    const headers = parsed.meta.fields ?? [];
    console.log(`📊 تم العثور على ${parsed.data.length} صف و${headers.length} عمود.`);

    // 2. Coerce, validate against the schema, and collect ALL errors before exiting.
    const ajv = new Ajv({ allErrors: true }); // no useDefaults: never invent values
    const validate = ajv.compile(schema);

    const rows = [];
    const errors = [];
    const seenIds = new Set();

    parsed.data.forEach((rawRow, i) => {
        const row = {};
        for (const field of headers) {
            row[field] = coerce(field, rawRow[field]);
        }

        const label = `الصف ${i + 2} (ID: ${row.id ?? "Unknown"})`;

        if (row.id !== null) {
            if (seenIds.has(row.id)) errors.push(`${label}: ID مكرر`);
            seenIds.add(row.id);
        }

        if (!validate(row)) {
            errors.push(`${label}:\n${ajv.errorsText(validate.errors, { dataVar: "row" })}`);
            return;
        }

        // Hazard is added after validation, so the schema does not need to know about it.
        row.hazard = score(row, weights);
        rows.push(row);
    });

    if (errors.length > 0) {
        fail(`تم العثور على ${errors.length} خطأ:\n\n${errors.join("\n\n")}`);
    }

    // 3. Write outputs.
    fs.mkdirSync(path.dirname(OUTPUT_JSON_PATH), { recursive: true });
    fs.writeFileSync(OUTPUT_JSON_PATH, JSON.stringify(rows, null, 2), "utf-8");

    const meta = {
        totalExperiments: rows.length,
        scoredExperiments: rows.filter((r) => r.hazard && r.hazard.score !== null).length,
        buildTime: new Date().toISOString(),
        version: pkg.version,
    };
    fs.writeFileSync(OUTPUT_META_PATH, JSON.stringify(meta, null, 2), "utf-8");

    console.log(`✅ تم كتابة ${rows.length} صف في ${OUTPUT_JSON_PATH}`);
}

main();
