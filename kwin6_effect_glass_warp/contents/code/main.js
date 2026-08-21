// SPDX-License-Identifier: MIT
//
// KWin 6 scripted window open/close effect: "Glass Warp".
// Hand-written port of the Niri custom-shader "glass-warp".
//
// Niri drives this with springs (open: damping 2.0 / stiffness 5000; close:
// damping 1.0 / stiffness 150). Both are non-oscillating, so we reproduce them
// as per-direction QEasingCurve + duration -- KWin's animate() has no spring.

"use strict";

const blacklist = [
    "ksmserver ksmserver",
    "ksmserver-logout-greeter ksmserver-logout-greeter",
    "ksplashqml ksplashqml",
];

class NiriGlassWarpEffect {
    constructor() {
        effect.configChanged.connect(this.loadConfig.bind(this));
        effect.animationEnded.connect(this.cleanupForcedRoles.bind(this));
        effects.windowAdded.connect(this.slotWindowAdded.bind(this));
        effects.windowClosed.connect(this.slotWindowClosed.bind(this));
        effects.windowDataChanged.connect(this.slotWindowDataChanged.bind(this));

        this.shader = effect.addFragmentShader(Effect.MapTexture, "glass-warp.frag");

        this.loadConfig();
    }

    loadConfig() {
        // Defaults are the spring settling times: overdamped/stiff open settles
        // fast (~600 ms); the softer critically-damped close lingers (~1150 ms).
        this.openDuration = animationTime(effect.readConfig("OpenDuration", 600));
        this.closeDuration = animationTime(effect.readConfig("CloseDuration", 1150));
    }

    static shouldAnimateWindow(window) {
        if (window.windowClass == "plasmashell plasmashell"
                || window.windowClass == "plasmashell org.kde.plasmashell") {
            return window.hasDecoration;
        }
        if (!window.hasDecoration && window.onAllDesktops) {
            return false;
        }
        if (blacklist.indexOf(window.windowClass) != -1) {
            return false;
        }
        if (window.hasDecoration) {
            return true;
        }
        if (window.popupWindow) {
            return false;
        }
        if (window.lockScreen || window.outline) {
            return false;
        }
        if (!window.managed) {
            return false;
        }
        return window.normalWindow || window.dialog;
    }

    setupForcedRoles(window) {
        window.setData(Effect.WindowForceBackgroundContrastRole, true);
        window.setData(Effect.WindowForceBlurRole, true);
    }

    cleanupForcedRoles(window) {
        window.setData(Effect.WindowForceBackgroundContrastRole, null);
        window.setData(Effect.WindowForceBlurRole, null);
    }

    startAnimation(window, forOpening) {
        this.setupForcedRoles(window);

        effect.setUniform(this.shader, "uForOpening", forOpening ? 1.0 : 0.0);

        return animate({
            window: window,
            // Overdamped open -> snappy OutQuint; critically-damped close -> gentle OutCubic.
            curve: forOpening ? QEasingCurve.OutQuint : QEasingCurve.OutCubic,
            duration: forOpening ? this.openDuration : this.closeDuration,
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

    slotWindowAdded(window) {
        if (effects.hasActiveFullScreenEffect) return;
        if (!NiriGlassWarpEffect.shouldAnimateWindow(window)) return;
        if (!window.visible) return;
        if (effect.isGrabbed(window, Effect.WindowAddedGrabRole)) return;
        window.niriInAnimation = this.startAnimation(window, true);
    }

    slotWindowClosed(window) {
        if (effects.hasActiveFullScreenEffect) return;
        if (!NiriGlassWarpEffect.shouldAnimateWindow(window)) return;
        if (!window.visible || window.skipsCloseAnimation) return;
        if (effect.isGrabbed(window, Effect.WindowClosedGrabRole)) return;
        if (window.niriInAnimation) {
            cancel(window.niriInAnimation);
            delete window.niriInAnimation;
        }
        window.niriOutAnimation = this.startAnimation(window, false);
    }

    slotWindowDataChanged(window, role) {
        if (role == Effect.WindowAddedGrabRole) {
            if (window.niriInAnimation && effect.isGrabbed(window, role)) {
                cancel(window.niriInAnimation);
                delete window.niriInAnimation;
                this.cleanupForcedRoles(window);
            }
        } else if (role == Effect.WindowClosedGrabRole) {
            if (window.niriOutAnimation && effect.isGrabbed(window, role)) {
                cancel(window.niriOutAnimation);
                delete window.niriOutAnimation;
                this.cleanupForcedRoles(window);
            }
        }
    }
}

new NiriGlassWarpEffect();
