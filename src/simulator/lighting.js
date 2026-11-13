import * as THREE from "three";

export function createSpaceEnvironment(scene) {
    scene.background = new THREE.Color(0x02040a);

    // Ambient lighting
    const ambient = new THREE.AmbientLight(0x26334d, 0.35);

    scene.add(ambient);

    // Fire glow light
    const fireLight = new THREE.PointLight(0xff6924, 3, 5);

    fireLight.position.set(0, 0.8, 0);

    scene.add(fireLight);

    // Stars
    const starGeometry = new THREE.BufferGeometry();

    const starCount = 1800;

    const positions = [];

    for (let i = 0; i < starCount; i++) {
        const x = (Math.random() - 0.5) * 40;

        const y = (Math.random() - 0.5) * 25;

        const z = -Math.random() * 20 - 5;

        positions.push(x, y, z);
    }

    starGeometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));

    const starMaterial = new THREE.PointsMaterial({
        color: 0xffffff,

        size: 0.025,

        transparent: true,

        opacity: 0.85,

        sizeAttenuation: true,
    });

    const stars = new THREE.Points(starGeometry, starMaterial);

    scene.add(stars);

    return {
        fireLight,

        update(time) {
            fireLight.intensity = 2.5 + Math.sin(time * 4.0) * 0.4;
        },
    };
}
