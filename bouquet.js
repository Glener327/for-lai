// ASCII pink tulips: the scene is painted with vector shapes onto a tiny offscreen
// canvas (one pixel per character cell), then every pixel is redrawn as a
// coloured ASCII glyph whose density follows the pixel's brightness.
//
// Pink tulips rise from a leafy florist's bouquet, bloom together, and settle
// into a gentle breeze.
(() => {
  'use strict';

  // A longer, cleaner ramp gives the blooms a sharper silhouette at small sizes.
  const RAMP = ' .,:;i1tfLCG08@';
  const WORLD_W = 1000;
  const WORLD_H = 1100;
  const FPS = 30;

  const PALETTE = {
    tulip: '#f16f9f', tulipLight: '#ffb2c9', tulipShadow: '#c73872',
  };

  // ---------- helpers ----------
  function rng(seed) {
    return () => {
      seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const prog = (T, start, dur) => clamp((T - start) / dur, 0, 1);
  const easeOut = (t) => 1 - Math.pow(1 - t, 3);
  const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const smooth = (a, b, t) => { const x = clamp((t - a) / (b - a), 0, 1); return x * x * (3 - 2 * x); };
  const rad = (d) => (d * Math.PI) / 180;

  function rgbOf(c) {
    if (c[0] === '#') {
      const n = parseInt(c.slice(1), 16);
      return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    }
    return c.match(/\d+/g).slice(0, 3).map(Number);
  }
  function mix(a, b, t) {
    const A = rgbOf(a), B = rgbOf(b);
    return `rgb(${Math.round(lerp(A[0], B[0], t))},${Math.round(lerp(A[1], B[1], t))},${Math.round(lerp(A[2], B[2], t))})`;
  }

  function bez(p, t) {
    const u = 1 - t;
    return [
      u * u * u * p[0][0] + 3 * u * u * t * p[1][0] + 3 * u * t * t * p[2][0] + t * t * t * p[3][0],
      u * u * u * p[0][1] + 3 * u * u * t * p[1][1] + 3 * u * t * t * p[2][1] + t * t * t * p[3][1],
    ];
  }
  function bezAngle(p, t) {
    const a = bez(p, Math.max(0, t - 0.01)), b = bez(p, Math.min(1, t + 0.01));
    return Math.atan2(b[1] - a[1], b[0] - a[0]);
  }

  // Gentle breeze: higher points drift further, so the whole bunch bends together.
  let T = 0;
  let flowerAudioContext = null;
  let flowerMuted = false;
  let bloomSoundPlayed = false;
  let flowerSceneActive = true;

  function unlockFlowerAudio() {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return null;
    if (!flowerAudioContext) flowerAudioContext = new AudioContextClass();
    if (flowerAudioContext.state === 'suspended') flowerAudioContext.resume().catch(() => {});
    return flowerAudioContext;
  }

  function playBloomSound() {
    if (flowerMuted) return;
    const audio = flowerAudioContext;
    if (!audio || audio.state !== 'running') return;
    const now = audio.currentTime;
    const master = audio.createGain();
    master.gain.value = 0.72;
    master.connect(audio.destination);

    // A short filtered swell gives the simultaneous bloom a soft airy lift.
    const swellBuffer = audio.createBuffer(1, Math.floor(audio.sampleRate * 1.7), audio.sampleRate);
    const swellData = swellBuffer.getChannelData(0);
    for (let i = 0; i < swellData.length; i++) swellData[i] = Math.random() * 2 - 1;
    const swell = audio.createBufferSource();
    const swellFilter = audio.createBiquadFilter();
    const swellGain = audio.createGain();
    swell.buffer = swellBuffer;
    swellFilter.type = 'bandpass';
    swellFilter.frequency.setValueAtTime(520, now);
    swellFilter.frequency.exponentialRampToValueAtTime(1650, now + 1.25);
    swellFilter.Q.value = 0.65;
    swellGain.gain.setValueAtTime(0.0001, now);
    swellGain.gain.exponentialRampToValueAtTime(0.13, now + 0.34);
    swellGain.gain.exponentialRampToValueAtTime(0.0001, now + 1.55);
    swell.connect(swellFilter);
    swellFilter.connect(swellGain);
    swellGain.connect(master);
    swell.start(now);
    swell.stop(now + 1.7);

    // Warm bell notes sparkle upward as the tulips open together.
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((frequency, index) => {
      const start = now + 0.18 + index * 0.12;
      const oscillator = audio.createOscillator();
      const overtone = audio.createOscillator();
      const gain = audio.createGain();
      const overtoneGain = audio.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.value = frequency;
      overtone.type = 'triangle';
      overtone.frequency.value = frequency * 2;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.12 - index * 0.012, start + 0.025);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 1.15);
      overtoneGain.gain.setValueAtTime(0.0001, start);
      overtoneGain.gain.exponentialRampToValueAtTime(0.027, start + 0.018);
      overtoneGain.gain.exponentialRampToValueAtTime(0.0001, start + 0.62);
      oscillator.connect(gain);
      overtone.connect(overtoneGain);
      gain.connect(master);
      overtoneGain.connect(master);
      oscillator.start(start);
      overtone.start(start);
      oscillator.stop(start + 1.2);
      overtone.stop(start + 0.7);
    });
  }

  function sway(x, y) {
    const lift = clamp((1090 - y) / 800, 0, 1);
    return [x + Math.sin(T * 0.9 + y * 0.006) * 8 * lift + Math.sin(T * 0.43 + x * 0.004) * 4 * lift, y];
  }

  // ---------- scene ----------
  // Timeline (seconds): stems rise, leaves unfurl, buds swell, then all open together.
  const STEM_START = 0, STEM_DUR = 2.6;
  const LEAF_START = 1.0;
  const BUD_START = 1.8, BUD_GROW_DUR = 1.2;
  const BLUSH_START = 3.6;
  // The last stems finish at about 3s; the tulips open immediately after.
  const OPEN_START = STEM_START + STEM_DUR + 0.4, OPEN_DUR = 0.75;
  const TEXT_REVEAL_AT = OPEN_START + 0.5;

  function buildScene() {
    const r = rng(11);
    const S = { stems: [], leaves: [], buds: [] };

    // [top x, top y, side pedicels]
    // A staggered diamond grid gives every bloom the same 95px spacing. Each
    // bloom has its own stem so random side branches cannot disturb the gaps.
    const tops = [
      [405, 270, 0], [500, 270, 0], [595, 270, 0],
      [310, 365, 0], [405, 365, 0], [500, 365, 0], [595, 365, 0], [690, 365, 0],
      [215, 460, 0], [310, 460, 0], [405, 460, 0], [500, 460, 0], [595, 460, 0], [690, 460, 0], [785, 460, 0],
      [310, 555, 0], [405, 555, 0], [500, 555, 0], [595, 555, 0], [690, 555, 0],
      [405, 650, 0], [500, 650, 0], [595, 650, 0],
    ];
    for (const [gridX, gridY, sides] of tops) {
      // Preserve the balanced grid while adding florist-like natural variation.
      const tx = gridX + (r() - 0.5) * 42;
      const ty = gridY + (r() - 0.5) * 34;
      const bx = 485 + r() * 30;
      const shoulder = (r() - 0.5) * 54;
      const stem = [[bx, 1090], [bx + (tx - bx) * 0.1 + shoulder * 0.18, 860], [lerp(bx, tx, 0.7) + shoulder, ty + 220], [tx, ty]];
      const lean = (tx - 500) * 0.1;
      const stemRef = { pts: stem, start: STEM_START + r() * 0.4 };
      S.stems.push(stemRef);

      // lance-shaped leaves spiral up the middle of each stem
      const n = 5 + Math.floor(r() * 3);
      for (let i = 0; i < n; i++) {
        const t = 0.22 + (i / n) * 0.5 + r() * 0.04;
        const side = i % 2 ? 1 : -1;
        S.leaves.push({
          stem, t, side, len: 85 + r() * 55, w: 13 + r() * 6,
          spread: rad(28 + r() * 26), start: LEAF_START + t * 1.5 + r() * 0.3, tint: r(),
        });
      }

      // buds: one at the tip, the rest on short pedicels branching just below it
      S.buds.push({ stem, stemRef, at: 1, ped: null, dir: rad(-90 + lean + (r() - 0.5) * 10) });
      for (let k = 0; k < sides; k++) {
        const side = k % 2 ? 1 : -1;
        const at = 0.86 + k * 0.035;
        const base = bez(stem, at);
        const ang = rad(-90 + lean + side * 38);
        const len = 58;
        const end = [base[0] + Math.cos(ang) * len, base[1] + Math.sin(ang) * len];
        const ped = [base, [lerp(base[0], end[0], 0.3), base[1] - len * 0.35], [lerp(base[0], end[0], 0.8), lerp(base[1], end[1], 0.7)], end];
        S.buds.push({ stem, stemRef, at, ped, dir: ang });
      }
    }

    // Every stem carries an upright pink tulip.
    S.buds.forEach((b, index) => {
      // Preserve the flower's anchor point, but face it in the exact direction
      // its own stem or pedicel is travelling at the connection.
      b.dir = bezAngle(b.ped || b.stem, 1);
      b.len = 120 + r() * 40;
      b.width = 19 + r() * 5;
      b.squash = 0.6 + r() * 0.25;
      b.scale = 0.84 + r() * 0.3;
      b.naturalTilt = rad((r() - 0.5) * 15);
      b.twist = 0;
      b.droop = 0;
      b.colorIdx = index;
      b.rnd = Array.from({ length: 12 }, r);
      b.grow = BUD_START;
      b.maxOpen = 0.82 + r() * 0.18;
      b.blush = 1;
      b.openAt = OPEN_START + (r() - 0.5) * 0.22;
    });
    addFillers(S);
    return S;
  }

  // Ruscus greenery fills out the bunch around the feature flowers.
  const RUSCUS_START = 0.6;

  function addFillers(S) {
    const r = rng(29);
    S.ruscus = [];

    // ruscus: long arching sprigs with glossy leaves alternating up the stem
    const sprig = (base, ang, len, start, depth) => {
      const end = [base[0] + Math.cos(ang) * len, base[1] + Math.sin(ang) * len];
      const bend = (r() - 0.5) * len * 0.3;
      const pts = [base, [lerp(base[0], end[0], 0.33) + bend, lerp(base[1], end[1], 0.33)],
        [lerp(base[0], end[0], 0.7) + bend * 0.5, lerp(base[1], end[1], 0.7)], end];
      const leaves = [];
      for (let t = 0.2 + r() * 0.08, i = 0; t <= 1; t += 0.075 + r() * 0.035, i++) {
        leaves.push({ t, side: i % 2 ? 1 : -1, len: 34 + r() * 18, w: 10 + r() * 4, tint: r() });
      }
      leaves.push({ t: 1, side: 0, len: 46 + r() * 16, w: 11, tint: r() });
      S.ruscus.push({ pts, leaves, start });
      if (depth > 0) {
        for (let k = 0; k < 2; k++) {
          const t = 0.35 + r() * 0.35;
          const p = bez(pts, t);
          const side = k ? 1 : -1;
          sprig(p, ang + side * rad(25 + r() * 20), len * (0.4 + r() * 0.2), start + t * 1.4, depth - 1);
        }
      }
    };
    // a few sprigs tucked behind the flowers, ending just inside the bouquet's outline
    for (const end of [[210, 560], [270, 340], [420, 215], [600, 205], [750, 320], [810, 560]]) {
      const base = [490 + r() * 20, 820 - r() * 40];
      const ang = Math.atan2(end[1] - base[1], end[0] - base[0]);
      sprig(base, ang, Math.hypot(end[0] - base[0], end[1] - base[1]), RUSCUS_START + r() * 0.8, 0);
    }

  }

  // ---------- drawing ----------
  function strokeCurve(g, pts, from, upto, width, color) {
    if (upto <= from) return;
    const N = 36;
    g.beginPath();
    for (let i = 0; i <= N; i++) {
      const p = bez(pts, lerp(from, upto, i / N));
      const q = sway(p[0], p[1]);
      i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1]);
    }
    g.lineWidth = width;
    g.strokeStyle = color;
    g.lineCap = 'round';
    g.stroke();
  }

  function stemProgress(st) {
    return easeInOut(prog(T, st.start, STEM_DUR));
  }

  function drawLeaf(g, lf) {
    const p = easeOut(prog(T, lf.start, 1.4));
    if (!p) return;
    const a = bez(lf.stem, lf.t);
    const [x, y] = sway(a[0], a[1]);
    const ang = bezAngle(lf.stem, lf.t) + lf.side * lf.spread * (0.4 + 0.6 * p);
    const L = lf.len * p, W = lf.w * (0.4 + 0.6 * p);
    g.save();
    g.translate(x, y);
    g.rotate(ang);
    // the tip arches away from the stem
    const bend = lf.side * L * 0.18;
    g.beginPath();
    g.moveTo(0, 0);
    g.bezierCurveTo(L * 0.3, -W, L * 0.7, -W * 0.8 + bend * 0.5, L, bend);
    g.bezierCurveTo(L * 0.7, W * 0.8 + bend * 0.5, L * 0.3, W, 0, 0);
    const grad = g.createLinearGradient(0, 0, L, 0);
    grad.addColorStop(0, '#2e6e22');
    grad.addColorStop(0.5, lf.tint > 0.5 ? '#4c9a2e' : '#3f8a2a');
    grad.addColorStop(1, '#78bc44');
    g.fillStyle = grad;
    g.fill();
    g.strokeStyle = 'rgba(0,0,0,0.55)';
    g.lineWidth = 5;
    g.stroke();
    g.strokeStyle = 'rgba(20,60,15,0.8)';
    g.lineWidth = 3;
    g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(L * 0.6, bend * 0.3, L * 0.95, bend * 0.95); g.stroke();
    g.restore();
  }

  // One tepal along +x. Closed, six of these overlap into the club-shaped bud;
  // open, they fan out and their tips curl back.
  function tepal(g, L, W, color, edge, throat, vein, open, curl, spots, rnd) {
    const rc = smooth(0.45, 1, open);
    const tipX = L * (1 - 0.12 * rc), tipY = curl * W * 1.6 * rc;
    g.beginPath();
    g.moveTo(0, 0);
    g.bezierCurveTo(L * 0.3, -W * 0.85, L * 0.72, -W * 1.05 + tipY * 0.3, tipX, tipY);
    g.bezierCurveTo(L * 0.72, W * 1.05 + tipY * 0.3, L * 0.3, W * 0.85, 0, 0);
    const grad = g.createLinearGradient(0, 0, L, 0);
    grad.addColorStop(0, throat);
    grad.addColorStop(lerp(0.45, 0.22, open), color);
    grad.addColorStop(1, edge);
    g.fillStyle = grad;
    g.fill();
    g.strokeStyle = 'rgba(0,0,0,0.65)';
    g.lineWidth = 6;
    g.stroke();
    // seam on the bud, nectar groove on the open tepal
    g.strokeStyle = open > 0.2 ? vein : 'rgba(40,70,20,0.55)';
    g.lineWidth = 5;
    g.beginPath(); g.moveTo(L * 0.05, 0); g.quadraticCurveTo(L * 0.6, tipY * 0.2, tipX * 0.94, tipY * 0.9); g.stroke();
    if (spots && open > 0.6) {
      g.fillStyle = `rgba(110,15,40,${(open - 0.6) * 2})`;
      for (let i = 0; i < 4; i++) {
        g.beginPath();
        g.arc(L * (0.18 + rnd[i] * 0.22), (rnd[i + 4] - 0.5) * W * 0.8, 3.5, 0, Math.PI * 2);
        g.fill();
      }
    }
  }

  function budState(b) {
    const grow = easeOut(prog(T, b.grow, BUD_GROW_DUR));
    const blush = smooth(0, 1, prog(T, BLUSH_START + (b.grow - BUD_START), 2.5)) * b.blush;
    const open = easeInOut(prog(T, b.openAt, OPEN_DUR)) * b.maxOpen;
    return { grow, blush, open };
  }

  function tulipPetal(g, L, W, lean, fill, edge) {
    g.beginPath();
    g.moveTo(0, 0);
    g.bezierCurveTo(L * 0.18, -W * 0.85, L * 0.62, -W, L, lean);
    g.bezierCurveTo(L * 0.78, W * 0.18, L * 0.45, W * 0.88, 0, 0);
    const grad = g.createLinearGradient(0, 0, L, 0);
    grad.addColorStop(0, PALETTE.tulipShadow);
    grad.addColorStop(0.62, fill);
    grad.addColorStop(1, PALETTE.tulipLight);
    g.fillStyle = grad; g.fill();
    g.strokeStyle = edge; g.lineWidth = 3.5; g.stroke();
  }

  function drawTulip(g, b, grow, open) {
    const L = (50 + 64 * open) * grow;
    const W = (14 + 31 * open) * grow;
    // Tapered green neck and sepals visually join the petal cup to its stem.
    g.fillStyle = '#5f9a34';
    g.beginPath();
    g.moveTo(-18 * grow, -5 * grow);
    g.lineTo(18 * grow, -9 * grow);
    g.lineTo(28 * grow, 0);
    g.lineTo(18 * grow, 9 * grow);
    g.lineTo(-18 * grow, 5 * grow);
    g.closePath();
    g.fill();
    g.strokeStyle = '#315f25';
    g.lineWidth = 3;
    g.stroke();
    g.beginPath(); g.ellipse(0, 0, 10, 7, 0, 0, Math.PI * 2); g.fill();

    // Dark outer petals flare left and right, forming the tulip's cup.
    g.save(); g.rotate(-0.25 * open); tulipPetal(g, L * 0.93, W, -W * 0.32, PALETTE.tulipShadow, '#7f204b'); g.restore();
    g.save(); g.rotate(0.25 * open); g.scale(1, -1); tulipPetal(g, L * 0.93, W, -W * 0.32, PALETTE.tulipShadow, '#7f204b'); g.restore();
    // Three pointed front petals overlap in a clear crown-shaped rim.
    g.save(); g.rotate(-0.11 * open); tulipPetal(g, L, W * 0.82, -W * 0.18, PALETTE.tulip, '#962553'); g.restore();
    g.save(); g.rotate(0.11 * open); g.scale(1, -1); tulipPetal(g, L, W * 0.82, -W * 0.18, PALETTE.tulip, '#962553'); g.restore();
    tulipPetal(g, L * 1.04, W * 0.68, 0, PALETTE.tulipLight, '#a62b5d');

    // Fine seams follow the petal grain without softening the outline.
    g.strokeStyle = 'rgba(120,25,65,0.72)'; g.lineWidth = 2.2;
    for (const dy of [-0.18, 0.18]) {
      g.beginPath(); g.moveTo(5, 0); g.quadraticCurveTo(L * 0.52, W * dy, L * 0.88, W * dy); g.stroke();
    }
  }

  function drawBud(g, b) {
    const sp = stemProgress(b.stemRef);
    if (b.ped) {
      if (sp < b.at) return;
      const pp = easeOut(prog(T, b.stemRef.start + STEM_DUR * b.at, 1.0));
      strokeCurve(g, b.ped, 0, pp, 5, '#5f9a34');
      if (pp < 0.6) return;
    } else if (sp < 0.98) {
      return;
    }
    const { grow, blush, open } = budState(b);
    if (!grow) return;

    const base = b.ped ? b.ped[3] : bez(b.stem, 1);
    const [x, y] = sway(base[0], base[1]);
    g.save();
    g.translate(x, y);
    g.rotate(b.dir + b.naturalTilt + b.droop * open);
    g.rotate(b.twist * open);
    g.scale(b.scale, b.scale);
    drawTulip(g, b, grow, open);
    g.restore();
  }

  function leafShape(g, L, W, bend) {
    g.beginPath();
    g.moveTo(0, 0);
    g.bezierCurveTo(L * 0.25, -W, L * 0.7, -W * 0.8 + bend * 0.5, L, bend);
    g.bezierCurveTo(L * 0.7, W * 0.8 + bend * 0.5, L * 0.25, W, 0, 0);
  }

  function drawRuscus(g, S) {
    for (const sp of S.ruscus) {
      const p = easeOut(prog(T, sp.start, 2.2));
      if (!p) continue;
      strokeCurve(g, sp.pts, 0, p, 4, '#4f7a34');
      for (const lf of sp.leaves) {
        const lp = easeOut(prog(p, lf.t - 0.04, 0.22));
        if (!lp) continue;
        const a = bez(sp.pts, lf.t);
        const [x, y] = sway(a[0], a[1]);
        g.save();
        g.translate(x, y);
        g.rotate(bezAngle(sp.pts, lf.t) + lf.side * rad(38));
        const L = lf.len * lp, W = lf.w * lp;
        leafShape(g, L, W, lf.side * L * 0.08);
        const grad = g.createLinearGradient(0, -W, L, W);
        grad.addColorStop(0, lf.tint > 0.5 ? '#356a2c' : '#2c5f30');
        grad.addColorStop(0.55, lf.tint > 0.5 ? '#5aa046' : '#4c9240');
        grad.addColorStop(1, '#3a7436');
        g.fillStyle = grad;
        g.fill();
        g.strokeStyle = 'rgba(0,0,0,0.6)';
        g.lineWidth = 4;
        g.stroke();
        g.strokeStyle = 'rgba(150,190,110,0.5)';
        g.lineWidth = 2;
        g.beginPath(); g.moveTo(0, 0); g.lineTo(L * 0.85, lf.side * L * 0.06); g.stroke();
        g.restore();
      }
    }
  }

  function drawScene(g, S) {
    drawRuscus(g, S);
    for (const st of S.stems) strokeCurve(g, st.pts, 0, stemProgress(st), 9, '#5a9a30');
    for (const lf of S.leaves) drawLeaf(g, lf);
    // closed buds behind, then open flowers in the order they opened
    const sorted = S.buds.slice().sort((a, b) => budState(a).open - budState(b).open || (a.openAt - b.openAt || 0));
    for (const b of sorted) drawBud(g, b);
  }

  // ---------- ascii renderer ----------
  const screen = document.getElementById('screen');
  const sctx = screen.getContext('2d');
  const off = document.createElement('canvas');
  const octx = off.getContext('2d', { willReadFrequently: true });

  let cols = 0, rows = 0, cellW = 0, cellH = 0, fontSize = 0, dpr = 1;

  const styleCache = new Map();
  function style(r, g, b) {
    const key = (r << 16) | (g << 8) | b;
    let s = styleCache.get(key);
    if (!s) { s = `rgb(${r},${g},${b})`; styleCache.set(key, s); }
    return s;
  }

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = window.innerWidth, h = window.innerHeight;
    fontSize = clamp(Math.floor(Math.min(w / 145, h / 112)), 4, 9);
    sctx.font = `600 ${fontSize}px Menlo, Consolas, "DejaVu Sans Mono", monospace`;
    cellW = sctx.measureText('M').width || fontSize * 0.6;
    cellH = fontSize * 1.02;
    screen.width = Math.floor(w * dpr);
    screen.height = Math.floor(h * dpr);
    cols = Math.ceil(w / cellW);
    rows = Math.ceil(h / cellH);
    off.width = cols;
    off.height = rows;
  }

  function render(S) {
    // paint the scene into the low-res buffer, correcting for tall character cells
    const aspect = cellH / cellW;
    const sx = Math.min(cols / WORLD_W, (rows * aspect) / WORLD_H) * 0.96;
    octx.setTransform(1, 0, 0, 1, 0, 0);
    octx.fillStyle = '#000';
    octx.fillRect(0, 0, cols, rows);
    octx.setTransform(sx, 0, 0, sx / aspect, (cols - WORLD_W * sx) / 2, (rows - (WORLD_H * sx) / aspect) / 2);

    drawScene(octx, S);

    const data = octx.getImageData(0, 0, cols, rows).data;
    sctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    sctx.fillStyle = '#000';
    sctx.fillRect(0, 0, screen.width, screen.height);
    // Draw only discrete glyphs. The previous blurred underlay made petal edges muddy.
    sctx.filter = 'none';
    sctx.textBaseline = 'top';
    const n = RAMP.length - 1;
    const flick = Math.floor(T * 8);
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const i = (y * cols + x) * 4;
        const r = data[i], g = data[i + 1], b = data[i + 2];
        const m = Math.max(r, g, b);
        if (m < 24) continue;
        const v = m / 255;
        // a little shimmer so the glyphs feel alive
        const h = ((x * 73856093) ^ (y * 19349663) ^ (flick * 83492791)) >>> 0;
        const j = h % 7 === 0 ? (h & 8 ? 1 : -1) : 0;
        const idx = clamp(Math.round(Math.pow(v, 0.62) * n) + j, 1, n);
        const k = Math.min(1.25, (40 + 215 * v) / m);
        sctx.fillStyle = style(Math.min(255, (r * k) | 0) & 0xf8, Math.min(255, (g * k) | 0) & 0xf8, Math.min(255, (b * k) | 0) & 0xf8);
        sctx.fillText(RAMP[idx], x * cellW, y * cellH);
      }
    }
  }

  // ---------- loop ----------
  const S = buildScene();
  const dedication = document.querySelector('.dedication');
  const beachMessage = document.querySelector('.beach-message');
  const lanternMessage = document.querySelector('.lantern-message');

  function prepareLetterMessage(message, letterClass) {
    const messageText = message.textContent;
    message.setAttribute('aria-label', messageText);
    message.textContent = '';
    Array.from(messageText).forEach((character, index) => {
      const letter = document.createElement('span');
      letter.className = letterClass;
      letter.setAttribute('aria-hidden', 'true');
      letter.style.setProperty('--letter-delay', `${(0.6 + index * 0.075).toFixed(3)}s`);
      letter.textContent = character === ' ' ? '\u00a0' : character;
      message.appendChild(letter);
    });
  }

  prepareLetterMessage(beachMessage, 'beach-letter');
  prepareLetterMessage(lanternMessage, 'lantern-letter');
  let dedicationShown = false;
  let t0 = performance.now();
  let last = 0;

  function frame(now) {
    requestAnimationFrame(frame);
    if (now - last < 1000 / FPS) return;
    last = now;
    T = (now - t0) / 1000;
    if (flowerSceneActive && !bloomSoundPlayed && T >= OPEN_START) {
      bloomSoundPlayed = true;
      playBloomSound();
    }
    if (!dedicationShown && T >= TEXT_REVEAL_AT) {
      dedication.classList.add('is-visible');
      dedicationShown = true;
    }
    if (flowerSceneActive) render(S);
  }

  const replay = () => {
    unlockFlowerAudio();
    t0 = performance.now();
    dedicationShown = false;
    bloomSoundPlayed = false;
    dedication.classList.remove('is-visible');
  };
  const nextButton = document.getElementById('next-animation');
  const previousButton = document.getElementById('previous-animation');
  const soundButton = document.getElementById('sound-toggle');
  const sceneDots = Array.from(document.querySelectorAll('.scene-dot'));
  const fxLayer = document.getElementById('fx-layer');
  const nextNote = document.getElementById('next-note');
  const nextIndicator = document.getElementById('next-indicator');
  const startOverlay = document.getElementById('start-overlay');
  const startExperience = document.getElementById('start-experience');
  const notGwapo = document.getElementById('not-gwapo');
  const introMessage = document.getElementById('intro-message');
  const startCard = startExperience.closest('.start-card');
  let gwapoAttempts = 0;
  let nextNoteTimer = 0;
  let sceneIndex = 0;
  let soundMuted = false;
  let transitionTimer = 0;
  document.body.classList.add('scene-flowers');

  function burstMagic(x, y, kind = 'petal', count = 12) {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const symbols = kind === 'star' ? ['✦', '·', '✧'] : kind === 'heart' ? ['♥', '♡', '✦'] : ['❀', '·', '♡'];
    const colors = kind === 'star' ? ['#fff1a8', '#ffad55', '#fff8dc'] : ['#ff91b5', '#ffd0df', '#fff5f8'];
    for (let i = 0; i < count; i++) {
      const particle = document.createElement('span');
      const angle = (Math.PI * 2 * i) / count + Math.random() * .5;
      const distance = 35 + Math.random() * 100;
      particle.className = 'magic-particle';
      particle.textContent = symbols[i % symbols.length];
      particle.style.setProperty('--x', `${x}px`);
      particle.style.setProperty('--y', `${y}px`);
      particle.style.setProperty('--dx', `${Math.cos(angle) * distance}px`);
      particle.style.setProperty('--dy', `${Math.sin(angle) * distance - 45}px`);
      particle.style.setProperty('--spin', `${-90 + Math.random() * 180}deg`);
      particle.style.setProperty('--size', `${10 + Math.random() * 13}px`);
      particle.style.setProperty('--life', `${1.15 + Math.random() * .9}s`);
      particle.style.setProperty('--c', colors[i % colors.length]);
      fxLayer.appendChild(particle);
      particle.addEventListener('animationend', () => particle.remove(), { once: true });
    }
  }
  window.addEventListener('resize', resize);
  screen.addEventListener('click', replay);

  notGwapo.addEventListener('click', () => {
    gwapoAttempts += 1;
    const scale = 1 + gwapoAttempts * 0.38;
    startExperience.style.setProperty('--yes-scale', scale.toFixed(2));
    notGwapo.textContent = ['sure ka?', 'sure jud?', 'last chance 😭', 'aw sige...'][Math.min(gwapoAttempts - 1, 3)];
    introMessage.textContent = [
      'hmm... think about that answer 👀',
      'the surprise can wait... maybe 👀',
      'one tiny correct answer left 😭',
      'okay, I made this easier for you 😌',
    ][Math.min(gwapoAttempts - 1, 3)];
    if (gwapoAttempts >= 4) {
      startCard.classList.add('is-gwapo-only');
      startExperience.textContent = 'SIGE NA, CLICK ME 😌';
      startExperience.focus();
    }
  });

  function showScene(index) {
    document.body.classList.remove('is-transitioning');
    void document.body.offsetWidth;
    document.body.classList.add('is-transitioning');
    window.clearTimeout(transitionTimer);
    transitionTimer = window.setTimeout(() => document.body.classList.remove('is-transitioning'), 760);
    sceneIndex = (index + 4) % 4;
    const showingBeach = sceneIndex === 1;
    const showingLanterns = sceneIndex === 2;
    const showingLetter = sceneIndex === 3;
    flowerSceneActive = sceneIndex === 0;
    document.body.classList.toggle('scene-flowers', flowerSceneActive);
    document.body.classList.toggle('show-beach', showingBeach);
    document.body.classList.toggle('show-lantern', showingLanterns);
    document.body.classList.toggle('show-letter', showingLetter);
    nextButton.classList.toggle('is-back', showingLetter);

    const buttonLabels = [
      'View beach animation',
      'View floating lantern animation',
      'View special letter',
      'Back to flowers',
    ];
    const notes = [
      'flowers again',
      'a night by the shore',
      'our wish in the sky',
      'a letter for you',
    ];
    nextButton.setAttribute('aria-label', buttonLabels[sceneIndex]);
    nextButton.setAttribute('title', buttonLabels[sceneIndex]);
    nextNote.textContent = notes[sceneIndex];
    nextIndicator.textContent = showingLetter ? 'back to the flowers' : 'click for the next scene';
    sceneDots.forEach((dot, dotIndex) => {
      if (dotIndex === sceneIndex) dot.setAttribute('aria-current', 'step');
      else dot.removeAttribute('aria-current');
    });

    if (showingBeach) window.beachScene?.start();
    else window.beachScene?.stop();
    if (showingLanterns) window.lanternScene?.start();
    else window.lanternScene?.stop();
    if (showingLetter) window.letterScene?.start();
    else window.letterScene?.stop();
    if (sceneIndex === 0) replay();

    nextNote.classList.add('is-visible');
    window.clearTimeout(nextNoteTimer);
    nextNoteTimer = window.setTimeout(() => nextNote.classList.remove('is-visible'), 1800);
  }

  screen.addEventListener('pointerdown', (event) => {
    if (!flowerSceneActive) return;
    burstMagic(event.clientX, event.clientY, 'petal', 14);
  });
  window.addEventListener('wish-released', () => burstMagic(innerWidth / 2, innerHeight * .55, 'star', 24));
  window.addEventListener('letter-opened', () => burstMagic(innerWidth / 2, innerHeight * .5, 'heart', 22));

  nextButton.addEventListener('click', () => {
    showScene(sceneIndex + 1);
  });
  previousButton.addEventListener('click', () => showScene(sceneIndex - 1));
  sceneDots.forEach((dot) => dot.addEventListener('click', () => showScene(Number(dot.dataset.scene))));
  soundButton.addEventListener('click', () => {
    soundMuted = !soundMuted;
    flowerMuted = soundMuted;
    window.beachScene?.setMuted(soundMuted);
    window.lanternScene?.setMuted(soundMuted);
    soundButton.setAttribute('aria-pressed', String(soundMuted));
    soundButton.setAttribute('aria-label', soundMuted ? 'Turn all sound on' : 'Mute all sound');
    soundButton.textContent = soundMuted ? '♪ sound off' : '♪ sound on';
  });
  window.addEventListener('keydown', (e) => {
    if (sceneIndex === 0 && (e.key === ' ' || e.key === 'r')) replay();
    if (sceneIndex > 0 && e.key === 'Escape') showScene(sceneIndex - 1);
    if (e.key === 'ArrowRight') showScene(sceneIndex + 1);
    if (e.key === 'ArrowLeft' && sceneIndex > 0) showScene(sceneIndex - 1);
  });

  startExperience.addEventListener('click', () => {
    unlockFlowerAudio();
    window.beachScene?.unlockAudio();
    window.lanternScene?.unlockAudio();
    document.body.classList.add('experience-started');
    startOverlay.setAttribute('aria-hidden', 'true');
    replay();
    nextButton.focus({ preventScroll: true });
  });

  // ?t=8 starts 8s into the bloom
  const q = new URLSearchParams(location.search);
  if (q.has('t')) t0 = performance.now() - +q.get('t') * 1000;

  resize();
  requestAnimationFrame(frame);
})();
