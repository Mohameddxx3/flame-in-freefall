varying vec3 vLocalPosition;

uniform float uTime;
uniform float uOxygen;
uniform float uGravity;
uniform float uAirflow;
uniform float uDirection;
uniform float uFuel;

uniform vec3 uCameraLocal;

void main() {
    vec3 rayOrigin = vLocalPosition;
    vec3 rayDirection = normalize(vLocalPosition - uCameraLocal);

    vec3 accumulatedColor = vec3(0.0);
    float transmittance = 1.0;

    float stepSize = 0.012;

    for (int i = 0; i < 128; i++) {
        float t = float(i) * stepSize;

        if (t > 1.5 || transmittance < 0.015) break;

        vec3 p = rayOrigin + rayDirection * t;

        if (
            abs(p.x) > 0.45 ||
            abs(p.y) > 0.9 ||
            abs(p.z) > 0.45
        ) continue;

        // Animated combustion turbulence
        vec3 flow = vec3(
            uTime * 0.2,
            -uTime * 0.5,
            uTime * 0.15
        );

        float n1 = fbm(p * 5.0 + flow);
        float n2 = fbm(p * 9.0 - flow * 1.5);
        float n3 = fbm(p * 14.0 + flow * 2.0);

        // --------------------------------
        // MICROGRAVITY: spherical flame
        // --------------------------------

        float sphericalRadius = length(vec3(
            p.x / 0.34,
            p.y / 0.36,
            p.z / 0.34
        ));

        float sphereDistortion =
            (n1 - 0.5) * 0.16 +
            (n2 - 0.5) * 0.08;

        float distortedRadius =
            sphericalRadius + sphereDistortion;

        float outerShell = 1.0 - smoothstep(
            0.88,
            1.12,
            distortedRadius
        );

        float innerShell = smoothstep(
            0.48,
            0.68,
            distortedRadius
        );

        float sphereDensity = outerShell * innerShell;

        // --------------------------------
        // EARTH GRAVITY: original flame
        // --------------------------------

        float h = clamp((p.y + 0.9) / 1.8, 0.0, 1.0);

        float gravityShape = 1.3;

        float profile = pow(max(0.0, 1.0 - h), 0.72);

        float width = (0.025 + 0.28 * profile) * gravityShape;

        float airflowOffset = uAirflow * uDirection * h * 0.2;

        float radius = length(vec2(
            p.x - airflowOffset,
            p.z
        ));

        float distortion = (n1 - 0.5) * 0.15;

        float edge = 1.0 - smoothstep(
            width - 0.015,
            width + 0.09,
            radius + distortion
        );

        float baseFade = smoothstep(-0.9, -0.68, p.y);

        float tipFade = 1.0 - smoothstep(0.62, 0.9, p.y);

        float earthDensity = edge * baseFade * tipFade;

        earthDensity *= smoothstep(0.12, 0.35, n2);

        earthDensity *= mix(0.65, 1.15, uOxygen);

        // --------------------------------
        // Gravity transition
        // --------------------------------

        float density = mix(
            sphereDensity,
            earthDensity,
            uGravity
        );

        density = clamp(density, 0.0, 1.0);

        // --------------------------------
        // COLORS
        // --------------------------------

        // Microgravity colors
        float sphereCore = 1.0 - clamp(sphericalRadius, 0.0, 1.0);

        vec3 spaceBlue = vec3(0.08, 0.32, 0.85);
        vec3 spaceCore = vec3(0.55, 0.82, 1.0);

        vec3 spaceColor = mix(
            spaceBlue,
            spaceCore,
            smoothstep(0.25, 0.85, sphereCore)
        );

        // Original Earth flame colors
        float heat = clamp(
            1.0 - h + (n1 - 0.5) * 0.25,
            0.0,
            1.0
        );

        vec3 red = vec3(0.55, 0.025, 0.002);
        vec3 orange = vec3(1.0, 0.19, 0.015);
        vec3 yellow = vec3(1.0, 0.82, 0.28);

        vec3 earthColor = mix(
            red,
            orange,
            smoothstep(0.0, 0.6, heat)
        );

        earthColor = mix(
            earthColor,
            yellow,
            smoothstep(0.35, 0.85, heat)
        );

        float core = 1.0 - smoothstep(
            0.0,
            width * 0.75,
            radius
        );

        earthColor = mix(
            earthColor,
            vec3(1.0, 0.95, 0.7),
            core * 0.35
        );

        // Select color based on gravity
        vec3 color = mix(
            spaceColor,
            earthColor,
            uGravity
        );

        // --------------------------------
        // Volume rendering
        // --------------------------------

        float emission = density * 2.0;

        accumulatedColor +=
            color * emission * transmittance * stepSize;

        transmittance *= exp(
            -density * stepSize * 3.0
        );
    }

    float alpha = 1.0 - transmittance;

    gl_FragColor = vec4(accumulatedColor, alpha);
}