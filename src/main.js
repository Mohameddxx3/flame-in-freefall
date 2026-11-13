import "./style.css";
import { initScrollReveal } from "./utils/scrollReveal.js";
import { renderHeader } from "./ui/header.js";
import { renderFooter } from "./ui/footer.js";
import { renderHero } from "./ui/hero.js";
import { renderExplore, initExplore } from "./ui/explore.js";
import { renderInsights } from "./ui/insights.js";
import { renderAssistant } from "./ui/assistant.js";
import { renderSimulator, mountSimulator } from "./ui/simulator.js";
import { getRoute, decodeState } from "./lib/urlstate.js";

const app = document.querySelector("#app");

// Single source of truth for the view: the hash. No separate state object.
const DEFAULT_ROUTE = "home";

let cleanupReveal = null;
let simulatorInstance = null;

function currentRoute() {
    return getRoute(window.location.hash) || DEFAULT_ROUTE;
}

function render() {
    if (cleanupReveal) {
        cleanupReveal();
        cleanupReveal = null;
    }
    if (simulatorInstance) {
        simulatorInstance.dispose();
        simulatorInstance = null;
    }

    const route = currentRoute();

    app.innerHTML = `
        ${renderHeader(route)}

        <main id="main-content" class="app-main" tabindex="-1"></main>

        ${renderFooter()}
    `;

    const main = app.querySelector("#main-content");

    switch (route) {
        case "home":
            main.innerHTML = renderHero();
            break;

        case "explore":
            main.innerHTML = renderExplore();
            // Filters come from the URL, so a shared link opens the same view.
            initExplore(decodeState(window.location.hash));
            break;

        case "insights":
            main.innerHTML = renderInsights();
            break;

        case "assistant":
            main.innerHTML = renderAssistant();
            requestAnimationFrame(() => {
                const messages = document.getElementById("assistant-messages");
                if (messages) messages.scrollTop = messages.scrollHeight;
            });
            break;

        case "simulator":
            main.innerHTML = renderSimulator();
            simulatorInstance = mountSimulator(main);
            break;

        default:
            main.innerHTML = "<h1>404 - Page Not Found</h1>";
    }

    cleanupReveal = initScrollReveal();
}

window.addEventListener("hashchange", render);

// Initial render. If there is no hash, set it without adding a history entry,
// then render once (the replaceState call does not fire hashchange).
if (!window.location.hash) {
    history.replaceState(null, "", `#/${DEFAULT_ROUTE}`);
}
render();
