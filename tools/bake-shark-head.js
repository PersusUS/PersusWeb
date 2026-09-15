/*
 * Generates js/shark-head-mesh.js: a stylised shark head with the jaws open.
 *
 * Nothing is downloaded and nothing is traced — the head is built from a
 * handful of profile curves, so the whole animal is a few numbers at the top
 * of this file and can be re-tuned by editing them and re-running:
 *
 *     node tools/bake-shark-head.js
 *
 * Axes match the body model in js/shark-mesh.js: +x is forward (the snout),
 * +y is up, +z is the animal's right. That matters because js/shark.js frames
 * both meshes with the same camera and the same BODY_LEN.
 *
 * The construction, in one paragraph. The head is two lofts: the cranium,
 * whose cross-section is a superellipse ring whose lower half flattens out
 * into the roof of the mouth behind the snout; and the lower jaw, the same
 * thing mirrored, swung open about a hinge at the back. Where the two lofts
 * face each other is the mouth, and the rim of each is walked to plant a row
 * of teeth. The result is closed at both ends, so there is no back face to
 * see through — js/shark.js draws with culling off.
 */

'use strict';

const fs = require('fs');
const path = require('path');

/* ------------------------------------------------------------------ dials */

const L = 2.20;          // nose to nape, matching BODY_LEN in shark.js
const X0 = 1.10;         // the snout sits at +x

// Enough resolution to keep the silhouette smooth at the size the About page
// draws it, and no more: every ring costs RING vertices in the shipped file.
const RING = 26;         // points around a cross-section
const ROWS = 22;         // cross-sections along the cranium
const JAW_ROWS = 14;

const T_LIP = 0.150;     // where the roof of the mouth starts, behind the snout
const T_CHIN = 0.205;    // the point of the lower jaw, set back from the lip
const T_HINGE = 0.700;   // the corner of the mouth
const GAPE = 0.46;       // radians the lower jaw swings open
const JAW_W = 0.86;      // the jaw is narrower than the skull it hangs from
const JAW_D = 0.62;      // and shallower, or it reads as a drawer

const SQUARE = 0.88;     // superellipse exponent: < 1 flattens the skull
const PALATE = 0.055;    // how far the roof of the mouth domes down
const FLOOR = 0.045;     // and how far the tongue bed domes up

// Half-width, height above the jaw line, depth below it, and the height of
// the jaw line itself. The snout overhangs, so yc starts high and falls.
const W_  = [[0, .135], [.05, .21], [.165, .33], [.30, .50], [.46, .62], [.62, .70], [.78, .730], [.90, .655], [1, .47]];
const HU_ = [[0, .105], [.05, .16], [.165, .25], [.30, .37], [.46, .46], [.62, .52], [.78, .540], [.90, .495], [1, .39]];
const HL_ = [[0, .015], [.06, .10], [.215, .21], [.36, .31], [.52, .38], [.68, .42], [.83, .435], [.93, .42], [1, .37]];
const YC_ = [[0, .150], [.06, .115], [.165, .055], [.30, -.01], [.50, -.05], [.75, -.065], [1, -.06]];

const SKIN_BACK  = [0x2b, 0x37, 0x49];
const SKIN_FLANK = [0x53, 0x64, 0x76];
const SKIN_BELLY = [0xc6, 0xd0, 0xd7];
const MOUTH_NEAR = [0xd2, 0x82, 0x8c];
const MOUTH_DEEP = [0x4a, 0x1e, 0x25];
const THROAT     = [0x2a, 0x10, 0x15];
const GUM        = [0xa8, 0x56, 0x60];
const TOOTH      = [0xf4, 0xf2, 0xea];
const EYE        = [0x0a, 0x0d, 0x11];
const NAPE       = [0x1a, 0x21, 0x2b];

/* ------------------------------------------------------------------ maths */

// Smoothstep between control points: C1 at the knots and, unlike a spline,
// it never overshoots — an overshoot here is a dent in the animal's flank.
function curve(cps, t) {
    if (t <= cps[0][0]) return cps[0][1];
    for (let i = 1; i < cps.length; i++) {
        if (t <= cps[i][0]) {
            const [t0, v0] = cps[i - 1], [t1, v1] = cps[i];
            const u = (t - t0) / (t1 - t0);
            return v0 + (v1 - v0) * (u * u * (3 - 2 * u));
        }
    }
    return cps[cps.length - 1][1];
}

