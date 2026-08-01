/*
 * Contact modal.
 *
 * Progressive enhancement over the "Drop me an email!" links: without this
 * script they stay ordinary mailto: anchors, so the page still works. With it,
 * the click opens a form that posts to FormSubmit's AJAX endpoint and reports
 * the result in place, without leaving the page or needing a mail client.
 *
 * The button lives inside the barba container and is replaced on navigation,
 * so the click is delegated from document rather than bound per element. The
 * modal itself is appended to body, outside the container, and survives.
 */
(function () {
    var ENDPOINT = 'https://formsubmit.co/ajax/jp.bazarot@gmail.com';
    var ADDRESS = 'jp.bazarot@gmail.com';

    var modal, form, lastFocused;

    function build() {
        modal = document.createElement('div');
        modal.className = 'contact_modal';
        modal.setAttribute('role', 'dialog');
        modal.setAttribute('aria-modal', 'true');
        modal.setAttribute('aria-labelledby', 'contact_modal_title');
        modal.innerHTML = [
            '<div class="overlay" data-close></div>',
            '<div class="panel">',
            '  <button type="button" class="close_btn" data-close aria-label="Close">&#10005;</button>',
            '  <div class="form_view">',
            '    <h2 id="contact_modal_title">Say hello</h2>',
            '    <p class="intro">Tell me what you are working on. I read everything and reply to what I can.</p>',
            '    <form novalidate>',
            '      <div class="field">',
            '        <label for="cf_name">Your name</label>',
            '        <input type="text" id="cf_name" name="name" autocomplete="name" placeholder="Jane Doe">',
            '        <span class="error_text">Please tell me your name.</span>',
            '      </div>',
            '      <div class="field">',
            '        <label for="cf_email">Your email</label>',
            '        <input type="email" id="cf_email" name="email" autocomplete="email" placeholder="jane@example.com">',
            '        <span class="error_text">That email address does not look right.</span>',
            '      </div>',
            '      <div class="field">',
            '        <label for="cf_message">Message</label>',
            '        <textarea id="cf_message" name="message" placeholder="What would you like to build?"></textarea>',
            '        <span class="error_text">Please write a message first.</span>',
            '      </div>',
            '      <div class="honey" aria-hidden="true">',
            '        <label for="cf_honey">Leave this empty</label>',
            '        <input type="text" id="cf_honey" name="_honey" tabindex="-1" autocomplete="off">',
            '      </div>',
            '      <div class="submit_row">',
            '        <button type="submit" class="submit_btn">Send message</button>',
            '        <span class="fallback">or write to <a href="mailto:' + ADDRESS + '">' + ADDRESS + '</a></span>',
            '      </div>',
            '      <p class="form_error"></p>',
            '    </form>',
            '  </div>',
            '  <div class="sent">',
            '    <div class="tick">&#10003;</div>',
            '    <h2>Message sent</h2>',
            '    <p>Thanks — it landed in my inbox. I will get back to you.</p>',
            '  </div>',
            '</div>'
        ].join('\n');

        document.body.appendChild(modal);
        form = modal.querySelector('form');

        modal.addEventListener('click', function (e) {
            if (e.target.hasAttribute('data-close')) close();
        });
        form.addEventListener('submit', submit);
        // clear a field's error as soon as the visitor starts fixing it
        form.addEventListener('input', function (e) {
            var field = e.target.closest('.field');
            if (field) field.classList.remove('has-error');
        });
    }

    function open() {
        if (!modal) build();
        lastFocused = document.activeElement;
        modal.classList.add('is-open');
        document.addEventListener('keydown', onKeydown);
        if (window.lenis && lenis.stop) lenis.stop();
        // the panel scrolls on its own; stop the page moving behind it
        document.body.style.overflow = 'hidden';
        setTimeout(function () { modal.querySelector('#cf_name').focus(); }, 60);
    }

    function close() {
        if (!modal) return;
        modal.classList.remove('is-open');
        document.removeEventListener('keydown', onKeydown);
        if (window.lenis && lenis.start) lenis.start();
        document.body.style.overflow = '';
        if (lastFocused && lastFocused.focus) lastFocused.focus();
    }

    function onKeydown(e) {
        if (e.key === 'Escape') { close(); return; }
        if (e.key !== 'Tab') return;
        // keep focus inside the dialog while it is open
        var items = modal.querySelectorAll('button, input, textarea, a[href]');
        var list = [];
        for (var i = 0; i < items.length; i++) {
            if (items[i].offsetParent !== null || items[i] === document.activeElement) list.push(items[i]);
        }
        if (!list.length) return;
        var first = list[0], last = list[list.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }

    function validate() {
        var ok = true;
        [['#cf_name', function (v) { return v.length > 0; }],
         ['#cf_email', function (v) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v); }],
         ['#cf_message', function (v) { return v.length > 0; }]
        ].forEach(function (pair) {
            var el = modal.querySelector(pair[0]);
            var good = pair[1](el.value.trim());
            el.closest('.field').classList.toggle('has-error', !good);
            if (!good && ok) { el.focus(); ok = false; }
        });
        return ok;
    }

    function submit(e) {
        e.preventDefault();
        var errorBox = modal.querySelector('.form_error');
        errorBox.style.display = 'none';
        if (!validate()) return;

        var btn = modal.querySelector('.submit_btn');
        btn.disabled = true;
        btn.textContent = 'Sending…';

        fetch(ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            body: JSON.stringify({
                name: modal.querySelector('#cf_name').value.trim(),
                email: modal.querySelector('#cf_email').value.trim(),
                message: modal.querySelector('#cf_message').value.trim(),
                _honey: modal.querySelector('#cf_honey').value,
                _subject: 'New message from persus.dev',
                _template: 'table'
            })
        })
            .then(function (r) { return r.json(); })
            .then(function (data) {
                if (String(data.success) !== 'true') throw new Error(data.message || 'Rejected');
                modal.classList.add('is-sent');
            })
            .catch(function () {
                btn.disabled = false;
                btn.textContent = 'Send message';
                errorBox.innerHTML = 'That did not go through. Please write to ' +
                    '<a href="mailto:' + ADDRESS + '">' + ADDRESS + '</a> instead.';
                errorBox.style.display = 'block';
            });
    }

    document.addEventListener('click', function (e) {
        var link = e.target.closest('a[href^="mailto:"].lovely_button');
        if (!link) return;
        // let a modified click (new tab, save) behave normally
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
        e.preventDefault();
        open();
    });
})();
