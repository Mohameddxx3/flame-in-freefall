import experiments from "../data/experiments.json";

export function renderHero() {
    const totalExperiments = experiments.length;

    const fuelCategories = new Set(experiments.map((exp) => exp.fuel_category).filter(Boolean))
        .size;

    const researchPrograms = new Set(experiments.map((exp) => exp.program).filter(Boolean)).size;

    return `
    <section class="hero">
        <div class="hero-content reveal">
            <span class="hero-badge">NASA Space Apps Challenge 2026</span>

            <h1>
                Fire in Space.<br>
                <span>Science on Earth.</span>
            </h1>

            <p>
                Explore how flames behave in microgravity
                and discover AI-powered fire safety insights
                for future space missions.
            </p>

            <a href="#/explore" class="hero-button">
                Explore Experiments →
            </a>
        </div>

        <div class="hero-stats ">
            <div class="stat-card reveal reveal-delay-1">
                <span class="stat-number">${totalExperiments}</span>
                <span class="stat-label">Experiments</span>
            </div>

            <div class="stat-card reveal reveal-delay-2">
                <span class="stat-number">${fuelCategories}</span>
                <span class="stat-label">Fuel Categories</span>
            </div>

            <div class="stat-card reveal reveal-delay-3">
                <span class="stat-number">${researchPrograms}</span>
                <span class="stat-label">Research Programs</span>
            </div>
        </div>
    </section>
`;
}