const W = t => curve(W_, t);
const HU = t => curve(HU_, t);
const HL = t => curve(HL_, t);
const YC = t => curve(YC_, t);
const X = t => X0 - L * t;

const clamp01 = v => v < 0 ? 0 : v > 1 ? 1 : v;
const smooth = (a, b, v) => { const u = clamp01((v - a) / (b - a)); return u * u * (3 - 2 * u); };
const mix = (a, b, u) => a.map((v, i) => Math.round(v + (b[i] - v) * clamp01(u)));
const pw = (v, e) => Math.sign(v) * Math.pow(Math.abs(v), e);

function rotZ(p, c, ang) {
    const s = Math.sin(ang), k = Math.cos(ang);
    const dx = p[0] - c[0], dy = p[1] - c[1];
    return [c[0] + dx * k - dy * s, c[1] + dx * s + dy * k, p[2]];
}

function norm(v) {
    const m = Math.hypot(v[0], v[1], v[2]) || 1;
    return [v[0] / m, v[1] / m, v[2] / m];
}

/* ------------------------------------------------------------------ mesh */

class Mesh {
    constructor() { this.pos = []; this.col = []; this.idx = []; }

    vert(p, c) {
        this.pos.push(p[0], p[1], p[2]);
        this.col.push(c[0], c[1], c[2]);
        return this.pos.length / 3 - 1;
    }

    tri(a, b, c) { this.idx.push(a, b, c); }

    quad(a, b, c, d) { this.tri(a, b, c); this.tri(a, c, d); }

    // A loft. rows[i] is a ring of points; shared vertices mean the normals
    // come out smooth, which is what skin wants.
    loft(rows, colours, closed) {
        const ids = rows.map((ring, i) => ring.map((p, j) => this.vert(p, colours[i][j])));
        for (let i = 0; i + 1 < ids.length; i++) {
            const n = ids[i].length;
            const last = closed ? n : n - 1;
            for (let j = 0; j < last; j++) {
                const k = (j + 1) % n;
                this.quad(ids[i][j], ids[i][k], ids[i + 1][k], ids[i + 1][j]);
            }
        }
        return ids;
    }

    fan(ring, apex, colour) {
        const a = this.vert(apex, colour);
        const n = ring.length;
        for (let j = 0; j < n; j++) this.tri(a, ring[(j + 1) % n], ring[j]);
    }

    // Its own three vertices per triangle, so this face keeps its own normal.
    flat(p0, p1, p2, colour) {
        this.tri(this.vert(p0, colour), this.vert(p1, colour), this.vert(p2, colour));
    }

    // Faces that share a vertex average into it; faces that do not keep their
    // own. One pass therefore gives smooth skin and faceted teeth.
    normals() {
        const n = new Float32Array(this.pos.length);
        for (let i = 0; i < this.idx.length; i += 3) {
            const [a, b, c] = [this.idx[i], this.idx[i + 1], this.idx[i + 2]];
            const p = k => [this.pos[k * 3], this.pos[k * 3 + 1], this.pos[k * 3 + 2]];
            const [A, B, C] = [p(a), p(b), p(c)];
            const u = [B[0] - A[0], B[1] - A[1], B[2] - A[2]];
            const v = [C[0] - A[0], C[1] - A[1], C[2] - A[2]];
            const f = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
            for (const k of [a, b, c]) { n[k * 3] += f[0]; n[k * 3 + 1] += f[1]; n[k * 3 + 2] += f[2]; }
        }
        for (let k = 0; k < n.length; k += 3) {
            const m = Math.hypot(n[k], n[k + 1], n[k + 2]) || 1;
            n[k] /= m; n[k + 1] /= m; n[k + 2] /= m;
        }
        return n;
    }
}

/* ------------------------------------------------------------- the animal */

const mesh = new Mesh();

// How far the underside of the cranium has stopped being a snout and become
// the roof of a mouth: 0 in front of the lip, 1 a little way behind it.
const roof = t => smooth(T_LIP, T_LIP + 0.075, t);

