/** Small beginner-source scanner; deliberately skips templates and regex syntax. */
function scan(source) {
  const tokens = [];
  let comment = false;
  for (let i = 0; i < source.length;) {
    const rest = source.slice(i);
    const whitespace = rest.match(/^\s+/);
    if (whitespace) { i += whitespace[0].length; continue; }
    if (rest.startsWith('//')) {
      comment = true;
      const end = source.indexOf('\n', i);
      i = end < 0 ? source.length : end;
      continue;
    }
    if (rest.startsWith('/*')) {
      const end = source.indexOf('*/', i + 2);
      if (end < 0) return { tokens: [], comment };
      i = end + 2;
      continue;
    }
    const string = rest.match(/^(?:"(?:\\[^]|[^"\\\r\n])*"|'(?:\\[^]|[^'\\\r\n])*')/);
    if (string) { tokens.push({ type: 'string', text: string[0] }); i += string[0].length; continue; }
    // Avoid mistaking slashes inside unsupported literals for comments.
    if (/['"`/]/.test(source[i])) return { tokens: [], comment };
    const token = rest.match(/^(?:[A-Za-z_$][\w$]*|(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?|[^\s])/i)[0];
    tokens.push({ type: /^\d|^\.\d/.test(token) ? 'number' : 'token', text: token });
    i += token.length;
  }
  return { tokens, comment };
}

/** Only straight-line literal declarations and print(variable) are inferred.
 * Runtime observation must also confirm that print actually succeeded.
 * More complex expressions/scopes are intentionally not guessed.
 */
function printsVariable(tokens, type) {
  const variables = new Map();
  let found = false;
  for (let i = 0; i < tokens.length;) {
    const text = offset => tokens[i + offset]?.text;
    if (text(0) === ';') { i++; continue; }
    if (['let', 'const', 'var'].includes(text(0))) {
      if (!/^[A-Za-z_$][\w$]*$/.test(text(1) || '') || text(2) !== '=') return false;
      const name = text(1);
      i += 3;
      if (['-', '+'].includes(tokens[i]?.text)) i++;
      const value = tokens[i++];
      if (!['number', 'string'].includes(value?.type)) return false;
      variables.set(name, value.type);
    } else if (text(0) === 'print' && text(1) === '(' && text(3) === ')') {
      if (variables.get(text(2)) === type) found = true;
      i += 4;
    } else return false;
  }
  return found;
}

export function createChallengeValidator(challenge, source, { isCurrent, onComplete }) {
  const parsed = scan(source);
  const kind = challenge.validation;
  const variable = ['number', 'string'].includes(kind) && printsVariable(parsed.tokens, kind);
  let complete = false;
  const satisfy = () => {
    if (complete || !isCurrent()) return;
    complete = true;
    onComplete();
  };
  return {
    get complete() { return complete; },
    observe(name, value) {
      if (kind === name) satisfy();
      else if (name === 'print' && variable && typeof value === kind
        && (kind !== 'number' || Number.isFinite(value))) satisfy();
    },
    succeeded() {
      if (kind === 'comment' && parsed.comment) satisfy();
    },
  };
}
