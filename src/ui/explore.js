import experiments from "../data/experiments.json";
import { calculateHazard } from "../utils/hazard.js";

const STORAGE_KEY = "flame-explore-state";
const MAX_COMPARE = 3;

const defaults = {
    category: "All",
    fuelTypes: [],
    gravities: [],
    programs: [],
    minO2: null,
    maxO2: null,
    query: "",
    sort: "hazard",
    direction: "desc",
    selected: [],
    plain: false,
    mode: "experiments",
};

let state = { ...defaults };
let initialized = false;
let lastTrigger = null;

const $ = (selector, root = document) => root.querySelector(selector);

function escapeHTML(value = "") {
    return String(value).replace(/[&<>"']/g, (char) => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    })[char]);
}

function unique(field) {
    return [...new Set(experiments.map((row) => row[field]).filter(Boolean))]
        .sort((a, b) => String(a).localeCompare(String(b)));
}

const O2_VALUES = experiments.map((row) => row.o2_percent).filter(Number.isFinite);
const O2_MIN = O2_VALUES.length ? Math.floor(Math.min(...O2_VALUES) * 10) / 10 : 0;
const O2_MAX = O2_VALUES.length ? Math.ceil(Math.max(...O2_VALUES) * 10) / 10 : 30;
const O2_STEP = 0.1;

function readHashState() {
    const hash = window.location.hash;
    const queryIndex = hash.indexOf("?");
    if (queryIndex < 0) return {};
    const params = new URLSearchParams(hash.slice(queryIndex + 1));
    const parseList = (key) => (params.get(key) || "").split(",").filter(Boolean);
    return {
        category: params.get("category") || defaults.category,
        fuelTypes: parseList("fuel"),
        gravities: parseList("gravity"),
        programs: parseList("program"),
        minO2: params.has("minO2") ? Number(params.get("minO2")) : null,
        maxO2: params.has("maxO2") ? Number(params.get("maxO2")) : null,
        query: params.get("q") || "",
        sort: params.get("sort") || defaults.sort,
        direction: params.get("dir") || defaults.direction,
        plain: params.get("plain") === "1",
        mode: params.get("view") || defaults.mode,
    };
}

function syncHash() {
    const params = new URLSearchParams();
    if (state.category !== "All") params.set("category", state.category);
    if (state.fuelTypes.length) params.set("fuel", state.fuelTypes.join(","));
    if (state.gravities.length) params.set("gravity", state.gravities.join(","));
    if (state.programs.length) params.set("program", state.programs.join(","));
    if (state.minO2 !== null) params.set("minO2", state.minO2);
    if (state.maxO2 !== null) params.set("maxO2", state.maxO2);
    if (state.query) params.set("q", state.query);
    if (state.sort !== defaults.sort) params.set("sort", state.sort);
    if (state.direction !== defaults.direction) params.set("dir", state.direction);
    if (state.plain) params.set("plain", "1");
    if (state.mode !== defaults.mode) params.set("view", state.mode);
    const nextHash = `#/explore${params.toString() ? `?${params}` : ""}`;
    if (window.location.hash !== nextHash) history.replaceState(null, "", nextHash);
    try {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ ...state, selected: [] }));
    } catch (error) {
        console.error("Failed to save state:", error);
    }
}

function hasO2Range() {
    return state.minO2 !== null || state.maxO2 !== null;
}

export function applyFilters(data, filters = state) {
    const q = (filters.query || "").trim().toLowerCase();
    return data.filter((row) => {
        if (filters.category !== "All" && row.fuel_category !== filters.category) return false;
        if (filters.fuelTypes?.length && !filters.fuelTypes.includes(row.fuel_type)) return false;
        if (filters.gravities?.length && !filters.gravities.includes(row.gravity_level)) return false;
        if (filters.programs?.length && !filters.programs.includes(row.program)) return false;

        if (hasO2RangeFor(filters)) {
            if (!Number.isFinite(row.o2_percent)) return false;
            if (filters.minO2 !== null && row.o2_percent < filters.minO2) return false;
            if (filters.maxO2 !== null && row.o2_percent > filters.maxO2) return false;
        }

        if (q) {
            const haystack = [row.name, row.fuel_type, row.flame_behavior, row.takeaway]
                .filter(Boolean).join(" ").toLowerCase();
            if (!haystack.includes(q)) return false;
        }
        return true;
    });
}

function hasO2RangeFor(filters) {
    return filters.minO2 !== null || filters.maxO2 !== null;
}

function getVisibleRows() {
    const rows = applyFilters(experiments);
    const direction = state.direction === "asc" ? 1 : -1;
    return rows.sort((a, b) => {
        let av, bv;
        switch (state.sort) {
            case "name": av = a.name || ""; bv = b.name || ""; break;
            case "o2": av = Number.isFinite(a.o2_percent) ? a.o2_percent : -Infinity; bv = Number.isFinite(b.o2_percent) ? b.o2_percent : -Infinity; break;
            case "duration": av = Number(a.duration_seconds) || 0; bv = Number(b.duration_seconds) || 0; break;
            default:
                av = calculateHazard(a).score ?? -1;
                bv = calculateHazard(b).score ?? -1;
        }
        return (typeof av === "string" ? av.localeCompare(bv) : av - bv) * direction;
    });
}

