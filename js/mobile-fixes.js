/*
 * Phone behaviour layer.
 *
 * master.min.js is a build artefact: it is minified, it has no breakpoint
 * awareness, and every scroll effect in it was measured against a wide
 * desktop canvas. Rather than patch the bundle, this file runs after it and
 * re-states the handful of effects that only make sense above 768px.
 *
 * Load order matters. This must come after master.min.js so that
 * jQuery(document).ready callbacks fire in that order, and after
 * barba.init() so the afterEnter hook registered here runs after the one
 * that calls masterInit() on every page transition.
 */
(function () {
    'use strict';

    var PHONE = '(max-width: 767px)';

    function isPhone() {
        return window.matchMedia(PHONE).matches;
    }

    function ready() {
        return !!(window.gsap && window.ScrollTrigger);
    }

    /* ---------------------------------------------------------------
     * Home hero
     *
     * masterInit builds this:
     *
     *   gsap.to('.hero_heading--container', {
     *       scale: 70, x: '87%', transformOrigin: 'center center',
     *       scrollTrigger: { trigger: '.home_hero--wrapper', start: 'top top',
     *                        end: '+=80%', scrub: .3, pin: true, id: 'letters' }
     *   })
     *
     * You scroll, the wordmark is pinned and zoomed 70x, and the camera
     * flies through the aperture of a letter. At 1440px the aperture is
     * where `x: 87%` puts it. At 375px the same 87% of a much narrower box
     * lands outside the glyph entirely, so the whole pin — about 650px of
     * scrolling — is flat black with nothing in it.
     *
     * On phones the pin is replaced with a plain scrubbed fade over the
     * hero's own height: the wordmark still leaves deliberately, but it
     * never holds the viewport hostage.
     * --------------------------------------------------------------- */

    var DESKTOP_ID = 'letters';
    var PHONE_ID = 'letters-phone';

    function dropTrigger(id) {
        var st = ScrollTrigger.getById(id);
        if (!st) {
            return false;
        }
        var tween = st.animation;
        st.kill(true);
        if (tween) {
            tween.kill();
        }
        return true;
    }

    function applyHeroZoom() {
        if (!ready()) {
            return;
        }
        var el = document.querySelector('.hero_heading--container');
        if (!el) {
            return;
        }

        var changed = false;

        if (isPhone()) {
            changed = dropTrigger(DESKTOP_ID);
            if (ScrollTrigger.getById(PHONE_ID)) {
                return;
            }
            gsap.set(el, { clearProps: 'all' });
            gsap.to(el, {
                scale: 1.35,
                opacity: 0,
                ease: 'none',
                transformOrigin: 'center center',
                scrollTrigger: {
                    trigger: '.home_hero--wrapper',
                    start: 'top top',
                    end: 'bottom top',
                    scrub: 0.3,
                    id: PHONE_ID
                }
            });
            changed = true;
        } else {
            // Back above the breakpoint. masterInit only builds the zoom on
            // its own next run, so rebuild it here with the bundle's values.
            if (dropTrigger(PHONE_ID)) {
                gsap.set(el, { clearProps: 'all' });
                changed = true;
            }
            if (!ScrollTrigger.getById(DESKTOP_ID)) {
                gsap.to(el, {
                    scale: 70,
                    force3D: false,
                    x: '87%',
                    transformOrigin: 'center center',
                    scrollTrigger: {
                        trigger: '.home_hero--wrapper',
                        start: 'top top',
                        end: '+=80%',
                        scrub: 0.3,
                        pin: true,
                        id: DESKTOP_ID
                    }
                });
                changed = true;
            }
        }

        if (changed) {
            ScrollTrigger.refresh(true);
        }
    }

    /* ---------------------------------------------------------------
     * The contact footer's 250px entrance
     *
     * masterInit builds this:
     *
     *   gsap.timeline({ scrollTrigger: { trigger: '.cta_footer--container',
     *       start: 'top 80%', end: 'bottom bottom', scrub: true,
     *       id: 'cta reveal' } }).fromTo(e, {y: -250}, {y: 0})
     *
     * The whole pale-blue block slides up 250px and settles as you reach
     * it. Against a 900px desktop footer that is a slow drift you barely
     * register. On a phone the block is 555px tall, so a 250px slide is
     * nearly half of it: the blue lifts over the section above, uncovers
     * a band beneath itself, and lands with a visible jolt — which is
     * most of what "the footer moves and there is blue where there
     * shouldn't be" is describing.
     *
     * GSAP writes the transform inline, so a stylesheet cannot override
     * it. The trigger has to go, and the transform with it.
     * --------------------------------------------------------------- */

    var CTA_ID = 'cta reveal';

    function applyCtaSlide() {
        if (!ready()) {
            return;
        }
        var el = document.querySelector('.cta_footer--container');
        if (!el || !isPhone()) {
            return;
        }
        if (dropTrigger(CTA_ID)) {
            gsap.set(el, { clearProps: 'transform' });
            ScrollTrigger.refresh(true);
        }
    }

    function apply() {
        applyHeroZoom();
        applyCtaSlide();
    }

    if (window.jQuery) {
        // masterInit is itself a jQuery ready callback registered by the
        // script before this one, so this runs after the triggers exist.
        window.jQuery(document).ready(apply);
    } else if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', apply);
    } else {
        apply();
    }

    // master re-runs masterInit on afterEnter, which rebuilds the desktop
    // zoom on every page transition. Re-state the phone version after it.
    if (window.barba && window.barba.hooks) {
        window.barba.hooks.afterEnter(function () {
            apply();
        });
    }

    // Crossing the breakpoint — rotation, or a desktop window being resized —
    // has to swap which version is installed. The media query itself is the
    // reliable signal here: a plain resize listener does not fire when the
    // viewport changes under device emulation, and it fires far too often
    // when it is a window edge being dragged.
    var query = window.matchMedia(PHONE);
    var wasPhone = query.matches;

    function onBreakpoint() {
        var now = isPhone();
        if (now === wasPhone) {
            return;
        }
        wasPhone = now;
        apply();
    }

    if (query.addEventListener) {
        query.addEventListener('change', onBreakpoint);
    } else if (query.addListener) {
        // Safari before 14.
        query.addListener(onBreakpoint);
    }

    // Belt and braces, for anything that moves the viewport without the
    // query itself flipping.
    var resizeTimer = null;
    window.addEventListener('resize', function () {
        window.clearTimeout(resizeTimer);
        resizeTimer = window.setTimeout(onBreakpoint, 200);
    });
})();
