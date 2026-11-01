export function renderExplore() {
    return "<h1>Explore</h1>";
}

export function applyFilters(data, filters) {
    return data;
}

export function score(row, config) {
    return {
        score: 0,
        breakdown: {},
        partial: false,
    };
}