function hazardCell(row) {
    if (row.fuel_category !== "Solid" || row.scoring_eligible === false) {
        return `<span class="ex-not-rated" title="Hazard Score covers solid-fuel flame spread only.">Not rated</span>`;
    }
    const result = calculateHazard(row);
    const level = result.score >= 70 ? "high" : result.score >= 40 ? "medium" : "low";
    return `
        <button class="ex-score ex-score--${level}" type="button"
            data-action="score-info" data-id="${escapeHTML(row.id)}"
            title="View score breakdown">
            <span class="ex-score__track"><i style="width:${result.score}%"></i></span>
            <b>${result.score}</b>
            ${result.partial ? '<small>Partial</small>' : ""}
        </button>`;
}

function experimentRow(row) {
    const behavior = state.plain ? (row.takeaway || row.flame_behavior) : row.flame_behavior;
    return `
        <tr>
            <td>
                <button class="ex-select" type="button" data-action="select" data-id="${escapeHTML(row.id)}"
                    aria-pressed="${state.selected.includes(row.id)}" aria-label="Select ${escapeHTML(row.name)}">
                    ${state.selected.includes(row.id) ? "✓" : "+"}
                </button>
            </td>
            <td><button class="ex-name-link" data-action="details" data-id="${escapeHTML(row.id)}">${escapeHTML(row.name)}</button><small class="ex-id">${escapeHTML(row.id)}</small></td>
            <td>${escapeHTML(row.program)}</td>
            <td><span class="ex-fuel ex-fuel--${String(row.fuel_category || "").toLowerCase()}">${escapeHTML(row.fuel_type)}</span></td>
            <td>${escapeHTML(row.gravity_level)}</td>
            <td>${Number.isFinite(row.o2_percent) ? `${row.o2_percent}%` : '<span class="ex-unknown">Unknown O₂</span>'}</td>
            <td class="ex-behavior">${escapeHTML(behavior || "—")}</td>
            <td>${Number.isFinite(row.duration_seconds) ? `${row.duration_seconds} s` : "—"}</td>
            <td>${hazardCell(row)}</td>
        </tr>`;
}

function experimentCard(row) {
    const behavior = state.plain ? (row.takeaway || row.flame_behavior) : row.flame_behavior;
    return `
        <article class="ex-mobile-card">
            <div class="ex-mobile-card__top">
                <div><span class="ex-id">${escapeHTML(row.id)}</span><h3>${escapeHTML(row.name)}</h3></div>
                <button class="ex-select" type="button" data-action="select" data-id="${escapeHTML(row.id)}"
                    aria-pressed="${state.selected.includes(row.id)}"> ${state.selected.includes(row.id) ? "✓" : "+"} </button>
            </div>
            <div class="ex-mobile-card__tags">
                <span class="ex-fuel ex-fuel--${String(row.fuel_category || "").toLowerCase()}">${escapeHTML(row.fuel_type)}</span>
                <span>${escapeHTML(row.gravity_level)}</span>
                <span>${escapeHTML(row.program)}</span>
            </div>
            <p>${escapeHTML(behavior || "—")}</p>
            <div class="ex-mobile-card__metrics">
                <span><small>O₂</small><b>${Number.isFinite(row.o2_percent) ? `${row.o2_percent}%` : "Unknown"}</b></span>
                <span><small>Duration</small><b>${Number.isFinite(row.duration_seconds) ? `${row.duration_seconds}s` : "—"}</b></span>
                <span><small>Hazard</small><b>${row.fuel_category === "Solid" && row.scoring_eligible !== false ? calculateHazard(row).score : "Not rated"}</b></span>
            </div>
            <button class="ex-text-button" data-action="details" data-id="${escapeHTML(row.id)}">View experiment details →</button>
        </article>`;
}

function filterOptions(field, selected) {
    return unique(field).map((value) => `
        <label class="ex-check">
            <input type="checkbox" data-filter="${field}" value="${escapeHTML(value)}" ${selected.includes(value) ? "checked" : ""}>
            <span>${escapeHTML(value)}</span>
        </label>`).join("");
}

function activeFilterCount() {
    return Number(state.category !== "All") + state.fuelTypes.length + state.gravities.length +
        state.programs.length + Number(hasO2Range()) + Number(Boolean(state.query));
}

function topFiveMarkup(rows) {
    const ranked = rows.filter((row) => row.fuel_category === "Solid" && row.scoring_eligible !== false)
        .map((row) => ({ row, result: calculateHazard(row) }))
        .sort((a, b) => b.result.score - a.result.score).slice(0, 5);
    if (!ranked.length) return `<div class="ex-empty-mini">No rated solid-fuel experiments in this view.</div>`;
    return ranked.map(({ row, result }, index) => `
        <button class="ex-rank-row" data-action="details" data-id="${escapeHTML(row.id)}">
            <span class="ex-rank-number">${index + 1}</span>
            <span class="ex-rank-info"><b>${escapeHTML(row.name)}</b><small>${escapeHTML(row.fuel_type)}</small></span>
            <span class="ex-rank-bar"><i style="width:${result.score}%"></i></span>
            <strong>${result.score}</strong>
        </button>`).join("");
}

