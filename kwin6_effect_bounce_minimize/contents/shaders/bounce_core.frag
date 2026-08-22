#version 140

// SPDX-License-Identifier: MIT
//
// Niri "bounce" window open/close effect, ported to KWin 6 (Plasma 6).
// Desktop GL core profile (KWin auto-selects the *_core.frag variant).
//
// CORRECTED PORT — the upstream Niri/skwd body does not work on a window.
//
// It descends from gl-transitions' "bounce", which cross-fades TWO images. There
//     yy = |cos(p*PI*bounces)| * (1 - sin(p*PI/2))
// is the height of the incoming image above its resting place, and the step()
// picks which of the two images a pixel takes. Ported to a single window with
// nothing underneath, that mask is exactly the "sample is still inside the
// texture" clip for a vertical translation of (1 - yy) — so the window is
// displaced by the INVERSE of the bounce envelope, flying fully off-frame at 50%
// and only settling on the last frame. It reads as a strobe, not a bounce.
//
// Fixing the envelope is not enough on its own: a MapTexture shader cannot draw
// outside the window's own rect, so ANY upward displacement is clipped and reads
// as the window being chopped rather than moving.
//
// So the opening animation carries the bounce as a vertical SQUASH anchored at
// the top edge instead of a translation. The whole window stays visible and
// inside its rect at every frame; easeOutBounce drives the scale, giving the
// familiar decaying settle (full size, squash to 0.75, recover, squash to 0.94,
// rest) with a little horizontal stretch for squash-and-stretch character.
//
// Closing keeps a plain accelerating drop: it is monotonic, so it never clips
// awkwardly, and it reads correctly as the window falling away.

#include "colormanagement.glsl"

uniform sampler2D sampler;
uniform int textureWidth;
uniform int textureHeight;

uniform bool  uForOpening;
uniform float uProgress;

in vec2 texcoord0;
out vec4 fragColor;

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

// Sample the window at `t` (geometry UV, top-left origin), clipped to the part of
// the texture that exists. `distorted` switches the edge feather off once the
// window is back at rest so the settled frame stays pixel-exact.
vec4 sampleClipped(vec2 t, bool distorted) {
  vec4 c = texture(sampler, vec2(t.x, 1.0 - t.y));

  float fx = 1.5 / max(float(textureWidth), 1.0);
  float fy = 1.5 / max(float(textureHeight), 1.0);

  float mask = smoothstep(-fx, fx, t.x) * (1.0 - smoothstep(1.0 - fx, 1.0 + fx, t.x)) *
               smoothstep(-fy, fy, t.y) * (1.0 - smoothstep(1.0 - fy, 1.0 + fy, t.y));

  // The texture is premultiplied, so scaling the whole vec4 is the correct fade.
  return c * (distorted ? mask : 1.0);
}

void main() {
  // Linear on purpose: the bounce curve carries its own timing.
  float p  = clamp(uProgress, 0.0, 1.0);
  vec2  uv = vec2(texcoord0.x, 1.0 - texcoord0.y);

  vec2 t;
  bool distorted;

  if (uForOpening) {
    // Drops in and bounces, expressed as a squash anchored at the top edge.
    float b  = easeOutBounce(p);
    float sy = max(b, 1e-4);            // vertical scale, 0 -> 1 with bounces
    float sx = 1.0 + (1.0 - b) * 0.10;  // widen slightly while squashed

    t.y       = uv.y / sy;
    t.x       = (uv.x - 0.5) / sx + 0.5;
    distorted = b < 1.0;
  } else {
    // Falls away downward, accelerating.
    float off = p * p;
    t         = vec2(uv.x, uv.y - off);
    distorted = off > 0.0;
  }

  fragColor = sampleClipped(t, distorted);
  fragColor = sourceEncodingToNitsInDestinationColorspace(fragColor);
  fragColor = nitsToDestinationEncoding(fragColor);
}
