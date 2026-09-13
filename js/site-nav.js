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

    function initFilters() {
        var grid = document.querySelector('.all_projects--container');
        if (!grid) {
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

    function initScrollCue() {
        var dial = document.querySelector('.circular_text--container');
        var target = document.querySelector('.default_row--container.intro');
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

    function init() {
        initFilters();

        // The dial's SVG arrives on master.min.js's schedule, so poll briefly
        // rather than guess a delay. Gives up after about eight seconds.
        var tries = 0;
        var timer = window.setInterval(function () {
            tries++;
            if (initScrollCue() || tries > 40) {
                window.clearInterval(timer);
            }
        }, 200);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