function chartMarkup(rows) {
    const groups = ["Solid", "Liquid", "Gas"];
    const values = groups.map((group) => {
        const subset = rows.filter((row) => row.fuel_category === group);
        const spread = subset.filter((row) => Number.isFinite(row.spread_class));
        const avg = spread.length ? spread.reduce((sum, row) => sum + row.spread_class, 0) / spread.length : 0;
        return { group, count: subset.length, avg };
    });
    const max = Math.max(1, ...values.map((item) => item.avg));
    const bars = values.map((item, index) => {
        const x = 36 + index * 112;
        const height = item.avg ? (item.avg / max) * 112 : 0;
        return `<g><rect x="${x}" y="${132 - height}" width="54" height="${height}" rx="7" class="ex-chart-bar"/>
            <text x="${x + 27}" y="151" text-anchor="middle">${item.group}</text>
            <text x="${x + 27}" y="${Math.max(13, 122 - height)}" text-anchor="middle" class="ex-chart-value">${item.avg ? item.avg.toFixed(1) : "—"}</text></g>`;
    }).join("");
    return `<svg viewBox="0 0 390 170" role="img" aria-label="Average spread class by fuel category">${bars}</svg>
        <p class="ex-chart-note">Average spread class from currently filtered rows with available spread-class data. Mock data only.</p>`;
}

function investigationGroups(rows) {
    const map = new Map();
    rows.forEach((row) => {
        const key = `${row.program}::${row.phenomenon}`;
        if (!map.has(key)) map.set(key, []);
        map.get(key).push(row);
    });
    return [...map.entries()].map(([key, tests]) => {
        const [program, phenomenon] = key.split("::");
        const numericFields = ["o2_percent", "flow_speed_cm_s", "pressure_kpa", "duration_seconds"];
        const varied = [];
        const constant = [];
        numericFields.forEach((field) => {
            const values = [...new Set(tests.map((row) => row[field]).filter((v) => v !== null && v !== undefined))];
            if (values.length > 1) varied.push({ field, values });
            else if (values.length === 1) constant.push({ field, value: values[0] });
        });
        return { id: key, program, phenomenon, tests, varied, constant };
    });
}

function investigationMarkup(rows) {
    const groups = investigationGroups(rows);
    if (!groups.length) return `<div class="ex-empty">No investigations match the current filters.</div>`;
    return `
        <div class="ex-investigation-tools"><p>${groups.length} investigation groups</p><button class="ex-button ex-button--ghost" data-action="compare-investigations">Compare selected investigations (<span id="ex-investigation-count">0</span>)</button></div>
        <div class="ex-investigation-grid">
            ${groups.map((group, index) => `
                <article class="ex-investigation-card">
                    <div class="ex-investigation-card__top">
                        <label class="ex-check"><input type="checkbox" data-investigation="${index}"><span>Select</span></label>
                        <span class="ex-tag">${group.tests.length} test${group.tests.length === 1 ? "" : "s"}</span>
                    </div>
                    <h3>${escapeHTML(group.program)}</h3>
                    <p>${escapeHTML(group.phenomenon)}</p>
                    <div class="ex-investigation-facts">
                        <span><small>Fuel(s)</small><b>${escapeHTML([...new Set(group.tests.map((row) => row.fuel_type))].join(", "))}</b></span>
                        <span><small>Platform(s)</small><b>${escapeHTML([...new Set(group.tests.map((row) => row.platform))].join(", "))}</b></span>
                    </div>
                    <button class="ex-text-button" data-action="investigation-details" data-index="${index}">Open investigation →</button>
                </article>`).join("")}
        </div>`;
}

function renderMainContent(rows) {
    if (state.mode === "investigations") return investigationMarkup(rows);
    if (!rows.length) {
        return `<div class="ex-empty"><div class="ex-empty-icon">⌕</div><h3>No experiments match.</h3><p>Try removing a filter or changing your search.</p><button class="ex-button" data-action="clear">Reset filters</button></div>`;
    }
    return `
        <div class="ex-table-wrap">
            <table class="ex-table">
                <thead><tr>
                    <th class="ex-select-col">Compare</th>
                    ${[
                        ["name", "Experiment"], ["program", "Program"], ["fuel", "Fuel type"],
                        ["gravity", "Gravity"], ["o2", "O₂ %"], ["behavior", "Flame behavior"],
                        ["duration", "Duration"], ["hazard", "Hazard score"],
                    ].map(([key, label]) => `<th ${["name","o2","duration","hazard"].includes(key) ? `aria-sort="${state.sort === key ? (state.direction === "asc" ? "ascending" : "descending") : "none"}"` : ""}>
                        ${["name","o2","duration","hazard"].includes(key)
                            ? `<button class="ex-sort" data-action="sort" data-sort="${key}">${label}<span>${state.sort === key ? (state.direction === "asc" ? "↑" : "↓") : "↕"}</span></button>`
                            : label}
                    </th>`).join("")}
                </tr></thead>
                <tbody>${rows.map(experimentRow).join("")}</tbody>
            </table>
        </div>
        <div class="ex-mobile-list">${rows.map(experimentCard).join("")}</div>`;
}

