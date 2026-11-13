varying vec2 vUv;
varying float vNoise;

uniform float uTime;
uniform float uOxygen;
uniform float uFuel;
uniform float uLayer;

float random(vec2 p) {
    return fract(
        sin(dot(p, vec2(127.1, 311.7))) * 43758.5453
    );
}

float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);

    f = f * f * (3.0 - 2.0 * f);

    float a = random(i);
    float b = random(i + vec2(1.0, 0.0));
    float c = random(i + vec2(0.0, 1.0));
    float d = random(i + vec2(1.0, 1.0));

    return mix(
        mix(a, b, f.x),
        mix(c, d, f.x),
        f.y
    );
}

void main() {

    vec2 uv = vUv;

    // Animated fire distortion
    float n1 = noise(
        vec2(uv.x * 5.0, uv.y * 8.0 - uTime * 1.5)
    );

    float n2 = noise(
        vec2(uv.x * 10.0, uv.y * 14.0 - uTime * 2.5)
    );

    float distortion = n1 * 0.12 + n2 * 0.06;

    float center = abs(uv.x - 0.5);

    float width = sin(uv.y * 3.14159);

    width *= 0.42 + distortion;

    float edge = smoothstep(
        width,
        width - 0.08,
        center
    );

    float base = smoothstep(0.0, 0.15, uv.y);
    float tip = 1.0 - smoothstep(0.72, 1.0, uv.y);

    // Fire colors
    vec3 blue = vec3(0.08, 0.25, 1.0);
    vec3 yellow = vec3(1.0, 0.85, 0.25);
    vec3 orange = vec3(1.0, 0.25, 0.015);
    vec3 red = vec3(0.55, 0.035, 0.005);

    vec3 color = mix(
        yellow,
        orange,
        smoothstep(0.25, 0.85, uv.y)
    );

    color = mix(
        color,
        red,
        smoothstep(0.75, 1.0, uv.y)
    );

    // Hot base
    color = mix(
        color,
        blue,
        (1.0 - base) * 0.35 * uOxygen
    );

    // Inner flame layer
    if (uLayer > 0.5) {
        color = mix(color, vec3(1.0, 0.95, 0.65), 0.65);
    }

    // Flame brightness
    float brightness = 0.8 + n1 * 0.35;

    color *= brightness;

    float alpha = edge * base * tip;

    alpha *= uLayer > 0.5 ? 0.9 : 0.72;

    gl_FragColor = vec4(color, alpha);
}