function craniumRing(t) {
    const w = W(t), hu = HU(t), yc = YC(t);
    const below = HL(t) * (1 - roof(t)) + PALATE * roof(t);
    const ring = [], col = [];
    for (let j = 0; j < RING; j++) {
        const a = (j / RING) * Math.PI * 2;
        const sn = Math.sin(a), cs = Math.cos(a);
        const h = sn >= 0 ? hu : below;
        const p = [X(t), yc + h * pw(sn, SQUARE), w * pw(cs, SQUARE)];
        // Roof of the mouth where the underside has flattened, skin elsewhere.
        const inside = roof(t) * clamp01(-sn * 2.2);
        let c = sn >= 0
            ? mix(SKIN_FLANK, SKIN_BACK, smooth(0.25, 1, sn))
            : mix(SKIN_FLANK, SKIN_BELLY, smooth(0.42, 1, -sn));
        c = mix(c, mix(GUM, mix(MOUTH_NEAR, MOUTH_DEEP, smooth(0.35, 0.95, t)), smooth(0.25, 0.8, -sn)), inside);
        if (t > 0.93) c = mix(c, NAPE, smooth(0.93, 1, t));
        // Nostrils: a pair of dark dimples under the snout, in front of the
        // lip, which is most of what tells a viewer this is a shark head-on.
        const nos = Math.hypot(p[0] - X(0.085), (Math.abs(p[2]) - W(0.085) * 0.60) * 1.35);
        if (sn < -0.25) c = mix(c, [0x12, 0x17, 0x1e], (1 - smooth(0.012, 0.042, nos)) * 0.85);
        // The ridge that runs from between the eyes out to the snout.
        c = mix(c, SKIN_BACK, (1 - smooth(0, 0.22, Math.abs(Math.abs(a - Math.PI / 2) ))) * 0.35 * (1 - smooth(0.45, 0.9, t)));
        ring.push(p); col.push(c);
    }
    return { ring, col };
}

// Cranium, from the snout back to a nape that closes over.
{
    const rows = [], cols = [];
    // A hemisphere in front of the first ring. One big fan to a point put a
    // flat cone on the front of the face, which head-on read as a party hat.
    const nose = craniumRing(0);
    const tip = [X(0) + 0.075, YC(0) - 0.016];
    for (let k = 3; k >= 1; k--) {
        const ang = (k / 4) * (Math.PI / 2);
        const s = Math.sin(ang);
        rows.push(nose.ring.map(p => [
            tip[0] - (tip[0] - X(0)) * s,
            tip[1] + (p[1] - YC(0)) * s,
            p[2] * s
        ]));
        cols.push(nose.col.slice());
    }
    for (let i = 0; i <= ROWS; i++) {
        const t = i / ROWS;
        const r = craniumRing(t);
        rows.push(r.ring); cols.push(r.col);
    }
    // Three shrinking rings so the back of the head closes instead of showing
    // its own inside — shark.js draws with culling off.
    for (let k = 1; k <= 4; k++) {
        const s = Math.pow(k / 5, 0.72);
        const base = craniumRing(1);
        rows.push(base.ring.map(p => [p[0] - 0.10 * s, YC(1) + (p[1] - YC(1)) * (1 - s * s * 0.95), p[2] * (1 - s * s * 0.95)]));
        cols.push(base.col.map(() => NAPE));
    }
    const ids = mesh.loft(rows, cols, true);
    mesh.fan(ids[0], [tip[0], tip[1], 0], mix(SKIN_FLANK, SKIN_BELLY, 0.30));
    mesh.fan(ids[ids.length - 1].slice().reverse(), [X(1) - 0.13, YC(1), 0], NAPE);
}

// Lower jaw: the same idea upside down, then swung open about the corner of
// the mouth. Rotating the points before the normals are taken means the
// lighting follows the swing.
const hinge = [X(T_HINGE), YC(T_HINGE) - 0.015, 0];

function jawPoint(t, a) {
    const w = W(t) * JAW_W, hl = HL(t) * JAW_D, yj = YC(t) - 0.015;
    const sn = Math.sin(a), cs = Math.cos(a);
    const h = sn >= 0 ? FLOOR : hl;
    return rotZ([X(t), yj + h * pw(sn, SQUARE), w * pw(cs, SQUARE)], hinge, -GAPE);
}

