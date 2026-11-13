import insights from "../data/insights.json";
import { initScrollReveal } from "../utils/scrollReveal.js";

const TAGS = ["All", "Flame shape", "Oxygen", "Spread", "Materials", "Moon and Mars"];

let activeTag = "All";

function escapeHTML(value) {
    return String(value).replace(
        /[&<>"']/g,
        (char) =>
            ({
                "&": "&amp;",
                "<": "&lt;",
                ">": "&gt;",
                '"': "&quot;",
                "'": "&#039;",
            })[char]
    );
}

function renderCards() {
    const filteredInsights =
        activeTag === "All" ? insights : insights.filter((item) => item.tag === activeTag);

    return filteredInsights
        .map((item, index) => {
            const sources = item.sources
                .map(
                    (source) => `
            <a
                href="${escapeHTML(source.url)}"
                target="_blank"
                rel="noopener noreferrer"
                class="insight-source"
            >
                ↗ ${escapeHTML(source.label)}
            </a>
        `
                )
                .join("");

            const experimentIds = item.relatedExperimentIds || [];

            const exploreLink = experimentIds.length
                ? `
                <a
                    href="#/explore?ids=${encodeURIComponent(experimentIds.join(","))}"
                    class="insight-explore"
                >
                    Explore related experiments →
                </a>
            `
                : `
                <span class="insight-explore pending">
                    Experiment links coming soon
                </span>
            `;

            return `
            <article
                class="insight-card reveal ${
                    index % 3 === 0 ? "reveal-delay-1" :
                    index % 3 === 1 ? "reveal-delay-2" :
                    "reveal-delay-3"
                }"
            >
                <div class="insight-card-top">
                    <span class="insight-number">
                        INSIGHT / ${String(index + 1).padStart(2, "0")}
                    </span>

                    <span class="insight-tag">
                        ${escapeHTML(item.tag)}
                    </span>
                </div>

                <h3 class="insight-question">
                    ${escapeHTML(item.question)}
                </h3>

                <p class="insight-answer">
                    ${escapeHTML(item.answer)}
                </p>

                <div class="insight-footer">
                    <div class="insight-sources">
                        <span class="source-label">SOURCE</span>
                        ${sources}
                    </div>

                    <div class="insight-experiments">
                        <span class="source-label">RELATED EXPERIMENTS</span>

                        <div class="experiment-ids">
                            ${
                                experimentIds.length
                                    ? experimentIds
                                          .map(
                                              (id) => `
                                        <span class="experiment-id">
                                            ${escapeHTML(id)}
                                        </span>
                                    `
                                          )
                                          .join("")
                                    : `<span class="no-experiments">Pending data</span>`
                            }
                        </div>
                    </div>

                    ${exploreLink}
                </div>
            </article>
        `;
        })
        .join("");
}

export function renderInsights() {
    activeTag = "All";

    attachFilterEvents();

    return `
        <section class="insights-page">

            <header class="insights-header reveal">
                <div class="insights-eyebrow">
                    <span class="status-dot"></span>
                    NASA FLAME SAFETY RESEARCH
                </div>

                <h1>
                    Flame Safety <span>Insights</span>
                </h1>

                <p>
                    Discover what microgravity combustion research
                    reveals about Flame behavior and astronaut safety.
                </p>

                <div class="insights-stats">
                    <div>
                        <strong>06</strong>
                        <span>CORE INSIGHTS</span>
                    </div>

                    <div>
                        <strong>NASA</strong>
                        <span>RESEARCH SOURCES</span>
                    </div>
                </div>
            </header>

            <div class="insights-filters reveal">
                <div class="filter-heading">
                    <span>EXPLORE BY TOPIC</span>
                    <span class="filter-count">06 INSIGHTS</span>
                </div>

                <div class="insights-tags">
                    ${TAGS.map(
                        (tag) => `
                        <button
                            class="insight-filter ${tag === "All" ? "active" : ""}"
                            data-tag="${escapeHTML(tag)}"
                            aria-pressed="${tag === "All"}"
                        >
                            ${escapeHTML(tag)}
                        </button>
                    `
                    ).join("")}
                </div>
            </div>

            <div
                class="insights-grid"
                id="insights-grid"
            >
                ${renderCards()}
            </div>

        </section>
    `;
}

let filterEventsAttached = false;

function attachFilterEvents() {
    if (filterEventsAttached) return;

    document.addEventListener("click", (event) => {
        const button = event.target.closest(".insight-filter");

        if (!button) return;

        activeTag = button.dataset.tag;

        document.querySelectorAll(".insight-filter").forEach((btn) => {
            const isActive = btn.dataset.tag === activeTag;

            btn.classList.toggle("active", isActive);
            btn.setAttribute("aria-pressed", String(isActive));
        });

        const grid = document.getElementById("insights-grid");

        if (grid) {
            grid.innerHTML = renderCards();
            initScrollReveal();
        }
    });

    filterEventsAttached = true;
}
