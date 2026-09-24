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
        // The projects page is split into headed groups with one grid each.
        // The bar sits above the first group and filters across all of them.
        var grids = Array.prototype.slice.call((scope || document).querySelectorAll('.all_projects--container'));
        if (!grids.length) {
            return;
        }
        var groups = Array.prototype.slice.call((scope || document).querySelectorAll('.project_group'));
        var first = groups[0] || grids[0];

        // Page transitions call init() again on the new container. If a filter
        // bar is already sitting above these grids, it belongs to them and
        // there is nothing to build.
        if (first.parentNode.querySelector('.project_filters')) {
            return;
        }

        var cards = [];
        grids.forEach(function (grid) {
            cards = cards.concat(Array.prototype.slice.call(grid.querySelectorAll('.single_project')));
        });
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

            // A group the filter has emptied goes too, heading and all.
            groups.forEach(function (group) {
                group.hidden = !group.querySelector('.single_project:not([hidden])');
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

        first.parentNode.insertBefore(bar, first);
        first.parentNode.insertBefore(status, first);
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
        // The container itself, never a heading. The home page's <h1> carries
        // class="accessibility" — it is clipped out of sight for sighted
        // readers, and the stylesheet un-clips it on :focus, which painted the
        // whole line across the hero. The container is announced just as well
        // and has nothing to show.
        var heading = (container && container.querySelector)
            ? container
            : document.getElementById('wrapper');
        if (!heading) {
            return;
        }
        if (!heading.hasAttribute('tabindex')) {
            heading.setAttribute('tabindex', '-1');
        }

        // The container may still be mid-transition, and focus() on something
        // hidden is a no-op, so try again until it takes. Four seconds covers
        // the slowest transition measured and then gives up rather than
        // fighting someone who has already clicked something else.
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

/*
 * Wayfinding for the scroll itself.
 *
 * The site is one long choreographed scroll on a black background, with
 * large deliberate gaps between sections. A reader who does not spend
 * their life on the web reads a gap as the end of the page: the About
 * page is five sections deep and, before this, nothing on screen said
 * so. Three pieces, all built here so the markup stays clean and the
 * page still reads as prose with JavaScript switched off:
 *
 *   - a progress bar along the top, so "how much is left" has an answer;
 *   - a bar of named sections along the bottom, marking the one being
 *     read, which narrows on a phone to "section 3 of 6" and two arrows;
 *   - a "next: <section>" button in each gap, so the gap stops looking
 *     like an ending and starts looking like a door.
 *
 * The bar sits at the bottom rather than down one side because the
 * content on these pages runs to both edges: a rail on the right was
 * tried and landed on top of the résumé dates and the project cards.
 *
 * The hero's scroll arrow lives in index.html rather than here, because
 * it is the one cue that has to survive with no JavaScript at all; this
 * file only hides it once the reader has taken the hint.
 *
 * Positions are read from getBoundingClientRect on a rAF loop rather
 * than cached: the pinned portfolio section and the reveal animations
 * move things after load, and a cached offset table is wrong within a
 * second of being built.
 */
(function () {
    'use strict';

    var SVG_NS = 'http://www.w3.org/2000/svg';

    // Where in the viewport a section counts as "the one being read".
    var ACTIVE_LINE = 0.35;

    var state = {
        sections: [],
        status: null,
        list: null,
        statusName: null,
        statusCount: null,
        statusPrev: null,
        statusNext: null,
        backToTop: null,
        progress: null,
        heroCue: null,
        active: -1
    };

    /* --------------------------------------------------------------
     * Moving the page.
     *
     * The same instant jump the rest of site-nav.js uses, and for the
     * same measured reason: the scroll machinery on these pages cancels
     * any smooth scroll mid-flight and leaves the reader at the top.
     * -------------------------------------------------------------- */

    function goTo(target) {
        if (!target) {
            return;
        }
        target.scrollIntoView({ behavior: 'auto', block: 'start' });
        if (!target.hasAttribute('tabindex')) {
            target.setAttribute('tabindex', '-1');
        }
        target.focus({ preventScroll: true });
    }

    function chevron(direction) {
        var svg = document.createElementNS(SVG_NS, 'svg');
        svg.setAttribute('width', '14');
        svg.setAttribute('height', '14');
        svg.setAttribute('viewBox', '0 0 14 14');
        svg.setAttribute('fill', 'none');
        svg.setAttribute('aria-hidden', 'true');

        var path = document.createElementNS(SVG_NS, 'path');
        path.setAttribute('d', direction === 'up' ? 'M1.5 9 7 3.5 12.5 9' : 'M1.5 5 7 10.5 12.5 5');
        path.setAttribute('stroke', 'currentColor');
        path.setAttribute('stroke-width', '1.6');
        path.setAttribute('stroke-linecap', 'round');
        path.setAttribute('stroke-linejoin', 'round');
        svg.appendChild(path);
        return svg;
    }

    /* --------------------------------------------------------------
     * The pieces.
     * -------------------------------------------------------------- */

    function buildProgress() {
        // Outside the Barba container, so it is built once and survives
        // every page transition.
        var existing = document.querySelector('.scroll_progress .bar');
        if (existing) {
            return existing;
        }

        var track = document.createElement('div');
        track.className = 'scroll_progress';
        track.setAttribute('aria-hidden', 'true');

        var bar = document.createElement('span');
        bar.className = 'bar';
        track.appendChild(bar);
        document.body.appendChild(track);
        return bar;
    }

    /*
     * One element carrying both readings of the same fact. Wide screens
     * show the list of names; narrow ones show "section 3 of 6" and the
     * two arrows. The stylesheet decides which, so nothing here has to
     * watch the width.
     */
    function buildStatus(sections) {
        var bar = document.createElement('nav');
        bar.className = 'section_status';
        bar.setAttribute('aria-label', 'Sections of this page');

        var prev = document.createElement('button');
        prev.type = 'button';
        prev.className = 'nav_btn';
        prev.setAttribute('aria-label', 'Go to the previous section');
        prev.appendChild(chevron('up'));

        var where = document.createElement('p');
        where.className = 'where';

        var count = document.createElement('span');
        count.className = 'count';
        var name = document.createElement('span');
        name.className = 'name';
        where.appendChild(count);
        where.appendChild(name);

        var list = document.createElement('div');
        list.className = 'list';
        sections.forEach(function (section, index) {
            var button = document.createElement('button');
            button.type = 'button';
            button.setAttribute('aria-current', 'false');
            button.textContent = section.dataset.section;
            button.addEventListener('click', function () {
                goTo(sections[index]);
            });
            list.appendChild(button);
        });

        var next = document.createElement('button');
        next.type = 'button';
        next.className = 'nav_btn';
        next.setAttribute('aria-label', 'Go to the next section');
        next.appendChild(chevron('down'));

        prev.addEventListener('click', function () {
            goTo(sections[Math.max(0, state.active - 1)]);
        });
        next.addEventListener('click', function () {
            goTo(sections[Math.min(sections.length - 1, state.active + 1)]);
        });

        bar.appendChild(prev);
        bar.appendChild(where);
        bar.appendChild(list);
        bar.appendChild(next);
        document.body.appendChild(bar);

        // On a phone the bar is a fixed strip along the bottom edge, so the
        // page has to stop its last line above it. The stylesheet can only
        // reserve that space on the pages that actually get a bar.
        document.body.classList.add('has-section-status');

        state.list = list;
        state.statusName = name;
        state.statusCount = count;
        state.statusPrev = prev;
        state.statusNext = next;
        return bar;
    }

    function buildBackToTop(sections) {
        var button = document.createElement('button');
        button.type = 'button';
        button.className = 'back_to_top';
        button.setAttribute('aria-label', 'Back to the top of the page');
        button.appendChild(chevron('up'));
        button.addEventListener('click', function () {
            goTo(sections[0]);
        });
        document.body.appendChild(button);
        return button;
    }

    /*
     * The button that sits in the gap between two sections.
     *
     * Only sections marked data-next-cue get one: the gap after a wall
     * of prose is where a reader gives up, and the middle of a pinned,
     * horizontally scrolling gallery is not somewhere to put a button.
     */
    function buildNextCues(sections) {
        sections.forEach(function (section, index) {
            var following = sections[index + 1];
            if (!section.hasAttribute('data-next-cue') || !following) {
                return;
            }

            // Between the two sections, never inside either: every
            // section on this site is a flex row, and a child appended
            // to one lands beside the text instead of under it. The gap
            // is also exactly the place the cue is needed.
            var already = section.nextElementSibling;
            if (already && already.className === 'next_section--container') {
                return;
            }

            var holder = document.createElement('div');
            holder.className = 'next_section--container';

            var button = document.createElement('button');
            button.type = 'button';
            button.className = 'next_section';

            var label = document.createElement('span');
            label.textContent = 'Next: ' + following.dataset.section;

            var arrow = document.createElement('span');
            arrow.className = 'arrow';
            arrow.appendChild(chevron('down'));

            button.appendChild(label);
            button.appendChild(arrow);
            button.addEventListener('click', function () {
                goTo(following);
            });

            holder.appendChild(button);
            section.parentNode.insertBefore(holder, section.nextSibling);
        });
    }

    /* --------------------------------------------------------------
     * Reading the scroll.
     * -------------------------------------------------------------- */

    function activeIndex() {
        var line = window.innerHeight * ACTIVE_LINE;
        var found = 0;
        state.sections.forEach(function (section, index) {
            if (section.getBoundingClientRect().top <= line) {
                found = index;
            }
        });
        return found;
    }

    function paint() {
        var y = window.pageYOffset || document.documentElement.scrollTop || 0;
        var scrollable = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
        var ratio = Math.min(1, Math.max(0, y / scrollable));

        if (state.progress) {
            state.progress.style.width = (ratio * 100).toFixed(2) + '%';
        }

        // The hero cue has said its piece the moment the page moves.
        if (state.heroCue) {
            state.heroCue.classList.toggle('is-hidden', y > 40);
        }

        if (!state.sections.length) {
            return;
        }

        // On the home page the first screen belongs to the hero's own
        // arrow; anywhere else the bar is useful from the first pixel.
        var started = y > 30 || !state.heroCue;

        if (state.status) {
            state.status.classList.toggle('is-visible', started);
        }
        if (state.backToTop) {
            state.backToTop.classList.toggle('is-visible', y > window.innerHeight * 1.2);
        }

        var index = activeIndex();
        if (index === state.active) {
            return;
        }
        state.active = index;

        if (state.list) {
            Array.prototype.forEach.call(state.list.children, function (button, i) {
                button.setAttribute('aria-current', i === index ? 'true' : 'false');
            });
        }

        if (state.statusName) {
            state.statusName.textContent = state.sections[index].dataset.section;
            state.statusCount.textContent = 'Section ' + (index + 1) + ' of ' + state.sections.length;
            state.statusPrev.disabled = index === 0;
            state.statusNext.disabled = index === state.sections.length - 1;
        }
    }

    var running = false;

    function loop() {
        paint();
        window.requestAnimationFrame(loop);
    }

    /* --------------------------------------------------------------
     * Building, and rebuilding after a page transition.
     * -------------------------------------------------------------- */

    function teardown() {
        ['.section_status', '.back_to_top'].forEach(function (selector) {
            var node = document.querySelector(selector);
            if (node) {
                node.parentNode.removeChild(node);
            }
        });
        state.status = null;
        state.list = null;
        state.statusName = null;
        state.statusCount = null;
        state.statusPrev = null;
        state.statusNext = null;
        state.backToTop = null;
        state.sections = [];
        state.active = -1;
    }

    function build(scope) {
        // Barba runs its transitions in sync mode, so the page that is
        // leaving is still in the document: anything unscoped finds the
        // old markup first.
        var root = (scope && scope.querySelectorAll) ? scope : document;

        teardown();
        state.progress = buildProgress();
        state.heroCue = root.querySelector('.scroll_hint');

        var sections = Array.prototype.slice.call(root.querySelectorAll('[data-section]'));
        state.sections = sections;

        if (sections.length > 1) {
            state.status = buildStatus(sections);
            state.backToTop = buildBackToTop(sections);
            buildNextCues(sections);
        }

        state.active = -1;
        paint();

        if (!running) {
            running = true;
            window.requestAnimationFrame(loop);
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () {
            build();
        });
    } else {
        build();
    }

    if (window.barba && window.barba.hooks) {
        window.barba.hooks.afterEnter(function (data) {
            build(data && data.next && data.next.container);
        });
    }
})();
