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

// document.querySelector('#app').innerHTML =
