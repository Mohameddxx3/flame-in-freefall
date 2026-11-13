/**
 * Returns a qualitative flame-behavior description and a contextual message
 * based on the selected simulation conditions.
 * This is a simplified educational model based on published NASA combustion
 * research; it is NOT a validated fire-safety rating.
 */
export function getScientificResult(conditions) {
    const { oxygen, gravity, fuel, airflow, direction } = conditions;

    // --- Flame behavior description ---
    let flameBehavior = "";

    if (gravity === "0g") {
        if (oxygen < 18) {
            flameBehavior = "Near-extinction — cool blue spherical flame, may self-extinguish";
        } else if (oxygen < 23) {
            flameBehavior = "Dim blue spherical flame — stable but vulnerable to airflow changes";
        } else if (oxygen < 35) {
            flameBehavior = "Bright spherical flame — steady combustion in all directions";
        } else {
            flameBehavior = "Intense spherical flame — accelerated burn rate, high heat release";
        }
    } else {
        if (oxygen < 18) {
            flameBehavior = "Weak teardrop flame — reduced combustion, risk of extinction";
        } else if (oxygen < 23) {
            flameBehavior = "Normal teardrop flame — buoyancy-driven, familiar Earth shape";
        } else {
            flameBehavior = "Vigorous upward flame — enhanced by high oxygen concentration";
        }
    }

    if (fuel === "Gas") {
        flameBehavior += "; gas diffusion flame — no solid residue";
    } else if (fuel === "Liquid") {
        flameBehavior += "; droplet combustion — spherical diffusion envelope";
    }

    if (airflow > 60) {
        const dirLabel = direction === "Concurrent" ? "concurrent" : direction === "Opposed" ? "opposed" : "applied";
        flameBehavior += `; high ${dirLabel} airflow — flame stretched and distorted`;
    }

    // --- Contextual message ---
    let message = "";

    if (gravity === "0g") {
        message =
            "In microgravity, buoyancy-driven convection disappears. Oxygen reaches the flame " +
            "symmetrically from all sides, producing a spherical shape. Even a visually calm " +
            "blue flame can flare up rapidly when airflow changes (observed in BASS-II tests).";
    } else {
        message =
            "Under Earth gravity, hot combustion gases rise due to buoyancy, drawing fresh oxygen " +
            "from below and giving the flame its characteristic teardrop shape. This natural " +
            "convection does not exist in spacecraft.";
    }

    if (oxygen > 30) {
        message +=
            " High oxygen environments significantly increase flammability — materials that are " +
            "self-extinguishing at 21% O₂ may spread rapidly above 30%.";
    }

    return {
        status: "simulated",
        hazardScore: null,
        flameBehavior,
        recommendations: [],
        message,
    };
}
