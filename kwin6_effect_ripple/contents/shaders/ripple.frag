// SPDX-License-Identifier: MIT
//
// Ripple window open/close effect for KWin 6 (Plasma 6).
// Ported from the Niri custom-shader "ripple" (itself derived from
// gl-transitions/ripple.glsl by gre, MIT).
//
// This is the GLES / legacy-profile variant. KWin loads "ripple_core.frag" on
// desktop core-profile contexts and this file everywhere else.

#include "colormanagement.glsl"

uniform sampler2D sampler;
uniform int textureWidth;
uniform int textureHeight;

uniform bool  uForOpening;
uniform float uProgress;
uniform float uSeed;

uniform float uAmplitude;
uniform float uSpeed;

varying vec2 texcoord0;

vec2 iTexCoord = vec2(texcoord0.x, 1.0 - texcoord0.y);

vec4 getInputColor(vec2 coords) {
  vec4 color = texture2D(sampler, vec2(coords.x, 1.0 - coords.y));
  if (color.a > 0.0) {
    color.rgb /= color.a;
  }
  return color;
}

void setOutputColor(vec4 outColor) {
  vec4 c = vec4(outColor.rgb * outColor.a, outColor.a);
  c = sourceEncodingToNitsInDestinationColorspace(c);
  c = nitsToDestinationEncoding(c);
  gl_FragColor = c;
}

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

  float intensity = uForOpening ? (1.0 - p) * (1.0 - p) : p * p;

  vec2 offset = dir * (sin(p * dist * uAmplitude - p * uSpeed + seed) + 0.5) / 30.0;
  vec2 wuv    = uv + offset * intensity;

  vec4 oColor = getInputColor(wuv);

  float alpha = uForOpening ? smoothstep(0.0, 0.3, p) : smoothstep(1.0, 0.5, p);
  oColor.a *= alpha;

  setOutputColor(oColor);
}