function filtersMarkup() {
    const min = state.minO2 ?? O2_MIN;
    const max = state.maxO2 ?? O2_MAX;
    const rangeActive = hasO2Range();
    const moonPosition = O2_MAX > O2_MIN ? Math.min(100, Math.max(0, ((30 - O2_MIN) / (O2_MAX - O2_MIN)) * 100)) : 100;
    return `
        <section class="ex-filter-panel reveal">
            <div class="ex-filter-heading"><div><span class="ex-kicker">DISCOVER THE DATA</span><h2>Find an experiment</h2></div>
                <button class="ex-clear" data-action="clear" ${activeFilterCount() ? "" : "disabled"}>Clear all filters</button>
            </div>
            <div class="ex-category-tabs" role="group" aria-label="Fuel category">
                ${["All", "Solid", "Liquid", "Gas"].map((category) => `<button data-action="category" data-category="${category}" class="${state.category === category ? "is-active" : ""}" aria-pressed="${state.category === category}">${category}</button>`).join("")}
            </div>
            <div class="ex-filter-grid">
                <label class="ex-search-field"><span>Search experiments</span><input type="search" id="ex-search" placeholder="Search name, fuel or flame behavior..." value="${escapeHTML(state.query)}"></label>
                <details class="ex-dropdown"><summary>Fuel type <span>${state.fuelTypes.length || "All"}⌄</span></summary><div class="ex-dropdown-menu">${filterOptions("fuel_type", state.fuelTypes)}</div></details>
                <details class="ex-dropdown"><summary>Gravity level <span>${state.gravities.length || "All"}⌄</span></summary><div class="ex-dropdown-menu">${filterOptions("gravity_level", state.gravities)}</div></details>
                <details class="ex-dropdown"><summary>NASA program <span>${state.programs.length || "All"}⌄</span></summary><div class="ex-dropdown-menu">${filterOptions("program", state.programs)}</div></details>
            </div>
            <div class="ex-o2-filter">
                <div class="ex-o2-heading"><label for="ex-o2-min">Oxygen concentration</label><span>${rangeActive ? `${min}% – ${max}%` : `${O2_MIN}% – ${O2_MAX}% (all)`}</span></div>
                <div class="ex-range-wrap">
                    <input id="ex-o2-min" aria-label="Minimum oxygen percentage" type="range" min="${O2_MIN}" max="${O2_MAX}" step="${O2_STEP}" value="${min}">
                    <input id="ex-o2-max" aria-label="Maximum oxygen percentage" type="range" min="${O2_MIN}" max="${O2_MAX}" step="${O2_STEP}" value="${max}">
                    <span class="ex-moon-marker" style="left:${moonPosition}%" title="Moon-base cabin reference: 30% O₂ or more at 10.2 psi or less, as stated in the challenge."><i></i><small>Moon-base 30%</small></span>
                </div>
                <div class="ex-range-labels"><span>${O2_MIN}%</span><span>${O2_MAX}% data range</span></div>
                <button class="ex-reset-range" data-action="reset-o2" ${rangeActive ? "" : "disabled"}>Reset O₂ range</button>
                <p class="ex-hint">Rows with unknown O₂ are hidden while an oxygen range is active.</p>
            </div>
        </section>`;
}

function compareBar() {
    return `<div class="ex-compare-bar ${state.selected.length ? "is-visible" : ""}">
        <span><b>${state.selected.length}</b> of ${MAX_COMPARE} experiments selected</span>
        <div><button class="ex-button ex-button--ghost" data-action="clear-selection">Clear</button><button class="ex-button" data-action="compare" ${state.selected.length < 2 ? "disabled" : ""}>Compare experiments</button></div>
    </div>`;
}

function dialogMarkup() {
    return `<dialog class="ex-dialog" id="ex-dialog" aria-labelledby="ex-dialog-title"><div class="ex-dialog-inner">
        <button class="ex-dialog-close" data-action="close-dialog" aria-label="Close dialog">×</button>
        <div id="ex-dialog-content"></div>
    </div></dialog>`;
}

