// SPDX-License-Identifier: MIT
//
// KWin 6 scripted MINIMIZE/unminimize effect: "Circle Minimize".
// Auto-generated port of the Niri custom-shader "circle" (minimize role).

"use strict";

const blacklist = [
    "ksmserver ksmserver",
    "ksmserver-logout-greeter ksmserver-logout-greeter",
    "ksplashqml ksplashqml",
];

class NiriCircleEffectMinimize {
    constructor() {
        effect.configChanged.connect(this.loadConfig.bind(this));
        this.shader = effect.addFragmentShader(Effect.MapTexture, "circle.frag");
        this.loadConfig();

        effects.windowAdded.connect(this.watch.bind(this));

        // Attach to windows that already exist when the effect loads.
        const existing = effects.stackingOrder;
        for (let i = 0; i < existing.length; i++) {
            this.watch(existing[i]);
        }
    }

    loadConfig() {
        this.duration = animationTime(effect.readConfig("Duration", 500));
    }

    static shouldAnimateWindow(window) {
        if (blacklist.indexOf(window.windowClass) != -1) {
            return false;
        }
        if (window.popupWindow || window.lockScreen || window.outline) {
            return false;
        }
        if (!window.managed) {
            return false;
        }
        return window.normalWindow || window.dialog;
    }

    watch(window) {
        if (window.niriMinWatched) {
            return;
        }
        window.niriMinWatched = true;
        // Per-window signal: KWin 6 has no effects.windowMinimized.
        window.minimizedChanged.connect(this.onMinimizedChanged.bind(this, window));
    }

    setupForcedRoles(window) {
        window.setData(Effect.WindowForceBackgroundContrastRole, true);
        window.setData(Effect.WindowForceBlurRole, true);
    }

    onMinimizedChanged(window) {
        if (effects.hasActiveFullScreenEffect) {
            return;
        }
        if (!NiriCircleEffectMinimize.shouldAnimateWindow(window)) {
            return;
        }

        if (window.niriMinAnim) {
            cancel(window.niriMinAnim);
            delete window.niriMinAnim;
        }

        // minimized  -> window leaving   -> "close" body (uForOpening = 0)
        // unminimized-> window returning -> "open"  body (uForOpening = 1)
        const returning = !window.minimized;
        this.setupForcedRoles(window);
        effect.setUniform(this.shader, "uForOpening", returning ? 1.0 : 0.0);
        effect.setUniform(this.shader, "uSeed", Math.random());
        window.niriMinAnim = animate({
            window: window,
            curve: QEasingCurve.Linear,
            duration: this.duration,
            animations: [
                {
                    type: Effect.ShaderUniform,
                    fragmentShader: this.shader,
                    uniform: "uProgress",
                    from: 0.0,
                    to: 1.0,
                },
            ],
        });
    }
}

new NiriCircleEffectMinimize();
