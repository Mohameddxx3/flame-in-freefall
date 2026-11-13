export const DEFAULT_CONDITIONS = {
    oxygen: 21,
    gravity: "0g",
    fuel: "Solid",
    airflow: 20,
    direction: "None",
};

export function mountControls(container, onChange) {
    container.innerHTML = `
    <section class="controls-panel">

      <h2>Simulation Controls</h2>

      <!-- Oxygen -->
      <div class="control-group">
        <label for="oxygen">
          Oxygen Concentration
        </label>

        <div class="control-value">
          <span id="oxygen-value">21</span>%
        </div>

        <input
          type="range"
          id="oxygen"
          min="0"
          max="100"
          value="21"
        >
      </div>

      <!-- Gravity -->
      <div class="control-group">
        <label for="gravity">Gravity Level</label>

        <select id="gravity">
          <option value="0g">Microgravity (0g)</option>
          <option value="1g">Earth Gravity (1g)</option>
        </select>
      </div>

      <!-- Fuel -->
      <div class="control-group">
        <label for="fuel">Fuel Type</label>

        <select id="fuel">
          <option value="Solid">Solid</option>
          <option value="Liquid">Liquid</option>
          <option value="Gas">Gas</option>
        </select>
      </div>

      <!-- Airflow -->
      <div class="control-group">
        <label for="airflow">
          Airflow Speed (relative)
        </label>

        <div class="control-value">
          <span id="airflow-value">20</span>
        </div>

        <input
          type="range"
          id="airflow"
          min="0"
          max="100"
          value="20"
        >
      </div>

      <!-- Direction -->
      <div class="control-group">
        <label for="direction">Airflow Direction</label>

        <select id="direction">
          <option value="None">None</option>
          <option value="Concurrent">Concurrent</option>
          <option value="Opposed">Opposed</option>
        </select>
      </div>

    </section>
  `;

    const oxygen = container.querySelector("#oxygen");
    const gravity = container.querySelector("#gravity");
    const fuel = container.querySelector("#fuel");
    const airflow = container.querySelector("#airflow");
    const direction = container.querySelector("#direction");

    function getConditions() {
        return {
            oxygen: Number(oxygen.value),
            gravity: gravity.value,
            fuel: fuel.value,
            airflow: Number(airflow.value),
            direction: direction.value,
        };
    }

    function update() {
        container.querySelector("#oxygen-value").textContent = oxygen.value;

        container.querySelector("#airflow-value").textContent = airflow.value;

        onChange(getConditions());
    }

    const inputs = [oxygen, gravity, fuel, airflow, direction];

    inputs.forEach((input) => {
        input.addEventListener(input.type === "range" ? "input" : "change", update);
    });

    update();

    return () => {
        inputs.forEach((input) => {
            input.removeEventListener(input.type === "range" ? "input" : "change", update);
        });
    };
}
