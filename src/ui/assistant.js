export function renderAssistant() {
    return "<h1>Assistant</h1>";
}

export function answer(question, data) {
    return {
        text: "No answer available yet.",
        experimentIds: [],
        suggestions: [],
    };
}
