import experiments from "../data/experiments.json";

// ==========================================
// ASSISTANT CONFIG
// ==========================================

const INTENTS = [
    {
        id: "microgravity",
        question: "How does microgravity affect flames?",
        keywords: ["microgravity", "gravity", "flame shape"],
        text: "Microgravity changes the way flames behave. Without normal buoyancy-driven convection, flame shapes and transport processes differ from those observed on Earth.",
        experimentIds: ["MOCK-01", "MOCK-04"],
        suggestions: [
            "How does oxygen affect combustion?",
            "What are the fire risks in spacecraft?",
            "Which experiments study flame behavior?",
        ],
    },

    {
        id: "oxygen",
        question: "How does oxygen affect combustion?",
        keywords: ["oxygen", "o2"],
        text: "Oxygen concentration is an important factor in combustion. Changing oxygen availability can affect flame behavior and combustion characteristics.",
        experimentIds: ["MOCK-03", "MOCK-04"],
        suggestions: [
            "How does microgravity affect flames?",
            "Which fuel has the highest hazard?",
            "Why is fire dangerous in spacecraft?",
        ],
    },

    {
        id: "fuel",
        question: "Which fuels are studied?",
        keywords: ["fuel", "fuels", "types of fuel"],
        text: "NASA combustion experiments investigate different fuel types to understand their behavior under different environmental conditions.",
        experimentIds: ["MOCK-01", "MOCK-02"],
        suggestions: [
            "How does oxygen affect combustion?",
            "Which experiments study solid fuels?",
            "How does microgravity affect flames?",
        ],
    },

    {
        id: "hazard",
        question: "Which experiment has the highest hazard?",
        keywords: ["hazard", "danger", "risk", "highest hazard"],
        text: "Hazard assessment depends on the experiment's fuel properties and environmental conditions. The actual ranking should be calculated using the project's Hazard Score engine.",
        experimentIds: ["MOCK-01", "MOCK-03"],
        suggestions: [
            "How is the hazard score calculated?",
            "Which fuels are studied?",
            "What are the fire risks in spacecraft?",
        ],
    },

    {
        id: "spacecraft",
        question: "What are the fire risks in spacecraft?",
        keywords: ["spacecraft", "space", "iss", "fire safety"],
        text: "Fire safety is critical in spacecraft because confined environments and limited evacuation options make fire prevention and detection especially important.",
        experimentIds: ["MOCK-04", "MOCK-06"],
        suggestions: [
            "How does microgravity affect flames?",
            "How does oxygen affect combustion?",
            "What is the purpose of NASA experiments?",
        ],
    },

    {
        id: "solid",
        question: "Which experiments study solid fuels?",
        keywords: ["solid", "solid fuel"],
        text: "Solid fuel experiments help researchers understand ignition, flame spread, and combustion behavior under different conditions.",
        experimentIds: ["MOCK-01"],
        suggestions: [
            "Which fuels are studied?",
            "Which experiment has the highest hazard?",
            "How does microgravity affect flames?",
        ],
    },

    {
        id: "temperature",
        question: "How does temperature affect flames?",
        keywords: ["temperature", "heat"],
        text: "Temperature is an important combustion parameter. It influences reaction rates and the behavior of flames.",
        experimentIds: ["MOCK-05"],
        suggestions: [
            "How does oxygen affect combustion?",
            "How does microgravity affect flames?",
            "What are the fire risks in spacecraft?",
        ],
    },

    {
        id: "purpose",
        question: "What is the purpose of NASA experiments?",
        keywords: ["purpose", "why", "nasa experiments"],
        text: "These experiments help researchers understand combustion in microgravity and improve fire safety technologies for future space missions.",
        experimentIds: ["MOCK-01", "MOCK-04", "MOCK-06"],
        suggestions: [
            "How does microgravity affect flames?",
            "What are the fire risks in spacecraft?",
            "How does oxygen affect combustion?",
        ],
    },
];

const INITIAL_CHIPS = [INTENTS[0], INTENTS[1], INTENTS[3], INTENTS[4]];

const FALLBACK = {
    text: "I couldn't understand your question. I'm designed to answer questions about NASA combustion experiments, fuel types, oxygen levels, microgravity, and fire safety.",
    experimentIds: [],
    suggestions: [
        "How does microgravity affect flames?",
        "How does oxygen affect combustion?",
        "Which fuels are studied?",
    ],
};

// ==========================================
// TEMPORARY MOCK ANSWER
// ==========================================

// This function will be replaced by the AI team's
// real rule engine when it becomes available.

export function answer(question, data = experiments) {
    const normalized = question
        .toLowerCase()
        .replace(/[^\w\s]/g, "")
        .trim();

    const intent = INTENTS.find((item) => {
        return (
            item.question.toLowerCase() === normalized ||
            item.keywords.some((keyword) => normalized.includes(keyword.toLowerCase()))
        );
    });

    if (!intent) {
        return FALLBACK;
    }

    return {
        text: intent.text,
        experimentIds: intent.experimentIds.filter((id) =>
            data.some((experiment) => experiment.id === id)
        ),
        suggestions: intent.suggestions,
    };
}

// ==========================================
// CHAT STATE
// ==========================================

let messages = [
    {
        role: "assistant",
        text: "Hello! I'm Flame AI Assistant. Ask me anything about NASA microgravity combustion experiments and fire safety.",
        experimentIds: [],
    },
];

