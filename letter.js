(() => {
  'use strict';

  const scene = document.getElementById('letter-scene');
  const stage = document.getElementById('envelope-stage');
  const envelope = document.getElementById('envelope');
  const letter = document.getElementById('love-letter');

  function openLetter() {
    stage.classList.add('is-open');
    envelope.setAttribute('aria-expanded', 'true');
    envelope.setAttribute('aria-label', 'Letter opened');
    window.setTimeout(() => letter.setAttribute('tabindex', '0'), 900);
    window.dispatchEvent(new CustomEvent('letter-opened'));
  }

  function resetLetter() {
    stage.classList.remove('is-open');
    envelope.setAttribute('aria-expanded', 'false');
    envelope.setAttribute('aria-label', 'Open the envelope');
    letter.removeAttribute('tabindex');
    letter.scrollTop = 0;
  }

  envelope.addEventListener('click', () => {
    if (!stage.classList.contains('is-open')) openLetter();
  });

  window.letterScene = {
    start() { scene.setAttribute('aria-hidden', 'false'); },
    stop() { scene.setAttribute('aria-hidden', 'true'); resetLetter(); },
    reset: resetLetter,
  };
})();