export function renderExplore() {
    const rows = getVisibleRows();
    return `
        <section class="explore-page">
            <header class="ex-hero reveal">
                <div><span class="ex-kicker">NASA SPACE APPS · FLAME IN FREEFALL</span><h1>Explore <em>combustion data</em></h1>
                    <p>Investigate how fuel, oxygen and gravity shape flame behavior across spaceflight combustion experiments.</p></div>
                <div class="ex-hero-stat"><strong>${experiments.length}</strong><span>Mock experiments</span><small>Dataset preview · not NASA-verified</small></div>
            </header>
            <div class="ex-toolbar reveal">
                <div class="ex-view-tabs"><button data-action="view" data-view="experiments" class="${state.mode === "experiments" ? "is-active" : ""}">Experiments</button><button data-action="view" data-view="investigations" class="${state.mode === "investigations" ? "is-active" : ""}">Investigations</button></div>
                <label class="ex-toggle"><input id="ex-plain-toggle" type="checkbox" ${state.plain ? "checked" : ""}><span class="ex-toggle-ui"></span><span>Plain language</span></label>
                <div class="ex-toolbar-actions"><button class="ex-button ex-button--ghost" data-action="export-csv">Export CSV</button><button class="ex-button ex-button--ghost" data-action="export-json">Export JSON</button><button class="ex-button ex-button--ghost" data-action="copy-link">Copy view link</button></div>
            </div>
            ${filtersMarkup()}
            <div class="ex-results-heading reveal"><div><h2>${state.mode === "investigations" ? "Investigation explorer" : "Experiment database"}</h2><p id="ex-result-count" aria-live="polite">Showing ${rows.length} of ${experiments.length}</p></div><span class="ex-mock-warning">MOCK DATA · FOR UI TESTING</span></div>
            <div class="ex-content-grid reveal">
                <main class="ex-results-card">${renderMainContent(rows)}</main>
                <aside class="ex-side-column">
                    <section class="ex-side-card"><div class="ex-side-heading"><div><span class="ex-kicker">RISK OVERVIEW</span><h3>Top 5 hazard scores</h3></div><span class="ex-side-icon">↗</span></div><p class="ex-side-description">Highest provisional scores among the currently filtered solid-fuel rows.</p><div class="ex-ranking">${topFiveMarkup(rows)}</div><small class="ex-disclaimer">Provisional mock scoring — not an operational fire-risk rating.</small></section>
                    <section class="ex-side-card"><div class="ex-side-heading"><div><span class="ex-kicker">DATA SNAPSHOT</span><h3>Spread class by fuel</h3></div></div><div class="ex-chart">${chartMarkup(rows)}</div></section>
                </aside>
            </div>
            ${compareBar()}
            ${dialogMarkup()}
        </section>`;
}


// Compatibility export retained from the original Explore skeleton.
export function score(row, config) {
    return calculateHazard(row, config);
}

function getRow(id) {
    return experiments.find((row) => row.id === id);
}

function showDialog(html, trigger = null) {
    const dialog = $("#ex-dialog");
    if (!dialog) return;
    lastTrigger = trigger || document.activeElement;
    $("#ex-dialog-content", dialog).innerHTML = html;
    if (!dialog.open) dialog.showModal();
}

function detailsMarkup(row) {
    const hazard = calculateHazard(row);
    const eligible = row.fuel_category === "Solid" && row.scoring_eligible !== false;
    const source = row.source_url || "";
    const psi = row.psi_url || "";
    const takeaway = row.takeaway || row.flame_behavior || "No summary available.";
    return `<span class="ex-kicker">EXPERIMENT DETAIL</span><h2 id="ex-dialog-title">${escapeHTML(row.name)}</h2><p class="ex-dialog-subtitle">${escapeHTML(row.id)} · ${escapeHTML(row.program)}</p>
        <div class="ex-detail-grid">
            ${[
                ["Fuel", row.fuel_type], ["Category", row.fuel_category], ["Gravity", row.gravity_level],
                ["Oxygen", Number.isFinite(row.o2_percent) ? `${row.o2_percent}%` : "Unknown"],
                ["Pressure", Number.isFinite(row.pressure_kpa) ? `${row.pressure_kpa} kPa` : "—"],
                ["Airflow", Number.isFinite(row.flow_speed_cm_s) ? `${row.flow_speed_cm_s} cm/s` : "—"],
                ["Sample", row.sample_geometry], ["Duration", Number.isFinite(row.duration_seconds) ? `${row.duration_seconds} seconds` : "—"],
            ].map(([label, value]) => `<div><small>${label}</small><b>${escapeHTML(value ?? "—")}</b></div>`).join("")}
        </div>
        <section class="ex-detail-section"><h3>Flame behavior</h3><p>${escapeHTML(row.flame_behavior || "—")}</p></section>
        <section class="ex-detail-section"><h3>${state.plain ? "Plain-language takeaway" : "Investigation summary"}</h3><p>${escapeHTML(takeaway)}</p></section>
        <section class="ex-detail-section"><h3>Hazard score</h3>${eligible ? `<div class="ex-detail-score"><strong>${hazard.score}/100</strong><span>${hazard.partial ? "Partial estimate" : "Provisional estimate"}</span></div><p class="ex-hint">This provisional score is only for mock solid-fuel flame-spread rows. It is not a validated NASA metric.</p><ul class="ex-breakdown">${Object.entries(hazard.breakdown).map(([key, item]) => `<li><span>${escapeHTML(key)}</span><b>${item.points}/${item.max}</b><small>${escapeHTML(item.note)}</small></li>`).join("")}</ul>` : `<span class="ex-not-rated">Not rated</span><p class="ex-hint">The Hazard Score covers solid-fuel flame spread only.</p>`}</section>
        <section class="ex-detail-section"><h3>Source</h3><p>${escapeHTML(row.source_note || "Source details not supplied.")}</p><div class="ex-links">${source ? `<a href="${escapeHTML(source)}" target="_blank" rel="noopener">Source URL ↗</a>` : ""}${psi ? `<a href="${escapeHTML(psi)}" target="_blank" rel="noopener">NASA PSI record ↗</a>` : ""}</div></section>
        <small class="ex-disclaimer">Accessed ${new Date().toISOString().slice(0, 10)} · Mock record — verify source before scientific use.</small>`;
}