let currentSuggestions = INITIAL_CHIPS;

// ==========================================
// HELPERS
// ==========================================

function escapeHTML(value) {
    return String(value).replace(/[&<>"']/g, (char) => {
        const entities = {
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#039;",
        };

        return entities[char];
    });
}

// ==========================================
// RENDER MESSAGE
// ==========================================

function renderMessage(message) {
    const isUser = message.role === "user";

    const experiments = message.experimentIds
        .map(
            (id) => `
                <button
                    class="assistant-experiment-link"
                    type="button"
                    data-experiment-id="${escapeHTML(id)}"
                >
                    ${escapeHTML(id)}
                    <span aria-hidden="true">↗</span>
                </button>
            `
        )
        .join("");

    return `
        <article class="assistant-message ${isUser ? "user-message" : "bot-message"}">

            ${!isUser ? `<div class="assistant-avatar" aria-hidden="true">✦</div>` : ""}

            <div class="assistant-message-content">

                <div class="assistant-message-bubble">
                    ${escapeHTML(message.text)}
                </div>

                ${
                    experiments
                        ? `
                            <div class="assistant-sources">
                                <span>Sources:</span>
                                ${experiments}
                            </div>
                        `
                        : ""
                }

            </div>

        </article>
    `;
}

// ==========================================
// RENDER CHIPS
// ==========================================

function renderChips() {
    return currentSuggestions
        .map(
            (intent) => `
                <button
                    type="button"
                    class="assistant-chip"
                    data-question="${escapeHTML(intent.question)}"
                >
                    ${escapeHTML(intent.question)}
                </button>
            `
        )
        .join("");
}

// ==========================================
// MAIN RENDER
// ==========================================

export function renderAssistant() {
    return `
        <section class="assistant-page" data-assistant-root>

            <div class="assistant-header">

                <div>
                    <span class="assistant-eyebrow">
                        NASA COMBUSTION RESEARCH
                    </span>

                    <h1>Flame AI Assistant</h1>

                    <p>
                        Explore NASA experiments and discover insights
                        about combustion in microgravity.
                    </p>
                </div>


            </div>

            <div class="assistant-chat-container">

                <div
                    class="assistant-messages"
                    id="assistant-messages"
                    aria-live="polite"
                    aria-relevant="additions"
                    aria-label="Chat messages"
                >
                    ${messages.map(renderMessage).join("")}
                </div>

                <div class="assistant-suggestions">

                    <div class="assistant-suggestions-header">
                        <span>✦</span>
                        Suggested questions
                    </div>

                    <div class="assistant-chips" id="assistant-chips">
                        ${renderChips()}
                    </div>

                </div>

                <form class="assistant-form" id="assistant-form">

                    <label for="assistant-input" class="sr-only">
                        Ask Flame AI Assistant
                    </label>

                    <input
                        id="assistant-input"
                        type="text"
                        placeholder="Ask about flames, fuels, oxygen..."
                        autocomplete="off"
                        maxlength="500"
                        required
                    >

                    <button
                        type="submit"
                        class="assistant-send"
                        aria-label="Send message"
                    >
                        <span aria-hidden="true">↑</span>
                    </button>

                </form>

                <p class="assistant-disclaimer">
                    AI insights are based on NASA experiment data.
                    Always check the cited experiments.
                </p>

            </div>

        </section>
    `;
}

// ==========================================
// CHAT INTERACTIONS
// ==========================================

function refreshAssistant() {
    const root = document.querySelector("[data-assistant-root]");

    if (!root) return;

    const newRoot = document.createElement("div");
    newRoot.innerHTML = renderAssistant();

    root.replaceWith(newRoot.firstElementChild);

    requestAnimationFrame(() => {
        const messagesContainer = document.getElementById("assistant-messages");

        if (messagesContainer) {
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }
    });
}

function sendMessage(question) {
    const cleanQuestion = question.trim();

    if (!cleanQuestion) return;

    messages.push({
        role: "user",
        text: cleanQuestion,
        experimentIds: [],
    });

    const response = answer(cleanQuestion, experiments);

    messages.push({
        role: "assistant",
        text: response.text,
        experimentIds: response.experimentIds || [],
    });

    currentSuggestions = response.suggestions
        .map((question) => INTENTS.find((intent) => intent.question === question))
        .filter(Boolean);

    if (!currentSuggestions.length) {
        currentSuggestions = FALLBACK.suggestions
            .map((question) => INTENTS.find((intent) => intent.question === question))
            .filter(Boolean);
    }

    refreshAssistant();

    document.getElementById("assistant-input")?.focus();
}

// ==========================================
// EVENT LISTENERS
// ==========================================

if (!window.assistantEventsInitialized) {
    window.assistantEventsInitialized = true;

    document.addEventListener("submit", (event) => {
        if (event.target.id !== "assistant-form") return;

        event.preventDefault();

        const input = document.getElementById("assistant-input");

        sendMessage(input.value);
    });

    document.addEventListener("click", (event) => {
        // Suggested questions

        const chip = event.target.closest("[data-question]");

        if (chip) {
            sendMessage(chip.dataset.question);
            return;
        }

        // Experiment links

        const experimentLink = event.target.closest("[data-experiment-id]");

        if (experimentLink) {
            const id = experimentLink.dataset.experimentId;

            window.dispatchEvent(
                new CustomEvent("assistant:open-experiment", {
                    detail: { id },
                })
            );
        }
    });
}
