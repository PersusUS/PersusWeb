/*
 * Wayfinding behaviour: portfolio filters, and the scroll cue.
 *
 * Both are progressive enhancements. The filter bar is built here rather than
 * written into the markup, so with JS off the page is simply the full,
 * unfiltered list it has always been instead of a row of dead buttons.
 */
(function () {
    'use strict';

    function scrollTo(target) {
        if (!target) {
            return;
        }
        // Two things do not work on these pages and both were measured, not
        // assumed. Lenis is constructed but inert: scrollTo by element, offset
        // and selector all leave the page where it was. And any smooth scroll
        // is cancelled mid-flight — window.scrollTo({behavior:'smooth'}) and
        // scrollIntoView({behavior:'smooth'}) both end at 0 — because the
        // scroll machinery on the page resets the position every frame.
        // An instant jump is what survives, and for "skip the intro" it is
        // also the honest behaviour.
        target.scrollIntoView({ behavior: 'auto', block: 'start' });
    }

    /* --------------------------------------------------------------
     * Portfolio filters
     * -------------------------------------------------------------- */

    function initFilters(scope) {
        var grid = (scope || document).querySelector('.all_projects--container');
        if (!grid) {
            return;
        }

        // Page transitions call init() again on the new container. If a filter
        // bar is already sitting above this grid, it belongs to this grid and
        // there is nothing to build.
        if (grid.parentNode.querySelector('.project_filters')) {
            return;
        }

        var cards = Array.prototype.slice.call(grid.querySelectorAll('.single_project'));
        var categorised = cards.filter(function (card) {
            return card.dataset.category;
        });
        if (categorised.length < 2) {
            return;
        }

        // Order of first appearance, so the bar follows the order of the page
        // rather than an alphabetical one nobody asked for.
        var categories = [];
        categorised.forEach(function (card) {
            if (categories.indexOf(card.dataset.category) === -1) {
                categories.push(card.dataset.category);
            }
        });

        var bar = document.createElement('div');
        bar.className = 'project_filters';
        bar.setAttribute('role', 'group');
        bar.setAttribute('aria-label', 'Filter projects by kind');

        var status = document.createElement('p');
        status.className = 'filter_status';
        status.setAttribute('role', 'status');
        status.setAttribute('aria-live', 'polite');

        function countIn(category) {
            return category === 'all' ? cards.length : categorised.filter(function (card) {
                return card.dataset.category === category;
            }).length;
        }

        function apply(category) {
            var shown = 0;
            cards.forEach(function (card) {
                var match = category === 'all' || card.dataset.category === category;
                card.hidden = !match;
                if (match) {
                    shown++;
                }
            });

            Array.prototype.forEach.call(bar.children, function (chip) {
                chip.setAttribute('aria-pressed', chip.dataset.filter === category ? 'true' : 'false');
            });

            status.textContent = category === 'all'
                ? shown + ' projects'
                : shown + (shown === 1 ? ' project in ' : ' projects in ') + category;

            // The cards fade in on ScrollTriggers tied to their old positions.
            if (window.ScrollTrigger) {
                window.ScrollTrigger.refresh();
            }
        }

        function addChip(value, label) {
            var chip = document.createElement('button');
            chip.type = 'button';
            chip.className = 'filter_chip';
            chip.dataset.filter = value;
            chip.setAttribute('aria-pressed', value === 'all' ? 'true' : 'false');
            chip.innerHTML = label + '<span class="count">' + countIn(value) + '</span>';
            chip.addEventListener('click', function () {
                apply(value);
            });
            bar.appendChild(chip);
        }

        addChip('all', 'All');
        categories.forEach(function (category) {
            addChip(category, category);
        });

        grid.parentNode.insertBefore(bar, grid);
        grid.parentNode.insertBefore(status, grid);
        apply('all');
    }

    /* --------------------------------------------------------------
     * Scroll cue
     *
     * The dial says "scroll to discover" and is the only thing on a screen
     * that otherwise does nothing until you scroll. master.min.js drops the
     * SVG into an empty container, so wrap whatever landed there.
     * -------------------------------------------------------------- */

    function initScrollCue(scope) {
        var root = scope || document;
        var dial = root.querySelector('.circular_text--container');
        var target = root.querySelector('.default_row--container.intro');
        if (!dial || !target || dial.querySelector('.scroll_cue')) {
            return false;
        }

        // The dial is a background-image on an empty container, so there is
        // nothing to wrap; cover it with a transparent button instead.
        var button = document.createElement('button');
        button.type = 'button';
        button.className = 'scroll_cue';
        button.setAttribute('aria-label', 'Skip the intro animation and read on');
        dial.appendChild(button);

        button.addEventListener('click', function () {
            scrollTo(target);
        });

        return true;
    }

    function init(scope) {
        // Called from an event listener as well as from the transition hook,
        // so anything that is not an element is nobody's container.
        scope = (scope && scope.querySelector) ? scope : document;
        initFilters(scope);

        // The dial's SVG arrives on master.min.js's schedule, so poll briefly
        // rather than guess a delay. Gives up after about eight seconds.
        var tries = 0;
        var timer = window.setInterval(function () {
            tries++;
            if (initScrollCue(scope) || tries > 40) {
                window.clearInterval(timer);
            }
        }, 200);
    }

    /* --------------------------------------------------------------
     * In-page links
     *
     * "Contact" in both menus pointed at #footer and called lenis.scrollTo().
     * There is no global lenis object on these pages, so every click threw and
     * the page sat exactly where it was — the one link a first-time visitor is
     * most likely to try did nothing at all. The plain #footer jump does not
     * survive the scroll machinery either, so do it here, instantly, and put
     * focus in the footer so a keyboard lands where the eye does.
     * -------------------------------------------------------------- */

    document.addEventListener('click', function (e) {
        var link = e.target.closest ? e.target.closest('a[href^="#"]') : null;
        if (!link) {
            return;
        }
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) {
            return;
        }

        var id = link.getAttribute('href').slice(1);
        if (!id) {
            return;
        }
        var target = document.getElementById(id);
        if (!target) {
            return;
        }

        e.preventDefault();

        // The mobile menu covers the page it is scrolling; master.min.js
        // closes it on its own click handler, which may not have run yet.
        document.body.classList.remove('nav-active');
        var button = document.querySelector('.hamburger_btn');
        if (button) {
            button.setAttribute('aria-expanded', 'false');
        }

        scrollTo(target);

        if (!target.hasAttribute('tabindex')) {
            target.setAttribute('tabindex', '-1');
        }
        target.focus({ preventScroll: true });
    });

    /* --------------------------------------------------------------
     * Page transitions
     *
     * Barba swaps the container without reloading any script, so everything
     * built here has to be built again for the page that just arrived, and
     * the reader has to be told they are somewhere new: a screen reader and
     * a keyboard both stay exactly where they were otherwise, which on a
     * link-driven site reads as "nothing happened".
     * -------------------------------------------------------------- */

    function focusNewPage(container, trigger) {
        var scope = (container && container.querySelector) ? container : document;
        var heading = scope.querySelector('h1')
            || scope.querySelector('h2')
            || document.getElementById('wrapper');
        if (!heading) {
            return;
        }
        if (!heading.hasAttribute('tabindex')) {
            heading.setAttribute('tabindex', '-1');
        }

        // The heading is still visibility:hidden while its letters wait to be
        // revealed, and focus() on a hidden element is a no-op, so try again
        // until it takes. Four seconds covers the slowest reveal measured
        // (project page into About) and then gives up rather than fighting
        // someone who has already clicked something else.
        var tries = 0;
        var timer = window.setInterval(function () {
            tries++;
            // Only ever take focus away from nothing. Once the old link is
            // gone the page focuses <body>; if anything else holds focus it
            // is because the reader moved on, and it is not ours to take.
            // The header is not replaced between pages, so a link clicked
            // there still holds focus and is exactly what should move.
            var idle = document.activeElement === document.body
                || document.activeElement === null
                || document.activeElement === heading
                || (trigger && trigger.nodeType === 1 && document.activeElement === trigger);
            if (idle) {
                heading.focus({ preventScroll: true });
            }
            if (!idle || document.activeElement === heading || tries > 40) {
                window.clearInterval(timer);
            }
        }, 100);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () {
            init();
        });
    } else {
        init();
    }

    // afterEnter, and everything scoped to data.next.container: this runs in
    // sync mode, so the page that is leaving is still in the document and an
    // unscoped lookup finds its markup first. (`after` never fires here.)
    if (window.barba && window.barba.hooks) {
        window.barba.hooks.afterEnter(function (data) {
            var container = data && data.next && data.next.container;
            init(container);
            focusNewPage(container, data && data.trigger);
        });
    }
})();
