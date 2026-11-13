export function renderHeader(currentRoute) {
    const links = [
        { path: "#/home", label: "Home" },
        { path: "#/explore", label: "Explore" },
        { path: "#/insights", label: "Insights" },
        { path: "#/assistant", label: "Assistant" },
        { path: "#/simulator", label: "Simulator" },
    ];

    return `
        <header class="site-header">

            <a href="#/explore" class="logo">
                <img src="/flame.svg" alt="" class="logo-icon">
                <span>Project-99</span>
            </a>

            <nav class="main-nav" aria-label="Main navigation">
                ${links
                    .map(
                        (link) => `
                            <a
                                href="${link.path}"
                                class="nav-link ${currentRoute === link.path ? "active" : ""}"
                                ${currentRoute === link.path ? 'aria-current="page"' : ""}
                            >
                                ${link.label}
                            </a>
                        `
                    )
                    .join("")}
            </nav>

        </header>
    `;
}
