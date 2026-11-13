import * as THREE from "three";

import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";

import { RenderPass } from "three/addons/postprocessing/RenderPass.js";

import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";

import { OutputPass } from "three/addons/postprocessing/OutputPass.js";

import { createVolumeFire } from "./volume.js";

import { createSpaceEnvironment } from "./lighting.js";

export function mountSimulator(container) {
    const scene = new THREE.Scene();

    // Camera
    const camera = new THREE.PerspectiveCamera(
        45,
        container.clientWidth / container.clientHeight,
        0.1,
        100
    );

    camera.position.set(0, 1.25, 4.5);

    camera.lookAt(0, 0.7, 0);

    // Renderer
    const renderer = new THREE.WebGLRenderer({
        antialias: true,

        powerPreference: "high-performance",
    });

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    renderer.setSize(container.clientWidth, container.clientHeight);

    renderer.outputColorSpace = THREE.SRGBColorSpace;

    renderer.toneMapping = THREE.ACESFilmicToneMapping;

    renderer.toneMappingExposure = 1.2;

    container.appendChild(renderer.domElement);

    // Space environment
    const environment = createSpaceEnvironment(scene);

    // Volumetric fire
    const fire = createVolumeFire();

    fire.group.position.y = 0.05;

    scene.add(fire.group);

    // Bloom
    const composer = new EffectComposer(renderer);

    composer.addPass(new RenderPass(scene, camera));

    const bloom = new UnrealBloomPass(
        new THREE.Vector2(container.clientWidth, container.clientHeight),

        0.4,
        0.25,
        0.15
    );

    composer.addPass(bloom);

    composer.addPass(new OutputPass());

    // Animation
    const clock = new THREE.Clock();

    let animationId;

    function animate() {
        animationId = requestAnimationFrame(animate);

        const time = clock.getElapsedTime();

        fire.update(time, camera);

        environment.update(time);

        composer.render();
    }

    animate();

    // Resize
    const resizeObserver = new ResizeObserver(() => {
        const width = Math.max(container.clientWidth, 1);

        const height = Math.max(container.clientHeight, 1);

        camera.aspect = width / height;

        camera.updateProjectionMatrix();

        renderer.setSize(width, height);

        composer.setSize(width, height);
    });

    resizeObserver.observe(container);

    return {
        setConditions(conditions) {
            fire.setConditions(conditions);
        },

        dispose() {
            resizeObserver.disconnect();

            cancelAnimationFrame(animationId);

            composer.dispose();

            fire.dispose();

            scene.traverse((object) => {
                if (object.geometry) {
                    object.geometry.dispose();
                }

                if (object.material) {
                    const materials = Array.isArray(object.material)
                        ? object.material
                        : [object.material];

                    materials.forEach((material) => {
                        material.dispose();
                    });
                }
            });

            renderer.dispose();

            renderer.domElement.remove();
        },
    };
}