{
    const rows = [], cols = [];
    for (let i = 0; i <= JAW_ROWS; i++) {
        const t = T_CHIN + (T_HINGE - T_CHIN) * (i / JAW_ROWS);
        const ring = [], col = [];
        for (let j = 0; j < RING; j++) {
            const a = (j / RING) * Math.PI * 2;
            const sn = Math.sin(a);
            ring.push(jawPoint(t, a));
            let c = sn >= 0
                ? mix(GUM, mix(MOUTH_NEAR, MOUTH_DEEP, smooth(0.4, 0.95, (t - T_CHIN) / (T_HINGE - T_CHIN))), smooth(0.2, 0.75, sn))
                : mix(SKIN_FLANK, SKIN_BELLY, smooth(0.1, 0.9, -sn));
            col.push(c);
        }
        rows.push(ring); cols.push(col);
    }
    const ids = mesh.loft(rows, cols, true);
    mesh.fan(ids[0], rotZ([X(T_CHIN) + 0.06, YC(T_CHIN) - 0.09, 0], hinge, -GAPE), mix(SKIN_BELLY, GUM, 0.35));
    mesh.fan(ids[ids.length - 1].slice().reverse(), rotZ([X(T_HINGE) - 0.06, YC(T_HINGE) - 0.18, 0], hinge, -GAPE), MOUTH_DEEP);
}

/* ------------------------------------------------------- throat and tongue */

// The skull and the jaw are two separate closed solids, so the back of the
// gape is a slot you can see the page through. This plugs it with a pocket
// that recedes and darkens, which is also what gives the mouth any depth.
{
    const rows = [], cols = [];
    const yMid = YC(T_HINGE) - 0.06;
    for (let i = 0; i <= 6; i++) {
        const u = i / 6;
        const t = T_HINGE - 0.03 + 0.26 * u;
        const k = 1 - u * u * 0.88;
        const ring = [], col = [];
        for (let j = 0; j < RING; j++) {
            const a = (j / RING) * Math.PI * 2;
            ring.push([
                X(t),
                yMid + 0.20 * k * pw(Math.sin(a), SQUARE),
                W(T_HINGE) * 0.80 * k * pw(Math.cos(a), SQUARE)
            ]);
            col.push(mix(MOUTH_DEEP, THROAT, smooth(0, 0.6, u)));
        }
        rows.push(ring); cols.push(col);
    }
    const ids = mesh.loft(rows, cols, true);
    mesh.fan(ids[ids.length - 1].slice().reverse(), [X(T_HINGE + 0.26), yMid, 0], THROAT);
}

// A tongue, because the alternative is a flat pink floor with nothing on it.
{
    const t0 = T_CHIN + 0.06, t1 = T_HINGE - 0.06;
    const rows = [], cols = [];
    for (let i = 0; i <= 8; i++) {
        const u = i / 8;
        const t = t0 + (t1 - t0) * u;
        const taper = Math.sin(Math.PI * (0.18 + 0.82 * u)) * 0.96;
        const ring = [], col = [];
        for (let j = 0; j < RING; j++) {
            const a = (j / RING) * Math.PI * 2;
            const sn = Math.sin(a), cs = Math.cos(a);
            ring.push(rotZ([
                X(t),
                YC(t) - 0.012 + 0.058 * taper * pw(sn, 0.7),
                W(t) * JAW_W * 0.62 * taper * pw(cs, 0.7)
            ], hinge, -GAPE));
            col.push(mix(MOUTH_NEAR, MOUTH_DEEP, smooth(0.15, 1, u) * 0.75));
        }
        rows.push(ring); cols.push(col);
    }
    mesh.loft(rows, cols, true);
}

/* ------------------------------------------------------------------ teeth */

// The rim of each jaw is a U: down one side, across the front, back up the
// other. Sampling it and smoothing the corners gives somewhere to plant a
// row of teeth that follows the actual surface rather than a guessed curve.
function rimPath(front, back, point, count) {
    const pts = [];
    const side = Math.max(2, Math.round(count * 0.38));
    const nose = count - 2 * side;
    for (let i = 0; i < side; i++) {
        const t = back + (front - back) * (i / side);
        pts.push(point(t, Math.PI));
    }
    for (let i = 0; i <= nose; i++) {
        const a = Math.PI + Math.PI * (i / nose);
        pts.push(point(front, a));
    }
    for (let i = 1; i <= side; i++) {
        const t = front + (back - front) * (i / side);
        pts.push(point(t, 0));
    }
    // Two relaxation passes: the corner where the side meets the front is a
    // right angle in plan, and a right angle in a row of teeth looks built.
    for (let pass = 0; pass < 2; pass++) {
        for (let i = 1; i + 1 < pts.length; i++) {
            pts[i] = pts[i].map((v, k) => v * 0.5 + (pts[i - 1][k] + pts[i + 1][k]) * 0.25);
        }
    }
    return pts;
}

