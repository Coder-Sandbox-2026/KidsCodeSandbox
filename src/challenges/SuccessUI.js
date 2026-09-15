import collectUrl from '../assets/audio/collect_star.ogg?url';
import successUrl from '../assets/audio/success.ogg?url';
import { createSuccessSequence } from './SuccessSequence.js';

export function mountSuccessUI({ stop, reset, challengeUI, isChallenge }) {
  const sounds = { collect: new Audio(collectUrl), success: new Audio(successUrl) };
  const dialog = document.createElement('dialog');
  dialog.className = 'challenge-briefing-card success-dialog';
  dialog.setAttribute('aria-labelledby', 'success-title');
  dialog.setAttribute('aria-describedby', 'success-message');
  dialog.innerHTML = `
    <h2 id="success-title">Success!</h2>
    <p id="success-message">You collected the Gold Star. Well done!</p>
    <div class="challenge-briefing-buttons">
      <button type="button" class="tb-btn run" data-action="done" autofocus>Done</button>
      <button type="button" class="tb-btn" data-action="next">Next Challenge</button>
    </div>`;
  document.body.appendChild(dialog);
  const next = dialog.querySelector('[data-action="next"]');
  let previousFocus = null;
  let flashOverlay = null;
  const sequence = createSuccessSequence({
    play(name) {
      const sound = sounds[name];
      sound.currentTime = 0;
      // Missing audio/autoplay permission must not interrupt completion.
      sound.play()?.catch(() => {});
    },
    async flash(signal) {
      const overlay = document.createElement('div');
      overlay.className = 'success-flash';
      overlay.setAttribute('aria-hidden', 'true');
      (document.fullscreenElement || document.body).appendChild(overlay);
      flashOverlay = overlay;
      const animation = overlay.animate([
        { opacity: 0, offset: 0 },
        { opacity: 1, offset: 0.4 },
        { opacity: 1, offset: 0.55 },
        { opacity: 0, offset: 1 },
      ], { duration: 800, easing: 'ease-in-out' });
      const abort = () => animation.cancel();
      signal.addEventListener('abort', abort, { once: true });
      try { await animation.finished; }
      finally {
        signal.removeEventListener('abort', abort);
        overlay.remove();
        if (flashOverlay === overlay) flashOverlay = null;
      }
    },
    stop,
    show() {
      challengeUI.close();
      if (isChallenge()) challengeUI.setComplete(true);
      next.hidden = !isChallenge();
      next.disabled = !challengeUI.hasNextChallenge();
      previousFocus = document.activeElement;
      dialog.showModal();
    },
    clear() {
      flashOverlay?.remove();
      flashOverlay = null;
      for (const sound of Object.values(sounds)) {
        sound.pause();
        sound.currentTime = 0;
      }
      if (dialog.open) {
        dialog.close();
        previousFocus?.focus();
      }
    },
  });
  dialog.addEventListener('cancel', event => event.preventDefault());
  dialog.querySelector('[data-action="done"]').addEventListener('click', reset);
  next.addEventListener('click', () => {
    if (!isChallenge() || !challengeUI.hasNextChallenge()) return;
    sequence.cancel();
    challengeUI.nextChallenge();
  });
  return sequence;
}
