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
        '                    <a href="#footer" onclick="lenis.scrollTo(\'#footer\')" class="">Contact</a>',
        '                </li>',
        '            </ul>',
        '        </nav>',
        '        <div class="mobile_menu--button">',
        '            <button class="hamburger_btn" href="javascript:void(0);" aria-label="Open mobile menu">',
        '                <div class="hamburger_icon">',
        '                    <div></div>',
        '                    <div></div>',
        '                </div>',
        '            </button>',
        '        </div>',
        '    </div>',
        '</header>'
    ].join('\n'));
})();
