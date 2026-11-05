(() => {
  'use strict';

  const canvas = document.getElementById('lantern-screen');
  const ctx = canvas.getContext('2d');
  const couple = new Image();
  const releaseLantern = new Image();
  couple.src = 'assets/lantern-couple-release-pose.png';
  releaseLantern.src = 'assets/release-lantern.png';
  const lanternMusic = new Audio('assets/i-see-the-light-piano-strings.mp3');
  const wishComposer = document.getElementById('wish-composer');
  const wishForm = document.getElementById('wish-form');
  const wishInput = document.getElementById('wish-input');
  const wishCounter = document.getElementById('wish-counter');
  const cancelWish = document.getElementById('cancel-wish');
  const lanternHint = document.querySelector('.lantern-hint');
  const lanternMessage = document.querySelector('.lantern-message');
  lanternMusic.preload = 'auto';
  lanternMusic.loop = true;
  lanternMusic.volume = 0;

  let width = 0;
  let height = 0;
  let dpr = 1;
  let active = false;
  let frameId = 0;
  let startedAt = 0;
  let lanterns = [];
  let stars = [];
  let musicFadeId = 0;
  let wishReleased = false;
  let wishReleasedAt = 0;
  let writtenWish = '';
  let lanternHitBox = null;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  function random(seed) {
    return () => {
      seed = Math.imul(48271, seed) | 0;
      return ((seed >>> 0) % 2147483647) / 2147483647;
    };
  }

  function fadeMusicTo(targetVolume, duration, onComplete) {
    cancelAnimationFrame(musicFadeId);
    const fromVolume = lanternMusic.volume;
    const started = performance.now();
    const tick = (now) => {
      const progress = Math.min(1, (now - started) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      lanternMusic.volume = fromVolume + (targetVolume - fromVolume) * eased;
      if (progress < 1) musicFadeId = requestAnimationFrame(tick);
      else {
        musicFadeId = 0;
        onComplete?.();
      }
    };
    musicFadeId = requestAnimationFrame(tick);
  }

  function startLanternMusic() {
    cancelAnimationFrame(musicFadeId);
    musicFadeId = 0;
    if (lanternMusic.paused) {
      try { lanternMusic.currentTime = 0; } catch (_) {}
      lanternMusic.volume = 0;
    }
    const playback = lanternMusic.play();
    if (playback && typeof playback.then === 'function') {
      playback.then(() => {
        if (active) fadeMusicTo(0.42, 1200);
      }).catch(() => {});
    } else if (active) fadeMusicTo(0.42, 1200);
  }

  function stopLanternMusic() {
    fadeMusicTo(0, 700, () => {
      if (active) return;
      lanternMusic.pause();
      try { lanternMusic.currentTime = 0; } catch (_) {}
    });
  }

  function unlockLanternMusic() {
    lanternMusic.volume = 0;
    const playback = lanternMusic.play();
    if (playback && typeof playback.then === 'function') {
      playback.then(() => {
        if (active) return;
        lanternMusic.pause();
        try { lanternMusic.currentTime = 0; } catch (_) {}
      }).catch(() => {});
    }
  }

  function setMuted(muted) {
    lanternMusic.muted = muted;
  }

  function openWishComposer() {
    if (wishReleased) return;
    document.body.classList.add('wish-started');
    wishComposer.classList.add('is-open');
    wishComposer.setAttribute('aria-hidden', 'false');
    window.setTimeout(() => wishInput.focus(), 120);
  }

  function closeWishComposer() {
    wishComposer.classList.remove('is-open');
    wishComposer.setAttribute('aria-hidden', 'true');
    canvas.focus?.();
    if (!wishReleased) document.body.classList.remove('wish-started');
  }

  function releaseWish() {
    writtenWish = wishInput.value.trim();
    if (!writtenWish || wishReleased) return;
    wishReleased = true;
    wishReleasedAt = (performance.now() - startedAt) / 1000;
    try { localStorage.setItem('lai-lantern-wish', writtenWish); } catch (_) {}
    closeWishComposer();
    const message = document.querySelector('.lantern-message');
    message.setAttribute('aria-label', 'your wish is on its way');
    message.textContent = 'your wish is on its way ✦';
    window.dispatchEvent(new CustomEvent('wish-released'));
  }

  function rebuild() {
    const r = random(14022027);
    const lanternCount = Math.max(34, Math.min(60, Math.floor(width / 20)));
    lanterns = Array.from({ length: lanternCount }, () => {
      const depth = 0.25 + r() * 0.75;
      return {
        x: 0.03 + r() * 0.94,
        offset: r(),
        speed: 0.018 + depth * 0.032,
        size: 7 + depth * 17,
        phase: r() * Math.PI * 2,
        sway: 0.004 + r() * 0.012,
        warm: r() > 0.18,
        depth,
      };
    });
    stars = Array.from({ length: Math.max(100, Math.floor(width / 8)) }, () => ({
      x: r(),
      y: 0.025 + r() * 0.65,
      size: r() > 0.86 ? 2 : 1,
      phase: r() * Math.PI * 2,
      cross: r() > 0.91,
      warm: r() > 0.78,
    }));
  }

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    rebuild();
    if (!active) draw(0);
  }

  function drawBackdrop(t) {
    const sky = ctx.createLinearGradient(0, 0, 0, height);
    sky.addColorStop(0, '#070814');
    sky.addColorStop(0.48, '#17132b');
    sky.addColorStop(0.78, '#342039');
    sky.addColorStop(1, '#160e17');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, width, height);

    const amberHaze = ctx.createRadialGradient(width * 0.5, height * 0.72, 0,
      width * 0.5, height * 0.72, Math.max(width, height) * 0.68);
    amberHaze.addColorStop(0, 'rgba(227,112,44,.18)');
    amberHaze.addColorStop(0.48, 'rgba(111,48,57,.07)');
    amberHaze.addColorStop(1, 'rgba(8,7,18,0)');
    ctx.fillStyle = amberHaze;
    ctx.fillRect(0, 0, width, height);

    for (const star of stars) {
      const twinkle = reducedMotion.matches ? 0.75 : 0.38 + 0.62 * Math.abs(Math.sin(t * 1.15 + star.phase));
      ctx.globalAlpha = twinkle;
      ctx.fillStyle = star.warm ? '#ffe3a3' : '#e6edff';
      const x = Math.round(star.x * width);
      const y = Math.round(star.y * height);
      ctx.fillRect(x, y, star.size, star.size);
      if (star.cross) {
        const arm = star.size * 3;
        ctx.fillRect(x - arm, y, arm * 2 + star.size, star.size);
        ctx.fillRect(x, y - arm, star.size, arm * 2 + star.size);
      }
    }
    ctx.globalAlpha = 1;

    const groundY = height * 0.93;
    ctx.fillStyle = '#09070c';
    ctx.beginPath();
    ctx.moveTo(0, height);
    ctx.lineTo(0, groundY);
    for (let x = 0; x <= width; x += 36) {
      ctx.lineTo(x, groundY - 3 - Math.sin(x * 0.018) * 6);
    }
    ctx.lineTo(width, height);
    ctx.closePath();
    ctx.fill();
  }

  function lanternPosition(item, t) {
    const releaseBoost = wishReleased ? 1.45 : 0.72;
    const progress = reducedMotion.matches ? item.offset : (item.offset + t * item.speed * releaseBoost) % 1;
    return {
      x: (item.x + Math.sin(t * 0.42 + item.phase) * item.sway) * width,
      // Keep the released lanterns entirely in the upper sky.
      y: height * (0.54 - progress * 0.62),
    };
  }

  function drawLantern(item, t) {
    const position = lanternPosition(item, t);
    const flicker = reducedMotion.matches ? 1 : 0.88 + Math.sin(t * 5.2 + item.phase) * 0.12;
    const size = item.size;
    const pixel = Math.max(1, Math.round(size / 5));
    const x = Math.round(position.x / pixel) * pixel;
    const y = Math.round(position.y / pixel) * pixel;
    const bodyW = pixel * 4;
    const bodyH = pixel * 6;

    if (y < -bodyH * 2 || y > height + bodyH * 2) return;
    ctx.save();
    ctx.globalAlpha = Math.min(1, 0.44 + item.depth * 0.68);
    const glow = ctx.createRadialGradient(x, y, 0, x, y, size * 4.8);
    glow.addColorStop(0, `rgba(255,188,67,${0.28 * flicker})`);
    glow.addColorStop(0.4, `rgba(255,106,35,${0.1 * flicker})`);
    glow.addColorStop(1, 'rgba(255,95,25,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(x - size * 5, y - size * 5, size * 10, size * 10);

    ctx.translate(x, y);
    ctx.fillStyle = item.warm ? '#ff8b32' : '#ffb04f';
    ctx.fillRect(-bodyW / 2, -bodyH / 2 + pixel, bodyW, bodyH - pixel * 2);
    ctx.fillStyle = '#ffd36b';
    ctx.fillRect(-bodyW / 2 + pixel, -bodyH / 2, bodyW - pixel * 2, pixel);
    ctx.fillRect(-bodyW / 2 + pixel, bodyH / 2 - pixel, bodyW - pixel * 2, pixel);
    ctx.fillStyle = `rgba(255,248,174,${0.75 + flicker * 0.2})`;
    ctx.fillRect(-pixel, -pixel * 2, pixel * 2, pixel * 3);
    ctx.fillStyle = 'rgba(118,46,25,.55)';
    ctx.fillRect(-bodyW / 2, -bodyH / 2 + pixel, pixel, bodyH - pixel * 2);
    ctx.restore();
  }

  function drawCouple(t) {
    if (!couple.complete || !couple.naturalWidth) return;
    const maxWidth = width < 680 ? width * 0.48 : width * 0.27;
    const maxHeight = height * 0.46;
    const scale = Math.min(maxWidth / couple.naturalWidth, maxHeight / couple.naturalHeight);
    const drawWidth = couple.naturalWidth * scale;
    const drawHeight = couple.naturalHeight * scale;
    const breathe = reducedMotion.matches ? 0 : Math.sin(t * 1.05) * 2.4;
    const windSway = reducedMotion.matches ? 0 : Math.sin(t * 0.68) * 0.009;
    const x = -drawWidth / 2;
    const y = -drawHeight * 0.94 + breathe;

    ctx.save();
    // Pivot the pair at their feet so the held lantern gently sways in the air.
    ctx.translate(width / 2, height * 0.965);
    ctx.rotate(windSway);
    ctx.globalCompositeOperation = 'source-over';
    ctx.imageSmoothingEnabled = false;
    ctx.shadowColor = 'rgba(255,151,57,.28)';
    ctx.shadowBlur = 20;
    ctx.drawImage(couple, x, y, drawWidth, drawHeight);

    ctx.globalCompositeOperation = 'screen';
    const lanternX = 0;
    const lanternY = y + drawHeight * 0.29;
    const flicker = reducedMotion.matches ? 1 : 0.8 + Math.sin(t * 7.4) * 0.2;
    const heldGlow = ctx.createRadialGradient(lanternX, lanternY, 0,
      lanternX, lanternY, drawWidth * 0.28);
    heldGlow.addColorStop(0, `rgba(255,238,153,${0.22 * flicker})`);
    heldGlow.addColorStop(0.35, `rgba(255,155,52,${0.13 * flicker})`);
    heldGlow.addColorStop(1, 'rgba(255,109,31,0)');
    ctx.fillStyle = heldGlow;
    ctx.fillRect(lanternX - drawWidth * 0.3, lanternY - drawWidth * 0.3,
      drawWidth * 0.6, drawWidth * 0.6);

    if (!reducedMotion.matches) {
      ctx.lineWidth = Math.max(1, drawWidth * 0.004);
      ctx.lineCap = 'round';
      for (let i = 0; i < 3; i++) {
        const drift = ((t * 0.22 + i / 3) % 1) * drawWidth * 0.34;
        const airY = lanternY - drawHeight * (0.08 + i * 0.035);
        ctx.strokeStyle = `rgba(255,225,174,${0.2 - i * 0.04})`;
        ctx.beginPath();
        ctx.moveTo(-drawWidth * 0.22 + drift, airY);
        ctx.bezierCurveTo(-drawWidth * 0.12 + drift, airY - 5,
          drawWidth * 0.02 + drift, airY + 5,
          drawWidth * 0.11 + drift, airY - 1);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  function drawHeldOrReleasedLantern(t) {
    if (!releaseLantern.complete || !releaseLantern.naturalWidth || !couple.naturalWidth) return;
    const coupleMaxWidth = width < 680 ? width * 0.48 : width * 0.27;
    const coupleMaxHeight = height * 0.46;
    const coupleScale = Math.min(coupleMaxWidth / couple.naturalWidth, coupleMaxHeight / couple.naturalHeight);
    const coupleHeight = couple.naturalHeight * coupleScale;
    const lanternHeight = coupleHeight * 0.38;
    const lanternWidth = releaseLantern.naturalWidth * (lanternHeight / releaseLantern.naturalHeight);
    const heldBottom = height * 0.965 - coupleHeight * 0.59;
    let centerX = width / 2;
    let bottomY = heldBottom;
    let alpha = 1;

    if (wishReleased) {
      const age = Math.max(0, t - wishReleasedAt);
      const progress = Math.min(1, age / 6.2);
      centerX += Math.sin(age * 1.15) * width * .045 * progress;
      bottomY -= progress * height * .78;
      alpha = progress > .82 ? 1 - (progress - .82) / .18 : 1;
    }

    lanternHitBox = wishReleased ? null : {
      left: centerX - lanternWidth / 2,
      right: centerX + lanternWidth / 2,
      top: bottomY - lanternHeight,
      bottom: bottomY,
    };
    if (lanternHitBox) {
      const messageBottom = lanternMessage.getBoundingClientRect().bottom;
      const hintTop = Math.max(messageBottom + 28, lanternHitBox.top - 64);
      lanternHint.style.left = `${centerX}px`;
      lanternHint.style.top = `${Math.max(72, Math.min(hintTop, lanternHitBox.top - 34))}px`;
    }

    const flutter = reducedMotion.matches ? 0 : Math.sin(t * 2.1) * .018;
    ctx.save();
    ctx.globalAlpha = Math.max(0, alpha);
    ctx.translate(centerX, bottomY - lanternHeight / 2);
    ctx.rotate(flutter);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(releaseLantern, -lanternWidth / 2, -lanternHeight / 2, lanternWidth, lanternHeight);
    ctx.restore();
  }

  function draw(now) {
    if (active) frameId = requestAnimationFrame(draw);
    const t = active ? (now - startedAt) / 1000 : 0;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    drawBackdrop(t);
    lanterns.forEach((item) => drawLantern(item, t));
    drawHeldOrReleasedLantern(t);
    drawCouple(t);
  }

  function start() {
    if (active) return;
    active = true;
    startedAt = performance.now();
    frameId = requestAnimationFrame(draw);
  }

  function isOverHeldLantern(event) {
    return lanternHitBox
      && event.clientX >= lanternHitBox.left
      && event.clientX <= lanternHitBox.right
      && event.clientY >= lanternHitBox.top
      && event.clientY <= lanternHitBox.bottom;
  }

  canvas.addEventListener('pointermove', (event) => {
    canvas.style.cursor = active && !wishReleased && isOverHeldLantern(event) ? 'pointer' : 'default';
  });
  canvas.addEventListener('pointerleave', () => { canvas.style.cursor = 'default'; });
  canvas.addEventListener('click', (event) => {
    if (!active || wishReleased) return;
    if (!isOverHeldLantern(event)) return;
    openWishComposer();
  });
  wishInput.addEventListener('input', () => { wishCounter.textContent = `${wishInput.value.length} / 180`; });
  wishForm.addEventListener('submit', (event) => { event.preventDefault(); releaseWish(); });
  cancelWish.addEventListener('click', closeWishComposer);
  wishComposer.addEventListener('click', (event) => { if (event.target === wishComposer) closeWishComposer(); });
  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && wishComposer.classList.contains('is-open')) {
      event.stopImmediatePropagation();
      closeWishComposer();
    }
  }, true);

  function stop() {
    active = false;
    cancelAnimationFrame(frameId);
  }

  couple.addEventListener('load', () => { if (!active) draw(0); });
  releaseLantern.addEventListener('load', () => { if (!active) draw(0); });
  window.addEventListener('resize', resize);
  resize();

  window.lanternScene = { start, stop, unlockAudio: () => {}, setMuted };
})();
