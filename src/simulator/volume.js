import * as THREE from "three";

import vertexShader from "./shaders/volume.vert.glsl?raw";

import fragmentShader from "./shaders/volume.frag.glsl?raw";

import noiseShader from "./shaders/noise.glsl?raw";

export function createVolumeFire() {
    const group = new THREE.Group();

    // Geometry
    const geometry = new THREE.BoxGeometry(0.9, 1.8, 0.9);

    // Uniforms
    const uniforms = {
        uTime: { value: 0 },

        uOxygen: { value: 0.21 },

        uGravity: { value: 0 },

        uAirflow: { value: 0 },

        uDirection: { value: 0 },

        uFuel: { value: 0 },

        uCameraLocal: {
            value: new THREE.Vector3(0, 0, 4),
        },
    };

    // Shader Material
    const material = new THREE.ShaderMaterial({
        vertexShader,

        fragmentShader: `
            ${noiseShader}

            ${fragmentShader}
        `,

        uniforms,

        transparent: true,

        depthWrite: false,

        side: THREE.FrontSide,

        blending: THREE.NormalBlending,
    });

    const volume = new THREE.Mesh(geometry, material);

    volume.position.y = 0.9;

    group.add(volume);

    const cameraWorldPosition = new THREE.Vector3();

    // Update conditions
    function setConditions(conditions) {
        uniforms.uOxygen.value = conditions.oxygen / 100;

        uniforms.uGravity.value = conditions.gravity === "1g" ? 1 : 0;

        uniforms.uAirflow.value = conditions.airflow / 100;

        uniforms.uDirection.value =
            conditions.direction === "Concurrent" ? 1 : conditions.direction === "Opposed" ? -1 : 0;

        uniforms.uFuel.value =
            conditions.fuel === "Solid" ? 0 : conditions.fuel === "Liquid" ? 1 : 2;
    }

    // Animation
    function update(time, camera) {
        uniforms.uTime.value = time;

        camera.getWorldPosition(cameraWorldPosition);

        volume.updateWorldMatrix(true, false);

        volume.worldToLocal(cameraWorldPosition);

        uniforms.uCameraLocal.value.copy(cameraWorldPosition);
    }

    return {
        group,
        setConditions,
        update,

        dispose() {
            geometry.dispose();
            material.dispose();
        },
    };
}
