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

export function mountSimulator(main, state) {
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
            if (disposed || state.currentRoute !== "#/simulator" || !stage.isConnected) {
                return;
            }

            scene = sceneModule.mountSimulator(stage);

            function updateSimulation(conditions) {
                scene.setConditions(conditions);

                const result = scienceModule.getScientificResult(conditions);

                resultsRoot.innerHTML = `
                    <h2>Analysis Results</h2>

                    <p>
                        <strong>Scientific Status:</strong>
                        Pending verified data
                    </p>

                    <p>
                        <strong>Hazard Score:</strong>
                        Not available
                    </p>

                    <p>
                        <strong>Flame Behavior:</strong>
                        ${result.flameBehavior}
                    </p>

                    <p>${result.message}</p>
                `;
            }

            cleanupControls = controlsModule.mountControls(controlsRoot, updateSimulation);
        })
        .catch((error) => {
            if (disposed) return;

            console.error("Simulator Error:", error);
            stage.textContent = "Failed to load simulator.";
        });

    return {
        dispose() {
            disposed = true;

            cleanupControls?.();
            scene?.dispose();
        },
    };
}
