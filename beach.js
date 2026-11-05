(() => {
  'use strict';

  const canvas = document.getElementById('beach-screen');
  const ctx = canvas.getContext('2d');
  const couple = new Image();
  // Keep the requested skirt update while restoring the original beach scene.
  couple.src = 'assets/seated-couple-v4-ponytail.png';
  const BEACH_MUSIC_START = 12;
  const beachTracks = [
    { audio: new Audio('assets/sea-waves.mp3'), volume: 0.48, startAt: 0 },
    { audio: new Audio('assets/lany-soft.mp3'), volume: 0.32, startAt: BEACH_MUSIC_START },
  ];
  const beachMusic = beachTracks[1].audio;
  beachTracks.forEach(({ audio, startAt }) => {
    audio.preload = 'auto';
    audio.loop = startAt === 0;
    audio.volume = 0;
  });
  beachMusic.addEventListener('ended', () => {
    if (!active) return;
    try { beachMusic.currentTime = BEACH_MUSIC_START; } catch (_) {}
    beachMusic.play().catch(() => {});
  });

  let width = 0;
  let height = 0;
  let dpr = 1;
  let active = false;
  let frameId = 0;
  let startedAt = 0;
  let stars = [];
  let beachAudioFadeId = 0;
  let ripples = [];
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  function random(seed) {
    return () => {
      seed = Math.imul(48271, seed) | 0;
      return ((seed >>> 0) % 2147483647) / 2147483647;
    };
  }

  function fadeBeachTracks(scale, duration, onComplete) {
    cancelAnimationFrame(beachAudioFadeId);
    const starts = beachTracks.map(({ audio }) => audio.volume);
    const started = performance.now();
    const tick = (now) => {
      const progress = Math.min(1, (now - started) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      beachTracks.forEach((track, index) => {
        track.audio.volume = starts[index] + (track.volume * scale - starts[index]) * eased;
      });
      if (progress < 1) beachAudioFadeId = requestAnimationFrame(tick);
      else {
        beachAudioFadeId = 0;
        onComplete?.();
      }
    };
    beachAudioFadeId = requestAnimationFrame(tick);
  }

  function startOceanSound() {
    cancelAnimationFrame(beachAudioFadeId);
    beachAudioFadeId = 0;
    beachTracks.forEach(({ audio, startAt }) => {
      if (audio.paused) {
        try { audio.currentTime = startAt; } catch (_) {}
        audio.volume = 0;
      }
    });
    const playback = beachTracks.map(({ audio }) => audio.play().catch(() => {}));
    Promise.all(playback).then(() => {
      if (active) fadeBeachTracks(1, 1200);
    });
  }

  function stopOceanSound() {
    fadeBeachTracks(0, 750, () => {
      if (active) return;
      beachTracks.forEach(({ audio, startAt }) => {
        audio.pause();
        try { audio.currentTime = startAt; } catch (_) {}
      });
    });
  }

  function unlockBeachAudio() {
    beachTracks.forEach(({ audio, startAt }) => {
      audio.volume = 0;
      const playback = audio.play();
      if (playback && typeof playback.then === 'function') {
        playback.then(() => {
          if (active) return;
          audio.pause();
          try { audio.currentTime = startAt; } catch (_) {}
        }).catch(() => {});
      }
    });
  }

  function setMuted(muted) {
    beachTracks.forEach(({ audio }) => { audio.muted = muted; });
  }

  function makeStars() {
    const r = random(20261031);
    const count = Math.max(90, Math.floor(width / 8));
    stars = Array.from({ length: count }, () => ({
      x: r(),
      y: r() * 0.47,
      radius: 0.45 + r() * 1.45,
      phase: r() * Math.PI * 2,
      speed: 0.45 + r() * 1.4,
      warm: r() > 0.78,
    }));
  }

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    makeStars();
    if (!active) draw(0);
  }

  function drawSky(t, horizon) {
    const sky = ctx.createLinearGradient(0, 0, 0, horizon);
    sky.addColorStop(0, '#01040f');
    sky.addColorStop(0.55, '#07142e');
    sky.addColorStop(1, '#123354');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, width, horizon + 2);

    const haze = ctx.createRadialGradient(width * 0.72, horizon * 0.46, 0,
      width * 0.72, horizon * 0.46, Math.max(width, height) * 0.48);
    haze.addColorStop(0, 'rgba(65,104,174,.18)');
    haze.addColorStop(1, 'rgba(4,10,28,0)');
    ctx.fillStyle = haze;
    ctx.fillRect(0, 0, width, horizon);

    for (const star of stars) {
      const twinkle = reducedMotion.matches ? 0.72 : 0.48 + 0.42 * Math.sin(t * star.speed + star.phase);
      ctx.globalAlpha = Math.max(0.16, twinkle);
      ctx.fillStyle = star.warm ? '#ffe8b8' : '#dcecff';
      ctx.beginPath();
      ctx.arc(star.x * width, star.y * height, star.radius, 0, Math.PI * 2);
      ctx.fill();
      if (star.radius > 1.35) {
        ctx.strokeStyle = ctx.fillStyle;
        ctx.lineWidth = 0.65;
        ctx.beginPath();
        ctx.moveTo(star.x * width - 3.5, star.y * height);
        ctx.lineTo(star.x * width + 3.5, star.y * height);
        ctx.moveTo(star.x * width, star.y * height - 3.5);
        ctx.lineTo(star.x * width, star.y * height + 3.5);
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;

    if (!reducedMotion.matches) {
      const cycle = t % 11;
      if (cycle > 1.2 && cycle < 2.2) {
        const progress = cycle - 1.2;
        const sx = width * (.08 + progress * .42);
        const sy = height * (.16 + progress * .12);
        const trail = ctx.createLinearGradient(sx - 90, sy - 35, sx, sy);
        trail.addColorStop(0, 'rgba(190,220,255,0)');
        trail.addColorStop(1, 'rgba(255,250,220,.92)');
        ctx.strokeStyle = trail;
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(sx - 90, sy - 35); ctx.lineTo(sx, sy); ctx.stroke();
        ctx.fillStyle = '#fffde8';
        ctx.beginPath(); ctx.arc(sx, sy, 2.2, 0, Math.PI * 2); ctx.fill();
      }
    }

    const moonX = width * 0.76;
    const moonY = height * 0.18;
    const moonR = Math.max(28, Math.min(width, height) * 0.052);
    const glow = ctx.createRadialGradient(moonX, moonY, moonR * 0.45,
      moonX, moonY, moonR * 3.7);
    glow.addColorStop(0, 'rgba(255,247,205,.48)');
    glow.addColorStop(0.35, 'rgba(178,211,255,.16)');
    glow.addColorStop(1, 'rgba(100,156,255,0)');
    ctx.fillStyle = glow;
    ctx.beginPath(); ctx.arc(moonX, moonY, moonR * 3.7, 0, Math.PI * 2); ctx.fill();

    const moon = ctx.createRadialGradient(moonX - moonR * 0.28, moonY - moonR * 0.3, moonR * 0.08,
      moonX, moonY, moonR);
    moon.addColorStop(0, '#fffdf0');
    moon.addColorStop(0.72, '#f6edc5');
    moon.addColorStop(1, '#b9cbea');
    ctx.fillStyle = moon;
    ctx.shadowColor = 'rgba(203,226,255,.75)';
    ctx.shadowBlur = 20;
    ctx.beginPath(); ctx.arc(moonX, moonY, moonR, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;

    ctx.globalAlpha = 0.12;
    ctx.fillStyle = '#6f7f95';
    ctx.beginPath(); ctx.arc(moonX + moonR * 0.25, moonY - moonR * 0.22, moonR * 0.15, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(moonX - moonR * 0.28, moonY + moonR * 0.18, moonR * 0.1, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;

    return moonX;
  }

  function waveY(x, base, amplitude, frequency, phase) {
    return base + Math.sin(x * frequency + phase) * amplitude
      + Math.sin(x * frequency * 0.43 - phase * 0.7) * amplitude * 0.34;
  }

  function drawOcean(t, horizon, moonX) {
    const shore = height * 0.76;
    const ocean = ctx.createLinearGradient(0, horizon, 0, shore + 30);
    ocean.addColorStop(0, '#0a2747');
    ocean.addColorStop(0.48, '#0b3e61');
    ocean.addColorStop(1, '#17647a');
    ctx.fillStyle = ocean;
    ctx.fillRect(0, horizon, width, shore - horizon + 34);

    const sand = ctx.createLinearGradient(0, shore - 8, 0, height);
    sand.addColorStop(0, '#4c5660');
    sand.addColorStop(0.16, '#6c6764');
    sand.addColorStop(1, '#282a36');
    ctx.fillStyle = sand;
    ctx.fillRect(0, shore - 8, width, height - shore + 8);

    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    for (let i = 0; i < 34; i++) {
      const p = i / 33;
      const y = horizon + 6 + p * (shore - horizon - 18);
      const spread = 8 + p * width * 0.095;
      const drift = reducedMotion.matches ? 0 : Math.sin(t * 1.8 + i * 1.7) * (2 + p * 8);
      const segment = spread * (0.35 + 0.52 * Math.abs(Math.sin(i * 2.18 + t * 1.15)));
      ctx.strokeStyle = `rgba(206,229,255,${0.08 + (1 - p) * 0.2})`;
      ctx.lineWidth = 1 + p * 2.2;
      ctx.beginPath();
      ctx.moveTo(moonX - segment + drift, y);
      ctx.lineTo(moonX + segment + drift, y);
      ctx.stroke();
    }
    ctx.restore();

    for (let layer = 0; layer < 8; layer++) {
      const p = layer / 7;
      const base = horizon + 20 + p * (shore - horizon - 16);
      const amplitude = 2 + p * 7;
      const frequency = 0.008 + p * 0.007;
      const phase = reducedMotion.matches ? layer : t * (0.75 + p * 0.9) + layer * 1.4;
      ctx.strokeStyle = `rgba(${120 + layer * 8},${180 + layer * 6},${210 + layer * 5},${0.12 + p * 0.34})`;
      ctx.lineWidth = 1 + p * 2.4;
      ctx.beginPath();
      for (let x = -12; x <= width + 12; x += 7) {
        const y = waveY(x, base, amplitude, frequency, phase);
        x === -12 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    const foamBase = shore + (reducedMotion.matches ? 0 : Math.sin(t * 1.35) * 8);
    ctx.strokeStyle = 'rgba(210,238,244,.78)';
    ctx.lineWidth = 3.2;
    ctx.shadowColor = 'rgba(137,213,231,.55)';
    ctx.shadowBlur = 8;
    ctx.beginPath();
    for (let x = -10; x <= width + 10; x += 6) {
      const y = waveY(x, foamBase, 6, 0.013, reducedMotion.matches ? 0 : t * 1.6);
      x === -10 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.shadowBlur = 0;

    const wet = ctx.createLinearGradient(0, shore, 0, height * 0.9);
    wet.addColorStop(0, 'rgba(92,139,150,.22)');
    wet.addColorStop(1, 'rgba(19,23,34,0)');
    ctx.fillStyle = wet;
    ctx.fillRect(0, shore, width, height * 0.16);

    ripples = ripples.filter((ripple) => t - ripple.started < 1.7);
    ripples.forEach((ripple) => {
      const age = t - ripple.started;
      ctx.strokeStyle = `rgba(204,239,255,${.55 * (1 - age / 1.7)})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.ellipse(ripple.x, ripple.y, 16 + age * 65, 4 + age * 15, 0, 0, Math.PI * 2);
      ctx.stroke();
    });
  }

  function drawCouple(t) {
    if (!couple.complete || !couple.naturalWidth) return;
    const maxWidth = width < 700 ? width * 0.55 : width * 0.36;
    const maxHeight = height * 0.34;
    const scale = Math.min(maxWidth / couple.naturalWidth, maxHeight / couple.naturalHeight);
    const drawWidth = couple.naturalWidth * scale;
    const drawHeight = couple.naturalHeight * scale;
    const breathe = reducedMotion.matches ? 0 : Math.sin(t * 0.72) * 1.2;
    const x = (width - drawWidth) / 2;
    const y = height * 0.94 - drawHeight + breathe;

    ctx.fillStyle = 'rgba(2,5,13,.38)';
    ctx.beginPath();
    ctx.ellipse(width / 2, y + drawHeight * 0.91, drawWidth * 0.39, drawHeight * 0.055, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(couple, x, y, drawWidth, drawHeight);
  }

  function draw(now) {
    if (active) frameId = requestAnimationFrame(draw);
    const t = active ? (now - startedAt) / 1000 : 0;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    const horizon = height * 0.52;
    const moonX = drawSky(t, horizon);
    drawOcean(t, horizon, moonX);
    drawCouple(t);
  }

  function start() {
    if (active) return;
    active = true;
    startedAt = performance.now();
    frameId = requestAnimationFrame(draw);
    startOceanSound();
  }

  function stop() {
    active = false;
    cancelAnimationFrame(frameId);
    stopOceanSound();
  }

  couple.addEventListener('load', () => { if (!active) draw(0); });
  canvas.addEventListener('pointerdown', (event) => {
    if (!active || event.clientY < height * .52) return;
    ripples.push({ x: event.clientX, y: event.clientY, started: (performance.now() - startedAt) / 1000 });
  });
  // Some browsers require a second explicit interaction before audio can run.
  window.addEventListener('pointerdown', () => { if (active) startOceanSound(); }, { passive: true });
  window.addEventListener('keydown', () => { if (active) startOceanSound(); });
  window.addEventListener('resize', resize);
  resize();

  window.beachScene = { start, stop, unlockAudio: unlockBeachAudio, setMuted };
})();