function compareMarkup(ids) {
    const rows = ids.map(getRow).filter(Boolean);
    const earth = experiments.find((row) => row.gravity_level === "Earth (1g)" && row.fuel_category === "Solid");
    if (earth && !rows.some((row) => row.id === earth.id)) rows.push(earth);
    const fields = [
        ["Experiment", (r) => r.name], ["Fuel", (r) => r.fuel_type], ["Program", (r) => r.program],
        ["Gravity", (r) => r.gravity_level], ["O₂ %", (r) => Number.isFinite(r.o2_percent) ? `${r.o2_percent}%` : "Unknown"],
        ["Pressure", (r) => Number.isFinite(r.pressure_kpa) ? `${r.pressure_kpa} kPa` : "—"],
        ["Airflow", (r) => Number.isFinite(r.flow_speed_cm_s) ? `${r.flow_speed_cm_s} cm/s` : "—"],
        ["Spread rate", (r) => Number.isFinite(r.spread_rate_cm_s) ? `${r.spread_rate_cm_s} cm/s` : "—"],
        ["Duration", (r) => `${r.duration_seconds ?? "—"} s`],
        ["Hazard score", (r) => r.fuel_category === "Solid" && r.scoring_eligible !== false ? `${calculateHazard(r).score}/100` : "Not rated"],
    ];
    return `<span class="ex-kicker">SIDE-BY-SIDE COMPARISON</span><h2 id="ex-dialog-title">Compare experiments</h2><p class="ex-dialog-subtitle">The Earth reference is included when available in the dataset.</p>
        <div class="ex-compare-table-wrap"><table class="ex-compare-table"><thead><tr><th>Attribute</th>${rows.map((r) => `<th>${escapeHTML(r.name)}</th>`).join("")}</tr></thead><tbody>
        ${fields.map(([label, getter]) => `<tr><th>${label}</th>${rows.map((r) => `<td>${escapeHTML(getter(r))}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
}

function investigationDetailMarkup(group) {
    const first = group.tests[0];
    const uniqueValues = (field) => [...new Set(group.tests.map((row) => row[field]).filter((value) => value !== null && value !== undefined))];
    return `<span class="ex-kicker">INVESTIGATION VIEW</span><h2 id="ex-dialog-title">${escapeHTML(group.program)} · ${escapeHTML(group.phenomenon)}</h2>
        <p class="ex-dialog-subtitle">${group.tests.length} mock test row(s) grouped by program and phenomenon</p>
        <section class="ex-detail-section"><h3>Objective</h3><p>${escapeHTML(first.takeaway || first.flame_behavior || "Objective not supplied in mock data.")}</p></section>
        <div class="ex-detail-grid">
            <div><small>Fuel(s)</small><b>${escapeHTML(uniqueValues("fuel_type").join(", "))}</b></div>
            <div><small>Sample shape / size</small><b>${escapeHTML(uniqueValues("sample_geometry").join("; "))}</b></div>
            <div><small>Hardware / platform</small><b>${escapeHTML(uniqueValues("platform").join("; "))}</b></div>
            <div><small>Oxygen conditions</small><b>${escapeHTML(uniqueValues("o2_percent").map((v) => `${v}%`).join(", ") || "Unknown")}</b></div>
            <div><small>Airflow conditions</small><b>${escapeHTML(uniqueValues("flow_speed_cm_s").map((v) => `${v} cm/s`).join(", ") || "Unknown")}</b></div>
            <div><small>Gravity</small><b>${escapeHTML(uniqueValues("gravity_level").join(", "))}</b></div>
        </div>
        <section class="ex-detail-section"><h3>What varied across these rows</h3><p>${group.varied.length ? group.varied.map((item) => `${item.field}: ${item.values.join(", ")}`).map(escapeHTML).join("<br>") : "No varied parameters can be inferred from the available rows."}</p></section>
        <section class="ex-detail-section"><h3>What stayed constant</h3><p>${group.constant.length ? group.constant.map((item) => `${item.field}: ${item.value}`).map(escapeHTML).join("<br>") : "No constant parameters can be inferred."}</p></section>
        <section class="ex-detail-section"><h3>Sensors</h3><p>Sensor details are not included in the current mock dataset.</p></section>
        <section class="ex-detail-section"><h3>Fire-safety relevance</h3><p>${escapeHTML(first.takeaway || "This investigation may inform understanding of combustion behavior in spacecraft habitats. This is a mock summary, not a verified scientific conclusion.")}</p></section>
        <div class="ex-links">${group.tests.map((row) => row.psi_url ? `<a href="${escapeHTML(row.psi_url)}" target="_blank" rel="noopener">PSI record for ${escapeHTML(row.id)} ↗</a>` : "").join("")}</div>
        <small class="ex-disclaimer">Investigation grouping is provisional: grouped by program + phenomenon because formal investigation IDs are not present in the mock rows.</small>`;
}

function exportRows(format) {
    const rows = getVisibleRows().map((row) => {
        const hazard = calculateHazard(row);
        return {
            ...row,
            hazard_score: row.fuel_category === "Solid" && row.scoring_eligible !== false ? hazard.score : "Not rated",
            hazard_breakdown: row.fuel_category === "Solid" && row.scoring_eligible !== false ? hazard.breakdown : null,
            source_url: row.source_url || "",
            psi_url: row.psi_url || "",
            access_date: new Date().toISOString().slice(0, 10),
            hazard_disclaimer: "Provisional mock score for solid-fuel flame spread only; not a validated NASA metric. Liquid and gas flames are not rated.",
        };
    });
    let content, mime, extension;
    if (format === "json") {
        content = JSON.stringify({ exported_at: new Date().toISOString(), filters: { ...state, selected: undefined }, records: rows }, null, 2);
        mime = "application/json;charset=utf-8"; extension = "json";
    } else {
        const headers = [...new Set(rows.flatMap((row) => Object.keys(row)))];
        const csvCell = (value) => `"${String(typeof value === "object" && value !== null ? JSON.stringify(value) : value ?? "").replace(/"/g, '""')}"`;
        content = [headers.map(csvCell).join(","), ...rows.map((row) => headers.map((key) => csvCell(row[key])).join(","))].join("\r\n");
        mime = "text/csv;charset=utf-8"; extension = "csv";
    }
    const blob = new Blob(["\uFEFF", content], { type: mime });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url; anchor.download = `flame-explore-filtered.${extension}`;
    document.body.append(anchor); anchor.click(); anchor.remove(); URL.revokeObjectURL(url);
}

