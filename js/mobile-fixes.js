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
     * The pin, and the address bar
     *
     * The hero is pinned for 80% of the viewport height, and the very
     * first flick of a finger is also what makes iOS Safari collapse
     * its address bar. That collapse is a resize, a resize refreshes
     * every ScrollTrigger, and a refresh in the middle of a pin
     * recalculates the pin's start against a viewport that is 60-odd
     * pixels taller than the one it was measured in — so the page jumps
     * under the thumb.
     *
     * ignoreMobileResize tells ScrollTrigger to sit out a resize that
     * only changes the height on a touch device, which is exactly the
     * toolbar case and nothing else. Rotation still refreshes.
     * --------------------------------------------------------------- */
    if (window.ScrollTrigger && ScrollTrigger.config) {
        ScrollTrigger.config({ ignoreMobileResize: true });
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
     * You scroll, the wordmark is pinned and the camera drives into the
     * black between two letters until it fills the screen and hands over
     * to the section below.
     *
     * An earlier pass here replaced that with a plain fade on phones, on
     * the theory that `x: 87%` aimed the camera somewhere else on a
     * narrow screen. It does not: 87% is a share of the element's own
     * width and the element is the full width of the viewport, so the
     * camera lands 0.87/70 = 1.24% of the screen left of centre at every
     * size. Measured against the wordmark's own geometry that is user
     * unit 868 at 1440px and 874 at 390px — both inside the same gap
     * between the S and the P, which is solid from 810 to 928.
     *
     * So the effect was never aimed wrong on a phone; it was only ever
     * missing. The bundle's own trigger is left alone at every width,
     * and the fade — which is what actually made the name smear across
     * the logo on the way out — is gone.
     * --------------------------------------------------------------- */

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

    // Kill a ScrollTrigger the bundle built, and the tween hanging off it.
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
     * Why theme-color is a constant
     *
     * It was worth one attempt: declare theme-color as the loader's
     * blue so iOS Safari tints its toolbars to match the loading
     * screen, then swap it for the page background once the stripes
     * leave. The swap runs — the deployed page reports #111111 in the
     * tag after load — and Safari's bars stay blue anyway. It reads
     * that tag once, when it parses the document, and never looks
     * again.
     *
     * The tag is therefore pinned to the page background, and the
     * loader has been repainted in that same colour (master.css), so
     * there is no longer a moment in the visit when the screen and the
     * toolbars are meant to disagree.
     * --------------------------------------------------------------- */

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
     * fixed, full-height panels parked over the page for the whole
     * visit. Page sections cover them, so it reads as correct until
     * something does not paint: the overscroll at either end, a gap
     * between sections, and the strip of page iOS Safari samples to
     * colour its toolbars.
     *
     * Taking the wrapper out of the document once the animation has had
     * its time is not subtle, but it does not depend on working out why
     * the cascade is behaving like that.
     */
    function retireLoader(loader) {
        loader.style.display = 'none';
        if (loader.parentNode) {
            loader.parentNode.removeChild(loader);
        }
    }

    function finish(loader) {
        if (loader) {
            retireLoader(loader);
        }
    }

    function watchLoader() {
        var loader = document.querySelector('.loader_wrapper');
        if (!loader) {
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
