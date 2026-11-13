varying vec2 vUv;
varying float vNoise;

uniform float uTime;
uniform float uGravity;
uniform float uAirflow;
uniform float uDirection;

void main() {
    vUv = uv;

    vec3 transformed = position;

    float t = uTime;

    // Flame movement
    float wave1 = sin(t * 3.0 + uv.y * 9.0);
    float wave2 = sin(t * 5.0 + uv.y * 15.0 + position.x * 8.0);

    float turbulence = wave1 * 0.035 + wave2 * 0.018;

    // Gravity shape
    float gravityShape = mix(
        1.0,
        1.0 - uv.y * 0.65,
        uGravity
    );

    // Airflow direction
    float airflow = uAirflow * uDirection;

    // Distort flame surface
    float radial = length(position.xz);

    float displacement = turbulence * uv.y;

    transformed.x += position.x * displacement * 3.0;
    transformed.z += position.z * displacement * 3.0;

    transformed.x *= gravityShape;
    transformed.z *= gravityShape;

    transformed.x += airflow * uv.y * 0.25;

    // Slight vertical movement
    transformed.y += sin(t * 2.0 + uv.y * 8.0) * 0.025;

    vNoise = turbulence;

    vec4 mvPosition = modelViewMatrix * vec4(
        transformed,
        1.0
    );

    gl_Position = projectionMatrix * mvPosition;
}