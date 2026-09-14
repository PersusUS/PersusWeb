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

    /* ---------------------------------------------------------------
     * The browser chrome kept the loader's colour
     *
     * Every page opens with .loader_wrapper: four fixed #7e9fdb stripes
     * covering the viewport for three seconds behind a rotating "J".
     * iOS Safari decides what to tint its own toolbars with while the
     * page is loading, which is exactly when the screen is that blue,
     * and it does not go back and reconsider once the stripes slide
     * away. So the phone kept a pale blue bar top and bottom over a
     * black page for the rest of the visit.
     *
     * theme-color is declared as the loader's blue, so the chrome
     * matches the screen while the animation runs, and is swapped for
     * the page background the moment the stripes leave. Which is what
     * it should have looked like all along: blue, then the background,
     * and nothing else.
     * --------------------------------------------------------------- */

    var PAGE_COLOUR = '#111111';

    function settleThemeColour() {
        var meta = document.querySelector('meta[name="theme-color"]');
        if (!meta || meta.getAttribute('content') === PAGE_COLOUR) {
            return;
        }
        meta.setAttribute('content', PAGE_COLOUR);
        // Safari only re-reads the tag when it changes, and it does not
        // always notice an attribute edit in place.
        var parent = meta.parentNode;
        parent.removeChild(meta);
        parent.appendChild(meta);
    }

    /*
     * The loader never actually left.
     *
     * master.css means to slide the four stripes off the top once the
     * wrapper gets .loaded:
     *
     *   .loader_wrapper.loaded .stripe { transform: translateY(-100%) }
     *
     * The rule is in the stylesheet, the wrapper has the class, and the
     * stripe matches the selector — and the computed transform is still
     * the identity matrix. Whatever is eating it, the result is four
     * fixed, full-height, #7e9fdb panels parked at z-index 1 for the
     * whole visit. Page sections sit at z-index 2 and cover them, so it
     * reads as correct until something does not paint: the overscroll
     * at either end, a gap between sections, and the strip of page iOS
     * Safari samples to colour its toolbars.
     *
     * Taking the wrapper out of the document once the animation has had
     * its time is not subtle, but it does not depend on working out why
     * the cascade is behaving like that.
     */
    function retireLoader(loader) {
        loader.style.display = 'none';
    }

    function finish(loader) {
        settleThemeColour();
        if (loader) {
            retireLoader(loader);
        }
    }

    function watchLoader() {
        var loader = document.querySelector('.loader_wrapper');
        if (!loader) {
            settleThemeColour();
            return;
        }
        if (loader.classList.contains('loaded')) {
            finish(loader);
            return;
        }
        // master.min.js adds .loaded on a 3s timer, then the stripes take
        // 0.35s to travel with up to 0.6s of stagger behind them.
        var observer = new MutationObserver(function () {
            if (loader.classList.contains('loaded')) {
                observer.disconnect();
                window.setTimeout(function () {
                    finish(loader);
                }, 950);
            }
        });
        observer.observe(loader, { attributes: true, attributeFilter: ['class'] });
        // Belt and braces, in case the loader never gets there.
        window.setTimeout(function () {
            finish(loader);
        }, 5000);
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

    // The loader runs once per full page load, at every width, so this is
    // deliberately outside apply() and outside the breakpoint check.
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', watchLoader);
    } else {
        watchLoader();
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
