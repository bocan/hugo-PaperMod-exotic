// Theme picker: palette + brightness (light / dark / auto).
//
// State lives on <html>:
//   data-palette  palette id (see data/palettes.yaml)
//   data-theme    resolved brightness, always "light" or "dark"
// Choices persist in localStorage:
//   pref-palette  palette id
//   pref-theme    "light" | "dark" | "auto"  (same key upstream PaperMod uses)
// head.html restores both before first paint; this file keeps them in sync.
// Fires `themechange` on document with { palette, mode, theme } in detail.

import * as params from '@params';

(function () {
    'use strict';

    const root = document.documentElement;
    const picker = document.getElementById('theme-picker');
    if (!picker) return;

    const button = document.getElementById('theme-picker-btn');
    const menu = document.getElementById('theme-menu');
    const paletteButtons = Array.from(menu.querySelectorAll('[data-palette-option]'));
    const modeButtons = Array.from(menu.querySelectorAll('[data-mode-option]'));
    const focusables = modeButtons.concat(paletteButtons);
    const paletteIds = paletteButtons.map((b) => b.dataset.paletteOption);
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const VIEWPORT_GUTTER = 16;

    function read(key) {
        try {
            return localStorage.getItem(key);
        } catch (e) {
            return null;
        }
    }

    function write(key, value) {
        try {
            localStorage.setItem(key, value);
        } catch (e) {
            // Private mode or blocked storage: the choice lasts for this page only.
        }
    }

    function currentMode() {
        const stored = read('pref-theme');
        if (stored === 'light' || stored === 'dark' || stored === 'auto') return stored;
        return params.defaultMode || 'auto';
    }

    function currentPalette() {
        const p = root.dataset.palette;
        return paletteIds.indexOf(p) !== -1 ? p : paletteIds[0];
    }

    function resolve(mode) {
        if (mode === 'auto') return media.matches ? 'dark' : 'light';
        return mode;
    }

    function apply(palette, mode, announce) {
        root.dataset.palette = palette;
        root.dataset.theme = resolve(mode);

        paletteButtons.forEach((b) => {
            b.setAttribute('aria-pressed', String(b.dataset.paletteOption === palette));
        });
        modeButtons.forEach((b) => {
            b.setAttribute('aria-pressed', String(b.dataset.modeOption === mode));
        });

        // Browser UI colour (mobile address bar) follows the page background.
        const meta = document.querySelector('meta[name="theme-color"]');
        if (meta) {
            const bg = getComputedStyle(root).getPropertyValue('--theme').trim();
            if (bg) meta.setAttribute('content', bg);
        }

        if (announce) {
            document.dispatchEvent(new CustomEvent('themechange', {
                detail: { palette: palette, mode: mode, theme: root.dataset.theme },
            }));
        }
    }

    // Keep the menu inside the viewport. It is anchored to the button, which
    // can sit far right on narrow screens after a long logo.
    function place() {
        menu.style.left = '0px';
        const pickerLeft = picker.getBoundingClientRect().left;
        const width = menu.offsetWidth;
        const maxLeft = window.innerWidth - VIEWPORT_GUTTER - width;
        const target = Math.max(VIEWPORT_GUTTER, Math.min(pickerLeft, maxLeft));
        menu.style.left = (target - pickerLeft) + 'px';
    }

    function isOpen() {
        return !menu.hidden;
    }

    function open() {
        menu.hidden = false;
        button.setAttribute('aria-expanded', 'true');
        place();
        const selected = paletteButtons.find((b) => b.getAttribute('aria-pressed') === 'true');
        (selected || focusables[0]).focus();
    }

    function close(returnFocus) {
        if (!isOpen()) return;
        menu.hidden = true;
        button.setAttribute('aria-expanded', 'false');
        if (returnFocus) button.focus();
    }

    button.addEventListener('click', () => {
        if (isOpen()) close(true);
        else open();
    });

    paletteButtons.forEach((b) => {
        b.addEventListener('click', () => {
            const palette = b.dataset.paletteOption;
            write('pref-palette', palette);
            apply(palette, currentMode(), true);
        });
    });

    modeButtons.forEach((b) => {
        b.addEventListener('click', () => {
            const mode = b.dataset.modeOption;
            write('pref-theme', mode);
            apply(currentPalette(), mode, true);
        });
    });

    menu.addEventListener('keydown', (e) => {
        const i = focusables.indexOf(document.activeElement);
        if (e.key === 'Escape') {
            e.preventDefault();
            close(true);
        } else if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
            e.preventDefault();
            focusables[(i + 1) % focusables.length].focus();
        } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
            e.preventDefault();
            focusables[(i - 1 + focusables.length) % focusables.length].focus();
        } else if (e.key === 'Home') {
            e.preventDefault();
            focusables[0].focus();
        } else if (e.key === 'End') {
            e.preventDefault();
            focusables[focusables.length - 1].focus();
        }
    });

    // Close when focus or a click leaves the picker.
    document.addEventListener('click', (e) => {
        if (isOpen() && !picker.contains(e.target)) close(false);
    });
    picker.addEventListener('focusout', (e) => {
        if (isOpen() && e.relatedTarget && !picker.contains(e.relatedTarget)) close(false);
    });

    window.addEventListener('resize', () => {
        if (isOpen()) place();
    });

    // In auto mode, follow the OS setting live.
    media.addEventListener('change', () => {
        const mode = currentMode();
        if (mode === 'auto') apply(currentPalette(), mode, true);
    });

    apply(currentPalette(), currentMode(), false);
})();
