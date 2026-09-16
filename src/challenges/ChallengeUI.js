import { CHALLENGES } from './challengeCatalog.js';

export function mountChallengeUI({ viewport, editor, runCode, onAdvance }) {
  let index = 0;
  const current = () => CHALLENGES[index];
  const completion = document.createElement('div');
  completion.className = 'challenge-completion hidden';
  completion.setAttribute('role', 'status');
  completion.textContent = '✓ Challenge Complete!';
  viewport.appendChild(completion);
  const overlay = document.createElement('div');
  overlay.className = 'challenge-briefing hidden';
  overlay.innerHTML = `
    <section class="challenge-briefing-card" role="dialog"
      aria-labelledby="challenge-briefing-title" aria-describedby="challenge-briefing-objective">
      <h2 id="challenge-briefing-title"></h2>
      <p id="challenge-briefing-objective"></p>
      <p class="challenge-example-label">Example:</p>
      <pre><code></code></pre>
      <button type="button" class="tb-btn challenge-info-toggle" data-action="info"
        aria-expanded="false" aria-controls="challenge-briefing-help">More Info</button>
      <div id="challenge-briefing-help" class="challenge-briefing-help hidden">
        <p></p>
        <p class="challenge-example-label">Example:</p>
        <pre><code></code></pre>
      </div>
      <div class="challenge-briefing-buttons">
        <button type="button" class="tb-btn" data-action="answer">Use Answer</button>
        <button type="button" class="tb-btn run" data-action="play">▶ Play Game</button>
        <button type="button" class="tb-btn" data-action="close">Close</button>
      </div>
    </section>`;
  const helpSection = overlay.querySelector('#challenge-briefing-help');
  const infoButton = overlay.querySelector('[data-action="info"]');
  function setHelpExpanded(expanded) {
    helpSection.classList.toggle('hidden', !expanded);
    infoButton.setAttribute('aria-expanded', String(expanded));
    infoButton.textContent = expanded ? 'Less Info' : 'More Info';
  }
  infoButton.addEventListener('click', () => {
    setHelpExpanded(helpSection.classList.contains('hidden'));
  });
  viewport.appendChild(overlay);

  const playButton = overlay.querySelector('[data-action="play"]');
  let previousFocus = null;

  function close() {
    if (overlay.classList.contains('hidden')) return;
    overlay.classList.add('hidden');
    if (overlay.contains(document.activeElement)) previousFocus?.focus();
  }

  overlay.querySelector('[data-action="answer"]').addEventListener('click', () => {
    if (editor.getCode().length > 0 && !window.confirm('Replace your current code with the challenge answer?')) return;
    editor.setCode(current().example);
  });
  playButton.addEventListener('click', () => {
    close();
    runCode();
  });
  overlay.querySelector('[data-action="close"]').addEventListener('click', close);
  overlay.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.stopPropagation();
      close();
    }
  });

  function render() {
    const challenge = current();
    overlay.querySelector('h2').textContent = challenge.title;
    overlay.querySelector('#challenge-briefing-objective').textContent = challenge.objective;
    overlay.querySelector('code').textContent = challenge.example;
    helpSection.querySelector('p').textContent = challenge.help;
    helpSection.querySelector('code').textContent = challenge.helpExample;
    setHelpExpanded(false);
  }
  render();

  const ui = {
    get currentChallenge() { return current(); },
    hasNextChallenge() { return index + 1 < CHALLENGES.length; },
    async nextChallenge() {
      if (!ui.hasNextChallenge()) return false;
      index++;
      close();
      render();
      ui.setComplete(false);
      editor.setCode('');
      await onAdvance();
      ui.show();
      return true;
    },
    setComplete(complete, finished = false) {
      completion.textContent = complete ? '✅ Challenge Complete' : '❌ Challenge Incomplete';
      completion.classList.toggle('incomplete', !complete);
      completion.classList.toggle('hidden', !complete && !finished);
    },
    show() {
      if (!overlay.classList.contains('hidden')) return;
      previousFocus = document.activeElement;
      setHelpExpanded(false);
      overlay.classList.remove('hidden');
      playButton.focus();
    },
    close,
  };
  return ui;
}
