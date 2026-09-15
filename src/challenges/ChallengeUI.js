const FIRST_CHALLENGE = Object.freeze({
  title: 'Challenge 1 — Your First Message',
  objective: 'Use the print() function to display something on the screen.',
  example: 'print("This is my game!");',
  help: 'print() displays a message in the output area.\n\nPut the message you want to show inside quotes and parentheses.',
  helpExample: 'print("Hello!");\nprint("I made my first game!");',
});

export function mountChallengeUI({ viewport, editor, runCode }) {
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
  overlay.querySelector('h2').textContent = FIRST_CHALLENGE.title;
  overlay.querySelector('#challenge-briefing-objective').textContent = FIRST_CHALLENGE.objective;
  overlay.querySelector('code').textContent = FIRST_CHALLENGE.example;
  const helpSection = overlay.querySelector('#challenge-briefing-help');
  helpSection.querySelector('p').textContent = FIRST_CHALLENGE.help;
  helpSection.querySelector('code').textContent = FIRST_CHALLENGE.helpExample;
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
    editor.setCode(FIRST_CHALLENGE.example);
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

  return {
    // The current catalog contains only Challenge 1. Keep navigation ownership here.
    hasNextChallenge() { return false; },
    nextChallenge() { return false; },
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
}
