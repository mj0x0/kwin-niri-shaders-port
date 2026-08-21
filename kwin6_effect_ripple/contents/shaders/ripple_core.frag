#version 140

// SPDX-License-Identifier: MIT
//
// Ripple window open/close effect for KWin 6 (Plasma 6).
// Ported from the Niri custom-shader "ripple" (itself derived from
// gl-transitions/ripple.glsl by gre, MIT).
//
// This is the desktop OpenGL core-profile variant. KWin automatically loads the
// "*_core.frag" file when running on a core-profile context and falls back to
// "ripple.frag" (GLES / legacy) otherwise.

#if __VERSION__ >= 140
#include "colormanagement.glsl"
#endif

uniform sampler2D sampler;
uniform int textureWidth;
uniform int textureHeight;

// Standard animation uniforms driven from main.js.
uniform bool  uForOpening;   // true while a window-open animation runs
uniform float uProgress;     // linear 0 -> 1 over the animation
uniform float uSeed;         // per-animation random phase, [0, 1)

// Tunable parameters (see contents/config/main.xml).
uniform float uAmplitude;    // spatial frequency of the ripple (Niri default 100)
uniform float uSpeed;        // temporal phase speed of the ripple (Niri default 50)

in vec2 texcoord0;
out vec4 fragColor;

// KWin's texcoord0 has its origin at the bottom-left; flip to a top-left UV so the
// math matches the Niri original.
vec2 iTexCoord = vec2(texcoord0.x, 1.0 - texcoord0.y);

// Straight-alpha window color (KWin stores premultiplied alpha in the texture).
vec4 getInputColor(vec2 coords) {
  vec4 color = texture(sampler, vec2(coords.x, 1.0 - coords.y));
  if (color.a > 0.0) {
    color.rgb /= color.a;
  }
  return color;
}

// Re-premultiply and hand off to KWin's color management on Plasma 6.
void setOutputColor(vec4 outColor) {
  fragColor = vec4(outColor.rgb * outColor.a, outColor.a);
  fragColor = sourceEncodingToNitsInDestinationColorspace(fragColor);
  fragColor = nitsToDestinationEncoding(fragColor);
}

// Matches the Niri config "curve: ease-out-cubic". Niri feeds an already-eased
// progress into the shader; KWin animates linearly, so we ease here instead.
float easeOutCubic(float t) {
  float f = t - 1.0;
  return f * f * f + 1.0;
}

void main() {
  float p    = easeOutCubic(uProgress);
  float seed = uSeed * 6.28318530718;

  vec2  uv   = iTexCoord;
  vec2  dir  = uv - vec2(0.5);
  float dist = length(dir);

  // Distortion strength: strong at the start of the animation, gone at the end.
  //   opening -> (1 - p)^2  : window settles into place
  //   closing ->  p^2       : window ripples apart
  float intensity = uForOpening ? (1.0 - p) * (1.0 - p) : p * p;

  vec2 offset = dir * (sin(p * dist * uAmplitude - p * uSpeed + seed) + 0.5) / 30.0;
  vec2 wuv    = uv + offset * intensity;

  vec4 oColor = getInputColor(wuv);

  // Alpha envelope.
  //   opening -> fade in  : smoothstep(0.0, 0.3, p)
  //   closing -> fade out : smoothstep(1.0, 0.5, p)
  float alpha = uForOpening ? smoothstep(0.0, 0.3, p) : smoothstep(1.0, 0.5, p);
  oColor.a *= alpha;

  setOutputColor(oColor);
}