function refresh() {
    const root = $(".explore-page");
    if (!root) return;
    const rows = getVisibleRows();
    const content = $(".ex-results-card", root);
    if (content) content.innerHTML = renderMainContent(rows);
    const count = $("#ex-result-count", root);
    if (count) count.textContent = `Showing ${rows.length} of ${experiments.length}`;
    const ranking = $(".ex-ranking", root);
    if (ranking) ranking.innerHTML = topFiveMarkup(rows);
    const chart = $(".ex-chart", root);
    if (chart) chart.innerHTML = chartMarkup(rows);
    const compare = $(".ex-compare-bar", root);
    if (compare) compare.outerHTML = compareBar();
    const heading = $(".ex-results-heading h2", root);
    if (heading) heading.textContent = state.mode === "investigations" ? "Investigation explorer" : "Experiment database";
    root.querySelectorAll('[data-action="category"]').forEach((button) => {
        const active = button.dataset.category === state.category;
        button.classList.toggle("is-active", active);
        button.setAttribute("aria-pressed", String(active));
    });
    const clearButton = $(".ex-clear", root);
    if (clearButton) clearButton.disabled = activeFilterCount() === 0;
    const viewButtons = root.querySelectorAll('[data-action="view"]');
    viewButtons.forEach((button) => button.classList.toggle("is-active", button.dataset.view === state.mode));
    const plainToggle = $("#ex-plain-toggle", root);
    if (plainToggle) plainToggle.checked = state.plain;
    const minInput = $("#ex-o2-min", root);
    const maxInput = $("#ex-o2-max", root);
    if (minInput) minInput.value = state.minO2 ?? O2_MIN;
    if (maxInput) maxInput.value = state.maxO2 ?? O2_MAX;
    const o2Heading = $(".ex-o2-heading span", root);
    if (o2Heading) o2Heading.textContent = hasO2Range() ? `${state.minO2 ?? O2_MIN}% – ${state.maxO2 ?? O2_MAX}%` : `${O2_MIN}% – ${O2_MAX}% (all)`;
    const resetO2 = $('[data-action="reset-o2"]', root);
    if (resetO2) resetO2.disabled = !hasO2Range();
    const newContent = $(".ex-results-card", root);
    if (newContent && state.mode === "investigations") newContent.innerHTML = investigationMarkup(rows);
    syncHash();
}

function setArrayFilter(field, value, checked) {
    const key = field === "fuel_type" ? "fuelTypes" : field === "gravity_level" ? "gravities" : "programs";
    state[key] = checked ? [...new Set([...state[key], value])] : state[key].filter((item) => item !== value);
}

function selectedInvestigations() {
    const rows = getVisibleRows();
    const groups = investigationGroups(rows);
    return [...document.querySelectorAll("[data-investigation]:checked")]
        .map((input) => groups[Number(input.dataset.investigation)]).filter(Boolean);
}

function compareInvestigationMarkup(groups) {
    const attrs = [
        ["Program", (g) => g.program], ["Phenomenon", (g) => g.phenomenon],
        ["Fuel(s)", (g) => [...new Set(g.tests.map((r) => r.fuel_type))].join(", ")],
        ["Sample geometry", (g) => [...new Set(g.tests.map((r) => r.sample_geometry))].join("; ")],
        ["Platform", (g) => [...new Set(g.tests.map((r) => r.platform))].join("; ")],
        ["O₂ conditions", (g) => [...new Set(g.tests.map((r) => r.o2_percent).filter(Number.isFinite))].map((v) => `${v}%`).join(", ") || "Unknown"],
        ["Airflow", (g) => [...new Set(g.tests.map((r) => r.flow_speed_cm_s).filter(Number.isFinite))].map((v) => `${v} cm/s`).join(", ") || "Unknown"],
        ["Varied parameters", (g) => g.varied.map((v) => v.field).join(", ") || "Not established"],
        ["Constant parameters", (g) => g.constant.map((v) => v.field).join(", ") || "Not established"],
    ];
    return `<span class="ex-kicker">INVESTIGATION COMPARISON</span><h2 id="ex-dialog-title">Compare investigations</h2><div class="ex-compare-table-wrap"><table class="ex-compare-table"><thead><tr><th>Attribute</th>${groups.map((g) => `<th>${escapeHTML(g.program)}<small>${escapeHTML(g.phenomenon)}</small></th>`).join("")}</tr></thead><tbody>${attrs.map(([label, getter]) => {
        const vals = groups.map(getter);
        const same = vals.every((v) => v === vals[0]);
        return `<tr class="${same ? "is-same" : "is-different"}"><th>${label}${same ? " · same" : " · differs"}</th>${vals.map((v) => `<td>${escapeHTML(v)}</td>`).join("")}</tr>`;
    }).join("")}</tbody></table></div>`;
}

