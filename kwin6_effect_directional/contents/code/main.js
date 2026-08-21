// SPDX-License-Identifier: MIT
//
// KWin 6 scripted window open/close effect: "Directional".
// Auto-generated port of the Niri custom-shader "directional".

"use strict";

const blacklist = [
    "ksmserver ksmserver",
    "ksmserver-logout-greeter ksmserver-logout-greeter",
    "ksplashqml ksplashqml",
];

class NiriDirectionalEffect {
    constructor() {
        effect.configChanged.connect(this.loadConfig.bind(this));
        effect.animationEnded.connect(this.cleanupForcedRoles.bind(this));
        effects.windowAdded.connect(this.slotWindowAdded.bind(this));
        effects.windowClosed.connect(this.slotWindowClosed.bind(this));
        effects.windowDataChanged.connect(this.slotWindowDataChanged.bind(this));

        this.shader = effect.addFragmentShader(Effect.MapTexture, "directional.frag");

        this.loadConfig();
    }

    loadConfig() {
        this.duration = animationTime(effect.readConfig("Duration", 500));
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

    slotWindowAdded(window) {
        if (effects.hasActiveFullScreenEffect) return;
        if (!NiriDirectionalEffect.shouldAnimateWindow(window)) return;
        if (!window.visible) return;
        if (effect.isGrabbed(window, Effect.WindowAddedGrabRole)) return;
        window.niriInAnimation = this.startAnimation(window, true);
    }

    slotWindowClosed(window) {
        if (effects.hasActiveFullScreenEffect) return;
        if (!NiriDirectionalEffect.shouldAnimateWindow(window)) return;
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

new NiriDirectionalEffect();
