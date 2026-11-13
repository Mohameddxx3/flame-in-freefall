varying float vAlpha;
varying float vHeight;

uniform float uOxygen;
uniform float uFuel;

void main() {

    // Distance from particle center
    vec2 center = gl_PointCoord - vec2(0.5);

    float distance = length(center);

    // Glow
    float glow = exp(-distance * 9.0);

    // Bright center
    float core = exp(-distance * 35.0);

    // Flame colors
    vec3 bottomColor = vec3(1.0, 0.78, 0.22);

    vec3 topColor = vec3(1.0, 0.16, 0.01);

    vec3 color = mix(
        bottomColor,
        topColor,
        vHeight
    );

    color = mix(
        color,
        vec3(1.0, 0.95, 0.55),
        core
    );
    float oxygenGlow = mix(0.65, 1.0, uOxygen);
    float alpha = glow * vAlpha * 0.75 * oxygenGlow;

    gl_FragColor = vec4(
        color,
        alpha
    );
}