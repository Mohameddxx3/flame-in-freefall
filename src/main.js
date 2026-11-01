import "./style.css";
import { renderExplore } from "./ui/explore.js";
import { renderInsights } from "./ui/insights.js";
import { renderAssistant } from "./ui/assistant.js";
import { renderSimulator } from "./ui/simulator.js";

export function encodeState(filters) {
    return "#/explore";
}

export function decodeState(hash) {
    return {
        fuelCategory: [],
        fuelType: [],
        program: [],
        gravity: [],
        o2: { min: null, max: null },
        query: "",
        sort: { key: "hazard", dir: "desc" },
        compare: [],
    };
}

const app = document.querySelector("#app");

// Application State
const state = {
    currentRoute: window.location.hash || "#/explore",
};

// Update State
function setState(newState) {
    Object.assign(state, newState);
    render();
}

// Render Application
function render() {
    const route = state.currentRoute;

    switch (route) {
        case "#/explore":
            app.innerHTML = "<h1>Explore</h1>";
            break;

        case "#/insights":
            app.innerHTML = "<h1>Insights</h1>";
            break;

        case "#/assistant":
            app.innerHTML = "<h1>Assistant</h1>";
            break;

        case "#/simulator":
            app.innerHTML = "<h1>Simulator</h1>";
            break;

        default:
            app.innerHTML = "<h1>404 - Page Not Found</h1>";
    }
}

// Hash Router
window.addEventListener("hashchange", () => {
    setState({
        currentRoute: window.location.hash,
    });
});

// Initial Render
if (!window.location.hash) {
    window.location.hash = "#/explore";
} else {
    render();
}
