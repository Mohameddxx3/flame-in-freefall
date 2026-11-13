import "./style.css";
import { initScrollReveal } from "./utils/scrollReveal.js";
import { renderHeader } from "./ui/header.js";
import { renderFooter } from "./ui/footer.js";
import { renderHero } from "./ui/hero.js";
import { renderExplore, initExplore } from "./ui/explore.js";
import { renderInsights } from "./ui/insights.js";
import { renderAssistant } from "./ui/assistant.js";
import { renderSimulator, mountSimulator } from "./ui/simulator.js";


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
    currentRoute: window.location.hash || "#/home",
};

// Update State
function setState(newState) {
    Object.assign(state, newState);
    render();
}

let cleanupReveal = null;
let cleanupSimulator = null;
let simulatorInstance = null;

// Render Application
function render() {

    if (cleanupReveal) {
        cleanupReveal();
        cleanupReveal = null;
    }
    if (cleanupSimulator) {
        cleanupSimulator();
        cleanupSimulator = null;
    }
    if (simulatorInstance) {
        simulatorInstance.dispose();
        simulatorInstance = null;
    }

    const route = state.currentRoute.split("?")[0];

    app.innerHTML = `
        ${renderHeader(route)}

        <main id="main-content" class="app-main" tabindex="-1"></main>

        ${renderFooter()}
    `;

    const main = app.querySelector("#main-content");

    switch (route) {
        case "#/home":
            main.innerHTML = renderHero();
            break;

        case "#/explore":
            main.innerHTML = renderExplore();
            initExplore();
            break;

        case "#/insights":
            main.innerHTML = renderInsights();
            
            break;

        case "#/assistant":
            main.innerHTML = renderAssistant();
            requestAnimationFrame(() => {
                const messagesContainer = document.getElementById("assistant-messages");

                if (messagesContainer) {
                    messagesContainer.scrollTop = messagesContainer.scrollHeight;
                }
            });
            break;

        case "#/simulator": {
            main.innerHTML = renderSimulator();

            simulatorInstance = mountSimulator(main, state);
            break;
        }

        default:
            main.innerHTML = "<h1>404 - Page Not Found</h1>";
    }

    cleanupReveal = initScrollReveal();
}

// Hash Router
window.addEventListener("hashchange", () => {
    setState({
        currentRoute: window.location.hash,
    });
});

// Initial Render
if (!window.location.hash) {
    window.location.hash = "#/home";
} else {
    render();
}