function onClick(event) {
    const button = event.target.closest("[data-action]");
    if (!button) return;
    const action = button.dataset.action;
    if (action === "category") { state.category = button.dataset.category; refresh(); }
    if (action === "clear") { state = { ...defaults, selected: [] }; syncHash(); renderExploreIntoRoot(); }
    if (action === "reset-o2") { state.minO2 = null; state.maxO2 = null; renderExploreIntoRoot(); }
    if (action === "view") { state.mode = button.dataset.view; refresh(); }
    if (action === "sort") {
        const sort = button.dataset.sort;
        state.direction = state.sort === sort && state.direction === "desc" ? "asc" : "desc";
        state.sort = sort; refresh();
    }
    if (action === "select") {
        const id = button.dataset.id;
        state.selected = state.selected.includes(id) ? state.selected.filter((x) => x !== id)
            : state.selected.length < MAX_COMPARE ? [...state.selected, id] : state.selected;
        refresh();
    }
    if (action === "clear-selection") { state.selected = []; refresh(); }
    if (action === "compare") showDialog(compareMarkup(state.selected), button);
    if (action === "details") { const row = getRow(button.dataset.id); if (row) showDialog(detailsMarkup(row), button); }
    if (action === "score-info") { const row = getRow(button.dataset.id); if (row) showDialog(detailsMarkup(row), button); }
    if (action === "close-dialog") $("#ex-dialog")?.close();
    if (action === "export-csv") exportRows("csv");
    if (action === "export-json") exportRows("json");
    if (action === "copy-link") {
        syncHash();
        navigator.clipboard?.writeText(window.location.href).then(() => {
            button.textContent = "Link copied ✓";
            setTimeout(() => { if (button.isConnected) button.textContent = "Copy view link"; }, 1600);
        }).catch(() => window.prompt("Copy this view link:", window.location.href));
    }
    if (action === "investigation-details") {
        const group = investigationGroups(getVisibleRows())[Number(button.dataset.index)];
        if (group) showDialog(investigationDetailMarkup(group), button);
    }
    if (action === "compare-investigations") {
        const groups = selectedInvestigations();
        if (groups.length < 2 || groups.length > 3) {
            showDialog(`<span class="ex-kicker">SELECT INVESTIGATIONS</span><h2 id="ex-dialog-title">Choose 2–3 investigations</h2><p>Select at least two and no more than three investigation groups to compare.</p>`, button);
        } else showDialog(compareInvestigationMarkup(groups), button);
    }
}

function onInput(event) {
    const target = event.target;
    if (target.id === "ex-search") { state.query = target.value; refresh(); const input = $("#ex-search"); input?.focus(); input?.setSelectionRange(input.value.length, input.value.length); }
    // Multi-select checkboxes are handled by the change listener in initExplore().
    if (target.id === "ex-plain-toggle") { state.plain = target.checked; refresh(); }
    if (target.id === "ex-o2-min" || target.id === "ex-o2-max") {
        let min = Number($("#ex-o2-min").value);
        let max = Number($("#ex-o2-max").value);
        if (min > max) {
            if (target.id === "ex-o2-min") max = min;
            else min = max;
        }
        state.minO2 = min > O2_MIN ? min : null;
        state.maxO2 = max < O2_MAX ? max : null;
        refresh();
    }
}

function renderExploreIntoRoot() {
    const main = $(".explore-page")?.parentElement;
    if (main) {
        main.innerHTML = renderExplore();
        initExplore();
    }
}

export function initExplore() {
    const root = $(".explore-page");
    if (!root) return;
    if (!initialized) {
        document.addEventListener("click", onClick);
        document.addEventListener("input", onInput);
        document.addEventListener("change", (event) => {
            if (event.target.matches("[data-filter]")) {
                setArrayFilter(event.target.dataset.filter, event.target.value, event.target.checked);
                refresh();
            }
        });
        const dialog = $("#ex-dialog");
        dialog?.addEventListener("close", () => lastTrigger?.focus?.());
        initialized = true;
    }
    const hashState = readHashState();
    const stored = (() => { try { return JSON.parse(sessionStorage.getItem(STORAGE_KEY) || "null"); } catch { return null; } })();
    state = { ...defaults, ...(stored || {}), ...hashState, selected: [] };
    // Re-render once so a direct shared URL is reflected in every control and result.
    const parent = root.parentElement;
    if (parent && !root.dataset.hydrated) {
        root.dataset.hydrated = "true";
        parent.innerHTML = renderExplore();
        const newRoot = $(".explore-page");
        if (newRoot) newRoot.dataset.hydrated = "true";
    }
    syncHash();
}
