attribute float aSize;
attribute float aSeed;

uniform float uTime;
uniform float uPixelRatio;
uniform float uOxygen;
uniform float uGravity;
uniform float uAirflow;
uniform float uDirection;
uniform float uFuel;

varying float vAlpha;
varying float vHeight;

void main() {

    vec3 transformed = position;

    // Scientific-inspired visual controls
    float gravityEffect = mix(0.7, 1.0, uGravity);
    float oxygenEffect = mix(0.7, 1.3, uOxygen);
    float airflowEffect = uAirflow * uDirection;

    // Particle movement
    float speed = (0.35 + aSeed * 0.45)
                  * gravityEffect
                  * oxygenEffect;

    float height = mod(
        position.y + uTime * speed,
        1.45
    );

    transformed.y = height;

    // Flame turbulence
    float angle = uTime * 2.0 + aSeed * 6.2831;

    transformed.x += sin(
        angle + position.y * 4.0
    ) * 0.035;

    transformed.x += airflowEffect * height * 0.15;

    transformed.z += cos(
        angle * 0.8 + position.y * 3.0
    ) * 0.035;

    // Camera transformation
    vec4 mvPosition = modelViewMatrix * vec4(
        transformed,
        1.0
    );

    gl_Position = projectionMatrix * mvPosition;

    // Particle size
    gl_PointSize = aSize * uPixelRatio *
        (260.0 / max(1.0, -mvPosition.z));

    // Particle opacity
    vHeight = height / 1.45;

    vAlpha = (
        1.0 - smoothstep(0.75, 1.0, vHeight)
    ) * (
        0.55 + 0.45 * sin(angle * 2.0)
    );
}