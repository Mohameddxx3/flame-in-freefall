export function renderSimulator() {
    return `
        <div class="simulator-page">

            <h1>Flame Simulator</h1>

            <div class="simulator-layout">

                <div
                    id="simulator-stage"
                    class="simulator-stage"
                ></div>

                <div class="simulator-sidebar">

                    <div id="simulator-controls"></div>

                    <section
                        id="simulator-results"
                        class="results-panel"
                    ></section>

                </div>

            </div>

        </div>
    `;
}

export function mountSimulator(main) {
    const stage = main.querySelector("#simulator-stage");
    const controlsRoot = main.querySelector("#simulator-controls");
    const resultsRoot = main.querySelector("#simulator-results");

    let scene = null;
    let cleanupControls = null;
    let disposed = false;

    Promise.all([
        import("../simulator/scene.js"),
        import("../simulator/controls.js"),
        import("../simulator/science.js"),
    ])
        .then(([sceneModule, controlsModule, scienceModule]) => {
            if (disposed || !stage.isConnected) {
                return;
            }

            scene = sceneModule.mountSimulator(stage);

            function updateSimulation(conditions) {
                scene.setConditions(conditions);

                const result = scienceModule.getScientificResult(conditions);

                resultsRoot.innerHTML = `
                    <h2>Analysis Results</h2>

                    <p>
                        <strong>Gravity Mode:</strong>
                        ${conditions.gravity === "0g" ? "Microgravity (0g) — spherical flame" : "Earth Gravity (1g) — teardrop flame"}
                    </p>

                    <p>
                        <strong>Fuel Type:</strong>
                        ${conditions.fuel}
                    </p>

                    <p>
                        <strong>Oxygen:</strong>
                        ${conditions.oxygen}%
                    </p>

                    <p>
                        <strong>Airflow Speed:</strong>
                        ${conditions.airflow} (relative)
                    </p>

                    <p>
                        <strong>Flame Behavior:</strong>
                        ${result.flameBehavior}
                    </p>

                    <p class="results-note">${result.message}</p>
                `;
            }

            cleanupControls = controlsModule.mountControls(controlsRoot, updateSimulation);
        })
        .catch((error) => {
            if (disposed) return;

            console.error("Simulator Error:", error);
            stage.innerHTML = `<p class="sim-error">Failed to load simulator: ${error.message}</p>`;
        });

    return {
        dispose() {
            disposed = true;

            cleanupControls?.();
            scene?.dispose();
        },
    };
}