// Centre of the gape, so a tooth knows which way "into the mouth" is.
const mouthMid = [(X(T_LIP) + X(T_HINGE)) / 2, YC(0.5), 0];

function plantTeeth(pts, up, sizeFront, sizeBack) {
    for (let i = 0; i < pts.length; i++) {
        const s = Math.abs(i - (pts.length - 1) / 2) / ((pts.length - 1) / 2);
        const size = sizeFront + (sizeBack - sizeFront) * s;
        const p = pts[i];
        const prev = pts[Math.max(0, i - 1)], next = pts[Math.min(pts.length - 1, i + 1)];
        const along = norm([next[0] - prev[0], next[1] - prev[1], next[2] - prev[2]]);
        const out = norm([p[0] - mouthMid[0], 0, p[2] - mouthMid[2]]);
        const dir = norm([
            -out[0] * 0.30,
            up ? 1 : -1,
            -out[2] * 0.30
        ]);
        const apex = [p[0] + dir[0] * size * 1.9, p[1] + dir[1] * size * 1.9, p[2] + dir[2] * size * 1.9];
        // A four-sided base: two corners along the gum line, two across it.
        const across = norm([along[1] * out[2] - along[2] * out[1],
                             along[2] * out[0] - along[0] * out[2],
                             along[0] * out[1] - along[1] * out[0]]);
        const base = [];
        for (const [u, v] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
            base.push([
                p[0] + along[0] * u * size + across[0] * v * size * 0.45,
                p[1] + along[1] * u * size + across[1] * v * size * 0.45,
                p[2] + along[2] * u * size + across[2] * v * size * 0.45
            ]);
        }
        for (let k = 0; k < 4; k++) {
            const a = base[k], b = base[(k + 1) % 4];
            if (up) mesh.flat(a, b, apex, TOOTH); else mesh.flat(b, a, apex, TOOTH);
        }
    }
}

plantTeeth(rimPath(T_LIP, T_HINGE - 0.02, (t, a) => {
    const w = W(t), yc = YC(t);
    const below = HL(t) * (1 - roof(t)) + PALATE * roof(t);
    const sn = Math.sin(a), cs = Math.cos(a);
    return [X(t), yc + (sn >= 0 ? HU(t) : below) * pw(sn, SQUARE) * 0.86, w * pw(cs, SQUARE) * 0.90];
}, 17), false, 0.078, 0.042);

plantTeeth(rimPath(T_CHIN, T_HINGE - 0.02, (t, a) => {
    const p = jawPoint(t, a);
    return [p[0], p[1], p[2] * 0.90];
}, 15), true, 0.068, 0.038);

/* ------------------------------------------------------------------- eyes */

for (const side of [-1, 1]) {
    const t = 0.285;
    const cx = X(t) - 0.02, cy = YC(t) + HU(t) * 0.26, cz = side * W(t) * 0.92;
    const R = 0.075;
    const rows = [], cols = [];
    for (let i = 0; i <= 7; i++) {
        const ph = (i / 7) * Math.PI;
        const ring = [], col = [];
        for (let j = 0; j < 12; j++) {
            const a = (j / 12) * Math.PI * 2;
            ring.push([
                cx + R * Math.sin(ph) * Math.cos(a),
                cy + R * Math.cos(ph),
                cz + R * Math.sin(ph) * Math.sin(a) * 0.55 + side * R * 0.25
            ]);
            col.push(EYE);
        }
        rows.push(ring); cols.push(col);
    }
    mesh.loft(rows, cols, true);
}

/* ----------------------------------------------------------------- output */

const normals = mesh.normals();
const position = new Float32Array(mesh.pos);
const colour = new Uint8Array(mesh.col);
const index = new Uint16Array(mesh.idx);
const count = position.length / 3;

if (count > 65535) throw new Error('too many vertices for 16-bit indices: ' + count);

const b64 = buf => Buffer.from(buf.buffer, buf.byteOffset, buf.byteLength).toString('base64');

const out = 'window.SHARK_HEAD_MESH=' + JSON.stringify({
    vertexCount: count,
    indexCount: index.length,
    indexBits: 16,
    position: b64(position),
    normal: b64(normals),
    color: b64(colour),
    index: b64(index)
}) + ';\n';

const dest = path.join(__dirname, '..', 'js', 'shark-head-mesh.js');
fs.writeFileSync(dest, out);
console.log('vertices', count, 'triangles', index.length / 3, 'bytes', out.length);
