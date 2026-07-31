/*
 * Tiger shark for the contact footer.
 *
 * Renders the model in js/shark-mesh.js with a small hand-written WebGL
 * renderer — no three.js, no external dependencies. The mesh ships in its
 * bind pose; the swimming motion is a travelling sine wave applied in the
 * vertex shader, and the yaw follows the scroll position so the animal turns
 * as the footer comes into view.
 *
 * Model: "Shark" by Quaternius (poly.pizza), CC0 1.0 — public domain, no
 * attribution required. The rig and animation clips were stripped when baking;
 * material base colours were baked to vertex colours.
 *
 * Replaces the old <video id="cta_video">, whose source (/assets/videos/…)
 * has never existed in this repository.
 */
(function () {
    'use strict';

    var CANVAS_ID = 'shark_canvas';
    var HEAD_X = 1.10;      // snout sits at +x, the animal faces right
    var BODY_LEN = 2.20;
    var instance = null;

    /* ---------------------------------------------------------------- maths */

    function mat4() {
        return new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
    }

    function perspective(fovy, aspect, near, far) {
        var f = 1 / Math.tan(fovy / 2), nf = 1 / (near - far), o = mat4();
        o[0] = f / aspect; o[5] = f; o[10] = (far + near) * nf;
        o[11] = -1; o[14] = 2 * far * near * nf; o[15] = 0;
        return o;
    }

    function rotation(rx, ry, rz) {
        var cx = Math.cos(rx), sx = Math.sin(rx),
            cy = Math.cos(ry), sy = Math.sin(ry),
            cz = Math.cos(rz), sz = Math.sin(rz), o = mat4();
        o[0] = cy * cz + sy * sx * sz;  o[1] = cx * sz;  o[2] = -sy * cz + cy * sx * sz;
        o[4] = -cy * sz + sy * sx * cz; o[5] = cx * cz;  o[6] = sy * sz + cy * sx * cz;
        o[8] = sy * cx;                 o[9] = -sx;      o[10] = cy * cx;
        return o;
    }

    function compose(rot, scale, tx, ty, tz) {
        var o = mat4(), i;
        for (i = 0; i < 12; i++) o[i] = rot[i] * scale;
        o[12] = tx; o[13] = ty; o[14] = tz;
        return o;
    }

    /* ----------------------------------------------------------------- mesh */

    function decode(b64) {
        var bin = window.atob(b64), n = bin.length, bytes = new Uint8Array(n), i;
        for (i = 0; i < n; i++) bytes[i] = bin.charCodeAt(i);
        return bytes;
    }

    function loadMesh() {
        var m = window.SHARK_MESH;
        if (!m) return null;
        return {
            position: new Float32Array(decode(m.position).buffer),
            normal: new Float32Array(decode(m.normal).buffer),
            color: decode(m.color),
            index: m.indexBits === 32
                ? new Uint32Array(decode(m.index).buffer)
                : new Uint16Array(decode(m.index).buffer),
            count: m.indexCount
        };
    }

    /* --------------------------------------------------------------- shaders */

    var VERT = [
        'attribute vec3 aPos;',
        'attribute vec3 aNormal;',
        'attribute vec3 aColor;',
        'uniform mat4 uProj;',
        'uniform mat4 uModel;',
        'uniform float uTime;',
        'uniform float uSway;',
        'varying vec3 vNormal;',
        'varying vec3 vColor;',
        'varying vec3 vView;',
        '',
        'void main() {',
        '  vec3 p = aPos;',
        '  float t = clamp((' + HEAD_X.toFixed(2) + ' - p.x) / ' + BODY_LEN.toFixed(2) + ', 0.0, 1.0);',
        // Almost nothing at the head, growing towards the tail: how a shark swims.
        '  float k = max(t - 0.18, 0.0);',
        '  float amp = 0.30 * k * k * uSway;',
        '  float phase = uTime * 2.1 - t * 3.3;',
        '  p.z += amp * sin(phase);',
        '',
        // Lateral shear, so the normal needs the inverse-transpose correction.
        '  float dAmp = 0.60 * k * uSway * (-1.0 / ' + BODY_LEN.toFixed(2) + ');',
        '  float dz = dAmp * sin(phase) + amp * cos(phase) * (3.3 / ' + BODY_LEN.toFixed(2) + ');',
        '  vec3 n = normalize(vec3(aNormal.x - dz * aNormal.z, aNormal.y, aNormal.z));',
        '',
        '  vColor = aColor;',
        '  vNormal = mat3(uModel) * n;',
        '  vec4 world = uModel * vec4(p, 1.0);',
        '  vView = -world.xyz;',
        '  gl_Position = uProj * world;',
        '}'
    ].join('\n');

    var FRAG = [
        'precision mediump float;',
        'varying vec3 vNormal;',
        'varying vec3 vColor;',
        'varying vec3 vView;',
        '',
        'void main() {',
        '  vec3 n = normalize(vNormal);',
        '  if (!gl_FrontFacing) n = -n;',
        '  vec3 v = normalize(vView);',
        '',
        // The model already carries a dark back and a pale belly in its vertex
        // colours. Those are authored in sRGB, so linearise before lighting and
        // encode again at the end — otherwise the navy back washes out to grey.
        '  vec3 base = pow(vColor, vec3(2.2));',
        '  vec3 key = normalize(vec3(-0.30, 0.88, 0.46));',
        '  float diff = max(dot(n, key), 0.0);',
        '  float sky = 0.5 + 0.5 * n.y;',
        // The floor of the ambient term stands in for light bouncing up off the
        // water, which is what keeps a shark's underside readable.
        '  vec3 ambient = mix(vec3(0.34, 0.40, 0.50), vec3(0.52, 0.62, 0.80), sky);',
        '  vec3 col = base * (ambient + diff * 0.45);',
        '',
        // Wet sheen along the silhouette, tinted to the footer background.
        // Kept small and tight: this is added in linear space, where the navy
        // back is only ~0.06, so a generous rim would flatten the whole animal
        // to grey — especially on a 644-triangle mesh with many grazing faces.
        '  float rim = pow(1.0 - max(dot(n, v), 0.0), 4.0);',
        '  col += vec3(0.63, 0.77, 1.0) * rim * 0.05;',
        '',
        '  vec3 h = normalize(key + v);',
        '  col += vec3(1.0) * pow(max(dot(n, h), 0.0), 48.0) * 0.035;',
        '',
        '  gl_FragColor = vec4(pow(col, vec3(1.0 / 2.2)), 1.0);',
        '}'
    ].join('\n');

    /* ----------------------------------------------------------------- setup */

    function compile(gl, type, src) {
        var s = gl.createShader(type);
        gl.shaderSource(s, src);
        gl.compileShader(s);
        if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { gl.deleteShader(s); return null; }
        return s;
    }

    function create(canvas) {
        var mesh = loadMesh();
        if (!mesh) return null;

        var opts = { alpha: true, antialias: true, depth: true };
        var gl = canvas.getContext('webgl', opts) ||
                 canvas.getContext('experimental-webgl', opts);
        if (!gl) { canvas.style.display = 'none'; return null; }

        var vs = compile(gl, gl.VERTEX_SHADER, VERT);
        var fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
        if (!vs || !fs) { canvas.style.display = 'none'; return null; }

        var prog = gl.createProgram();
        gl.attachShader(prog, vs);
        gl.attachShader(prog, fs);
        gl.linkProgram(prog);
        if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { canvas.style.display = 'none'; return null; }
        gl.useProgram(prog);

        function attrib(name, data, size, type, normalized) {
            var b = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, b);
            gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
            var loc = gl.getAttribLocation(prog, name);
            gl.enableVertexAttribArray(loc);
            gl.vertexAttribPointer(loc, size, type, normalized, 0, 0);
        }

        attrib('aPos', mesh.position, 3, gl.FLOAT, false);
        attrib('aNormal', mesh.normal, 3, gl.FLOAT, false);
        attrib('aColor', mesh.color, 3, gl.UNSIGNED_BYTE, true);

        var ib = gl.createBuffer();
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, mesh.index, gl.STATIC_DRAW);

        gl.enable(gl.DEPTH_TEST);
        gl.disable(gl.CULL_FACE);
        gl.clearColor(0, 0, 0, 0);

        return {
            gl: gl, canvas: canvas,
            count: mesh.count,
            indexType: mesh.index.BYTES_PER_ELEMENT === 4 ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT,
            uProj: gl.getUniformLocation(prog, 'uProj'),
            uModel: gl.getUniformLocation(prog, 'uModel'),
            uTime: gl.getUniformLocation(prog, 'uTime'),
            uSway: gl.getUniformLocation(prog, 'uSway'),
            yaw: -0.35, roll: 0, aspect: 1, scale: 1,
            raf: 0, start: 0,
            reduced: !!(window.matchMedia &&
                window.matchMedia('(prefers-reduced-motion: reduce)').matches)
        };
    }

    function resize(s) {
        var dpr = Math.min(window.devicePixelRatio || 1, 2);
        var w = Math.max(1, Math.round(s.canvas.clientWidth * dpr));
        var h = Math.max(1, Math.round(s.canvas.clientHeight * dpr));
        if (s.canvas.width !== w || s.canvas.height !== h) {
            s.canvas.width = w;
            s.canvas.height = h;
            s.gl.viewport(0, 0, w, h);
        }
        s.aspect = w / h;
        var visibleW = 2 * 3.6 * Math.tan(0.28) * s.aspect;
        s.scale = Math.max(0.7, Math.min(2.0, 0.62 * visibleW / BODY_LEN));
    }

    // 0 when the footer first appears at the bottom of the screen, 1 once it
    // has travelled a full viewport height up.
    function scrollProgress(canvas) {
        var r = canvas.getBoundingClientRect();
        var vh = window.innerHeight || 1;
        return Math.max(0, Math.min(1, 1 - (r.top + r.height / 2) / vh));
    }

    function frame(s, now) {
        if (!s.start) s.start = now;
        var time = (now - s.start) / 1000;
        var t = s.reduced ? 0 : time;

        resize(s);

        var p = scrollProgress(s.canvas);
        s.yaw += ((-0.35 + (p - 0.5) * 1.05) - s.yaw) * 0.075;
        s.roll += (((p - 0.5) * 0.18 + Math.sin(t * 0.27) * 0.05) - s.roll) * 0.06;
        var pitch = -0.08 + Math.sin(t * 0.36) * 0.035;

        var gl = s.gl;
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        gl.uniformMatrix4fv(s.uProj, false, perspective(0.56, s.aspect, 0.1, 40));
        gl.uniformMatrix4fv(s.uModel, false,
            compose(rotation(pitch, s.yaw, s.roll), s.scale, 0, -0.02 * s.scale, -3.6));
        gl.uniform1f(s.uTime, t);
        gl.uniform1f(s.uSway, s.reduced ? 0.25 : 1.0);
        gl.drawElements(gl.TRIANGLES, s.count, s.indexType, 0);

        s.raf = requestAnimationFrame(function (n) { frame(s, n); });
    }

    /* ------------------------------------------------------------------ init */

    function stop() {
        if (instance) {
            cancelAnimationFrame(instance.raf);
            if (instance.observer) instance.observer.disconnect();
            instance = null;
        }
    }

    function init() {
        stop();
        var canvas = document.getElementById(CANVAS_ID);
        if (!canvas) return;

        var s = create(canvas);
        if (!s) return;
        instance = s;

        resize(s);
        s.raf = requestAnimationFrame(function (n) { frame(s, n); });

        // Stop drawing while the footer is off screen.
        if (window.IntersectionObserver) {
            s.observer = new IntersectionObserver(function (entries) {
                var on = entries[0].isIntersecting;
                if (on && !s.raf) {
                    s.start = 0;
                    s.raf = requestAnimationFrame(function (n) { frame(s, n); });
                } else if (!on && s.raf) {
                    cancelAnimationFrame(s.raf);
                    s.raf = 0;
                }
            }, { rootMargin: '150px' });
            s.observer.observe(canvas);
        }
    }

    function hookBarba() {
        if (window.barba && window.barba.hooks) {
            window.barba.hooks.after(init);
            window.barba.hooks.beforeLeave(stop);
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () { init(); hookBarba(); });
    } else {
        init();
        hookBarba();
    }
})();
