import * as THREE from "three";

import vertexShader from "./shaders/flame.vert.glsl?raw";
import fragmentShader from "./shaders/flame.frag.glsl?raw";

export function createParticles() {
    const count = 1500;

    const geometry = new THREE.BufferGeometry();

    const positions = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const seeds = new Float32Array(count);

    for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;

        const radius = 0.04 + Math.random() * 0.16;

        const x = Math.cos(angle) * radius;
        const z = Math.sin(angle) * radius;

        const y = Math.random() * 1.4;

        positions[i * 3] = x;
        positions[i * 3 + 1] = y;
        positions[i * 3 + 2] = z;

        sizes[i] = 0.08 + Math.random() * 0.12;

        seeds[i] = Math.random();
    }

    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));

    geometry.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));

    geometry.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 1));

    const material = new THREE.ShaderMaterial({
        uniforms: {
            uTime: { value: 0 },

            uPixelRatio: {
                value: Math.min(window.devicePixelRatio, 2),
            },

            uOxygen: { value: 0.21 },
            uGravity: { value: 0 },
            uAirflow: { value: 0.2 },
            uDirection: { value: 0 },
            uFuel: { value: 0 },
        },

        vertexShader,
        fragmentShader,

        transparent: true,
        depthWrite: false,

        blending: THREE.AdditiveBlending,
    });

    const particles = new THREE.Points(geometry, material);

    particles.frustumCulled = false;

    return particles;
}
