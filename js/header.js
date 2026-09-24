/*
 * Shared site header.
 *
 * Included once per page with <script src="[../]js/header.js"></script> placed
 * where the header should appear, right after the skip-to-main link. The base
 * URL is derived from this script's own src, so the same file works from the
 * site root and from projects/ without any per-page paths.
 */
(function () {
    var script = document.currentScript;
    var base = script.src.replace(/js\/header\.js(\?.*)?$/, '');

    var path = window.location.pathname.split('/').pop() || 'index.html';
    var current = {
        'portfolio.html': 'projects',
        'about.html': 'about'
    }[path] || '';

    function active(key) {
        return current === key ? ' class="active"' : ' class=""';
    }

    script.insertAdjacentHTML('afterend', [
        '<header id="header">',
        '    <div class="header--container">',
        '        <a id="logo_lottie" href="' + base + 'index.html" class="link" aria-label="Back to the homepage">',
        '            <img src="' + base + 'images/persuslogowhite.ico" alt="Home Icon" class="logo-icon">',
        '        </a>',
        '        <nav class="main_menu--container">',
        '            <ul>',
        '                <li class="menu-item">',
        '                    <a href="' + base + 'portfolio.html"' + active('projects') + '>Projects</a>',
        '                </li>',
        '                <li class="menu-item">',
        '                    <a href="' + base + 'about.html"' + active('about') + '>About Me</a>',
        '                </li>',
        '                <li class="menu-item">',
        // A file, not a page: a new tab, and kept away from Barba's transitions.
        '                    <a href="' + base + 'cv.pdf" target="_blank" rel="noopener" data-barba-prevent class="">CV (PDF)</a>',
        '                </li>',
        '                <li class="menu-item">',
        '                    <a href="#footer" class="">Contact</a>',
        '                </li>',
        '            </ul>',
        '        </nav>',
        '        <div class="mobile_menu--button">',
        '            <button class="hamburger_btn" type="button" aria-expanded="false" aria-controls="mobile_menu" aria-label="Open menu">',
        '                <div class="hamburger_icon">',
        '                    <div></div>',
        '                    <div></div>',
        '                </div>',
        '            </button>',
        '        </div>',
        '    </div>',
        '</header>'
    ].join('\n'));

    // master.min.js toggles body.nav-active on click but never tells assistive
    // tech anything changed: the button stayed aria-expanded="false" and
    // labelled "Open mobile menu" the whole time the menu was open.
    var button = document.querySelector('.hamburger_btn');

    // This script runs where the header goes, near the top of <body>, so the
    // menu it points aria-controls at has not been parsed yet.
    document.addEventListener('DOMContentLoaded', function () {
        var menu = document.querySelector('.mobile_menu--container');
        if (menu && !menu.id) {
            menu.id = 'mobile_menu';
        }
    });

    if (button) {
        var sync = function () {
            var open = document.body.classList.contains('nav-active');
            button.setAttribute('aria-expanded', open ? 'true' : 'false');
            button.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
        };

        // The menu closes from three places — the button, a menu link and the
        // overlay — and all three go through this one class on <body>.
        new MutationObserver(sync).observe(document.body, {
            attributes: true,
            attributeFilter: ['class']
        });

        // Escape is the expected way out of an open overlay menu.
        document.addEventListener('keydown', function (event) {
            if (event.key === 'Escape' && document.body.classList.contains('nav-active')) {
                document.body.classList.remove('nav-active');
                button.classList.remove('open');
                button.focus();
            }
        });
    }
})();
