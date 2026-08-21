// SPDX-License-Identifier: MIT
//
// KWin 6 scripted window open/close effect: "Ripple".
// Ported from the Niri custom-shader "ripple".
//
// The window-filtering / forced-role scaffolding follows the structure used by
// Burn-My-Windows (GPL-3.0 upstream); this file is an independent MIT reimplementation
// of that pattern for the ripple port.

"use strict";

const blacklist = [
    // The logout screen and splash are animated by their own dedicated effects.
    "ksmserver ksmserver",
    "ksmserver-logout-greeter ksmserver-logout-greeter",
    "ksplashqml ksplashqml",
];

class RippleEffect {
    constructor() {
        effect.configChanged.connect(this.loadConfig.bind(this));
        effect.animationEnded.connect(this.cleanupForcedRoles.bind(this));
        effects.windowAdded.connect(this.slotWindowAdded.bind(this));
        effects.windowClosed.connect(this.slotWindowClosed.bind(this));
        effects.windowDataChanged.connect(this.slotWindowDataChanged.bind(this));

        // KWin resolves "ripple.frag" to "ripple_core.frag" automatically on
        // core-profile contexts.
        this.shader = effect.addFragmentShader(Effect.MapTexture, "ripple.frag");

        this.loadConfig();
    }

    // Called on load and whenever the user changes the effect's settings.
    loadConfig() {
        this.duration = animationTime(effect.readConfig("Duration", 500));

        effect.setUniform(this.shader, "uAmplitude", effect.readConfig("Amplitude", 100.0));
        effect.setUniform(this.shader, "uSpeed", effect.readConfig("Speed", 50.0));
    }

    static shouldAnimateWindow(window) {
        // plasmashell shares one window class across many surfaces; only animate the
        // decorated ones (dialogs, settings windows, ...).
        if (window.windowClass == "plasmashell plasmashell"
                || window.windowClass == "plasmashell org.kde.plasmashell") {
            return window.hasDecoration;
        }

        // Avoid animating the Alt+Tab popup and similar all-desktop chromeless windows.
        if (!window.hasDecoration && window.onAllDesktops) {
            return false;
        }

        if (blacklist.indexOf(window.windowClass) != -1) {
            return false;
        }

        if (window.hasDecoration) {
            return true;
        }

        // Don't animate combobox popups, tooltips, popup menus, etc.
        if (window.popupWindow) {
            return false;
        }

        // Don't animate the screen outline or the screen locker.
        if (window.lockScreen || window.outline) {
            return false;
        }

        // Override-redirect windows are usually not meant to be animated.
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
        effect.setUniform(this.shader, "uSeed", Math.random());

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
        if (effects.hasActiveFullScreenEffect) {
            return;
        }
        if (!RippleEffect.shouldAnimateWindow(window)) {
            return;
        }
        if (!window.visible) {
            return;
        }
        if (effect.isGrabbed(window, Effect.WindowAddedGrabRole)) {
            return;
        }

        window.rippleInAnimation = this.startAnimation(window, true);
    }

    slotWindowClosed(window) {
        if (effects.hasActiveFullScreenEffect) {
            return;
        }
        if (!RippleEffect.shouldAnimateWindow(window)) {
            return;
        }
        if (!window.visible || window.skipsCloseAnimation) {
            return;
        }
        if (effect.isGrabbed(window, Effect.WindowClosedGrabRole)) {
            return;
        }
        if (window.rippleInAnimation) {
            cancel(window.rippleInAnimation);
            delete window.rippleInAnimation;
        }

        window.rippleOutAnimation = this.startAnimation(window, false);
    }

    slotWindowDataChanged(window, role) {
        if (role == Effect.WindowAddedGrabRole) {
            if (window.rippleInAnimation && effect.isGrabbed(window, role)) {
                cancel(window.rippleInAnimation);
                delete window.rippleInAnimation;
                this.cleanupForcedRoles(window);
            }
        } else if (role == Effect.WindowClosedGrabRole) {
            if (window.rippleOutAnimation && effect.isGrabbed(window, role)) {
                cancel(window.rippleOutAnimation);
                delete window.rippleOutAnimation;
                this.cleanupForcedRoles(window);
            }
        }
    }
}

new RippleEffect();
