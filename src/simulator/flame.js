import * as THREE from "three";
import { createParticles } from "./particles.js";

import fireVertex from "./shaders/fire.vert.glsl?raw";
import fireFragment from "./shaders/fire.frag.glsl?raw";

export function createFlame() {
    const flame = new THREE.Group();

    // Create a detailed flame geometry
    const points = [];

    const segments = 80;

    for (let i = 0; i <= segments; i++) {
        const t = i / segments;

        const radius = 0.32 * Math.pow(Math.sin(t * Math.PI), 0.7);

        points.push(new THREE.Vector2(radius, t * 1.4));
    }

    const geometry = new THREE.LatheGeometry(points, 96);

    function createFlameLayer(layer, scale) {
        const material = new THREE.ShaderMaterial({
            vertexShader: fireVertex,
            fragmentShader: fireFragment,

            uniforms: {
                uTime: { value: 0 },
                uOxygen: { value: 0.21 },
                uGravity: { value: 0 },
                uAirflow: { value: 0 },
                uDirection: { value: 0 },
                uFuel: { value: 0 },
                uLayer: { value: layer },
            },

            transparent: true,
            depthWrite: false,
            side: THREE.DoubleSide,
            blending: THREE.AdditiveBlending,
        });

        const mesh = new THREE.Mesh(geometry, material);

        mesh.scale.set(scale, scale, scale);

        flame.add(mesh);

        return material;
    }

    const outerMaterial = createFlameLayer(0, 1);

    const innerMaterial = createFlameLayer(1, 0.65);

    // Particles
    const particles = createParticles();

    flame.add(particles);

    // Update conditions
    flame.userData.setConditions = (conditions) => {
        const materials = [outerMaterial, innerMaterial];

        materials.forEach((material) => {
            const uniforms = material.uniforms;

            uniforms.uOxygen.value = conditions.oxygen / 100;

            uniforms.uGravity.value = conditions.gravity === "1g" ? 1 : 0;

            uniforms.uAirflow.value = conditions.airflow / 100;

            uniforms.uDirection.value =
                conditions.direction === "Concurrent"
                    ? 1
                    : conditions.direction === "Opposed"
                      ? -1
                      : 0;

            uniforms.uFuel.value =
                conditions.fuel === "Solid" ? 0 : conditions.fuel === "Liquid" ? 1 : 2;
        });

        const uniforms = particles.material.uniforms;

        uniforms.uOxygen.value = conditions.oxygen / 100;
        uniforms.uGravity.value = conditions.gravity === "1g" ? 1 : 0;
        uniforms.uAirflow.value = conditions.airflow / 100;

        uniforms.uDirection.value =
            conditions.direction === "Concurrent" ? 1 : conditions.direction === "Opposed" ? -1 : 0;

        uniforms.uFuel.value =
            conditions.fuel === "Solid" ? 0 : conditions.fuel === "Liquid" ? 1 : 2;
    };

    // Animate the entire flame
    flame.userData.update = (time) => {
        outerMaterial.uniforms.uTime.value = time;
        innerMaterial.uniforms.uTime.value = time;

        particles.material.uniforms.uTime.value = time;
    };

    return flame;
}
