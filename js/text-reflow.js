/*
 * Re-splits the line-based text animations when the layout changes.
 *
 * GSAP SplitText bakes the line breaks of [data-animation='words'] into
 * <div class="line"> elements at whatever width the page had when it ran.
 * Those divs never re-wrap, so narrowing the window afterwards — a resize, a
 * zoom change, a phone rotating — leaves a line overflowing into a stray
 * one-word row. This restores the original markup and splits it again.
 */
(function () {
    var SELECTOR = "[data-animation='words']";
    var lastWidth = window.innerWidth;
    var timer = null;

    function snapshot() {
        Array.prototype.forEach.call(document.querySelectorAll(SELECTOR), function (el) {
            if (!el.reflowSource && !el.querySelector('.line')) {
                el.reflowSource = el.innerHTML;
            }
        });
    }

    function sourceOf(el) {
        if (el.reflowSource) {
            return el.reflowSource;
        }
        // Page arrived through a Barba transition and was split before we saw
        // it: rebuild the text from the lines themselves.
        var lines = el.querySelectorAll(':scope > .line');
        if (!lines.length) {
            return null;
        }
        var text = Array.prototype.map.call(lines, function (line) {
            return line.textContent.trim();
        }).join(' ');
        el.reflowSource = text;
        return text;
    }

    function reflow() {
        if (typeof SplitText === 'undefined' || typeof gsap === 'undefined') {
            return;
        }

        var targets = [];
        Array.prototype.forEach.call(document.querySelectorAll(SELECTOR), function (el) {
            var source = sourceOf(el);
            if (source === null) {
                return;
            }
            el.innerHTML = source;
            targets.push(el);
        });

        if (!targets.length) {
            return;
        }

        if (window.ScrollTrigger) {
            ScrollTrigger.getAll().forEach(function (trigger) {
                if (targets.indexOf(trigger.trigger) !== -1) {
                    trigger.kill();
                }
            });
        }

        new SplitText(targets, { type: 'words,lines', linesClass: 'line' });

        targets.forEach(function (el) {
            var inner = el.querySelectorAll('.line div');
            el.style.visibility = 'visible';

            // Anything already scrolled past keeps its finished state; the rest
            // still animates in on the same trigger master.min.js uses.
            if (el.getBoundingClientRect().top < window.innerHeight * 0.8) {
                gsap.set(inner, { y: 0 });
                return;
            }
            gsap.to(inner, {
                duration: 0.8,
                y: 0,
                ease: 'power4.out',
                stagger: el.dataset.stagger,
                delay: el.dataset.delay,
                scrollTrigger: {
                    trigger: el,
                    start: 'top 80%',
                    toggleActions: 'play none none none'
                }
            });
        });

        if (window.ScrollTrigger) {
            ScrollTrigger.refresh();
        }
    }

    snapshot();

    // Web fonts landing after the first split change the metrics too.
    if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(reflow);
    }

    window.addEventListener('resize', function () {
        // Mobile browsers fire resize when the URL bar hides; only the width
        // can change how the text wraps.
        if (window.innerWidth === lastWidth) {
            return;
        }
        lastWidth = window.innerWidth;
        clearTimeout(timer);
        timer = setTimeout(reflow, 200);
    });

    if (window.barba && window.barba.hooks) {
        window.barba.hooks.afterEnter(function () {
            snapshot();
        });
    }
})();
