// SPDX-License-Identifier: MIT
//
// Niri "bounce" window open/close effect, ported to KWin 6 (Plasma 6).
// GLES / legacy profile. See bounce_core.frag for why the upstream body was
// replaced: its bounce envelope was applied inverted, and a MapTexture shader
// cannot draw outside the window rect, so the opening bounce is carried by a
// vertical squash rather than a translation.

#include "colormanagement.glsl"

uniform sampler2D sampler;
uniform int textureWidth;
uniform int textureHeight;

uniform bool  uForOpening;
uniform float uProgress;

varying vec2 texcoord0;

// Classic decaying bounce, 0 -> 1, always <= 1 so the window never overflows.
float easeOutBounce(float t) {
  const float n1 = 7.5625;
  const float d1 = 2.75;
  if (t < 1.0 / d1) {
    return n1 * t * t;
  } else if (t < 2.0 / d1) {
    t -= 1.5 / d1;
    return n1 * t * t + 0.75;
  } else if (t < 2.5 / d1) {
    t -= 2.25 / d1;
    return n1 * t * t + 0.9375;
  }
  t -= 2.625 / d1;
  return n1 * t * t + 0.984375;
}

vec4 sampleClipped(vec2 t, bool distorted) {
  vec4 c = texture2D(sampler, vec2(t.x, 1.0 - t.y));

  float fx = 1.5 / max(float(textureWidth), 1.0);
  float fy = 1.5 / max(float(textureHeight), 1.0);

  float mask = smoothstep(-fx, fx, t.x) * (1.0 - smoothstep(1.0 - fx, 1.0 + fx, t.x)) *
               smoothstep(-fy, fy, t.y) * (1.0 - smoothstep(1.0 - fy, 1.0 + fy, t.y));

  return c * (distorted ? mask : 1.0);
}

void main() {
  float p  = clamp(uProgress, 0.0, 1.0);
  vec2  uv = vec2(texcoord0.x, 1.0 - texcoord0.y);

  vec2 t;
  bool distorted;

  if (uForOpening) {
    float b  = easeOutBounce(p);
    float sy = max(b, 1e-4);
    float sx = 1.0 + (1.0 - b) * 0.10;

    t.y       = uv.y / sy;
    t.x       = (uv.x - 0.5) / sx + 0.5;
    distorted = b < 1.0;
  } else {
    float off = p * p;
    t         = vec2(uv.x, uv.y - off);
    distorted = off > 0.0;
  }

  vec4 c = sampleClipped(t, distorted);
  c = sourceEncodingToNitsInDestinationColorspace(c);
  c = nitsToDestinationEncoding(c);
  gl_FragColor = c;
}
