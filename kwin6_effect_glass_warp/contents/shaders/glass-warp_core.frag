#version 140

// SPDX-License-Identifier: MIT
//
// Niri "glass-warp" window open/close effect, ported to KWin 6 (Plasma 6).
// Desktop GL core profile (KWin auto-selects the *_core.frag variant).
//
// Niri drives this effect with SPRING curves, with different open/close dynamics:
//   open : damping-ratio = 2.0, stiffness = 5000  (overdamped, snappy)
//   close: damping-ratio = 1.0, stiffness = 150   (critically damped, gentle)
// Both have damping ratio >= 1, so they are non-oscillating -- effectively just
// ease-out curves with direction-specific settling times. KWin's scripted
// animate() has no spring, so main.js reproduces them with a per-direction
// QEasingCurve (OutQuint / OutCubic) and per-direction duration. That means the
// easing is already applied to uProgress by the time it reaches this shader, so
// niri_clamped_progress is a plain identity passthrough here.
//
// (The upstream Niri open.glsl/close.glsl are missing their closing braces; the
// function bodies below are otherwise verbatim, with the braces added.)

#include "colormanagement.glsl"

uniform sampler2D sampler;
uniform int textureWidth;
uniform int textureHeight;

uniform bool  uForOpening;
uniform float uProgress;

in vec2 texcoord0;
out vec4 fragColor;

#define texture2D texture

// Easing is applied by animate() (QEasingCurve), so just pass progress through.
#define niri_clamped_progress clamp(uProgress, 0.0, 1.0)
#define niri_tex              sampler

const mat3 niri_geo_to_tex = mat3(1.0, 0.0, 0.0,
                                  0.0, -1.0, 0.0,
                                  0.0, 1.0, 1.0);

// --------------------------------------------------------------------- Niri body
            vec4 open_color(vec3 coords_geo, vec3 size_geo) {
                float p = niri_clamped_progress;
                vec2 uv = coords_geo.xy;

                float dist = length(uv - 0.5) * 2.0;
                float start_delay = dist * 0.6;
                float t = clamp((p - start_delay) / (1.0 - start_delay), 0.0, 1.0);
                float strong_t = pow(t, 2.5);

                if (p < start_delay) return vec4(0.0);

                vec2 center = vec2(0.5);
                vec2 from_center = uv - center;
                vec2 spawn = center + from_center * 0.1;
                vec2 render_pos = mix(spawn, uv, strong_t);

                vec3 tex_coords = niri_geo_to_tex * vec3(render_pos, 1.0);
                vec4 color = texture2D(niri_tex, tex_coords.st);

                bool is_window_area = uv.x >= -0.075 && uv.x <= 1.075 &&
                                      uv.y >= -0.075 && uv.y <= 1.075;

                float alpha = mix(1.0, t, pow(dist, 0.5));
                if (!is_window_area) {
                    float ring_fade = 1.0 - smoothstep(0.99, 0.999, p);
                    alpha *= ring_fade;
                }
                return color * alpha;
            }

            vec4 close_color(vec3 coords_geo, vec3 size_geo) {
                float p = 1.0 - niri_clamped_progress;
                vec2 uv = coords_geo.xy;

                float dist = length(uv - 0.5) * 2.0;
                float start_delay = dist * 0.6;

                float t = clamp((p - start_delay) / (1.0 - start_delay), 0.0, 1.0);
                float strong_t = pow(t, 2.5);
                if (p < start_delay) return vec4(0.0);

                vec2 target = uv;
                vec2 center = vec2(0.5);
                vec2 from_center = uv - center;
                vec2 spawn = center + from_center * 0.0;

                vec2 render_pos = mix(spawn, target, strong_t);

                vec3 tex_coords = niri_geo_to_tex * vec3(render_pos, 1.0);
                vec4 color = texture2D(niri_tex, tex_coords.st);

                return color * t;
            }

// -------------------------------------------------------------------- entry point
void main() {
  vec3 coords_geo = vec3(texcoord0.x, 1.0 - texcoord0.y, 0.0);
  vec3 size_geo   = vec3(float(textureWidth), float(textureHeight), 1.0);

  vec4 c = uForOpening ? open_color(coords_geo, size_geo)
                       : close_color(coords_geo, size_geo);

  // Niri returns premultiplied-alpha color -- exactly what KWin expects.
  fragColor = c;
  fragColor = sourceEncodingToNitsInDestinationColorspace(fragColor);
  fragColor = nitsToDestinationEncoding(fragColor);
}
