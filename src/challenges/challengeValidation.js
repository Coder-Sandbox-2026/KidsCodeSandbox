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

function matchingToken(tokens, start, open, close) {
  if (tokens[start]?.text !== open) return -1;
  let depth = 0;
  for (let i = start; i < tokens.length; i++) {
    if (tokens[i].text === open) depth++;
    else if (tokens[i].text === close && --depth === 0) return i;
  }
  return -1;
}

function hasElseBranch(tokens, start) {
  if (tokens[start]?.text !== 'else' || start + 1 >= tokens.length) return false;
  if (tokens[start + 1].text !== '{') return true;
  return matchingToken(tokens, start + 1, '{', '}') >= 0;
}

/**
 * Find actual conditional syntax in the already tokenized source. Comments and
 * strings cannot produce an `if` or `else` token here. Runtime syntax and
 * execution errors are handled separately by RunLifecycle before succeeded().
 */
function hasConditional(tokens, requireElse) {
  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i].text !== 'if') continue;
    const closeCondition = matchingToken(tokens, i + 1, '(', ')');
    if (closeCondition < 0) continue;
    const bodyStart = closeCondition + 1;
    if (bodyStart >= tokens.length) continue;

    // A braced body gives us an unambiguous boundary for an associated else.
    if (tokens[bodyStart].text === '{') {
      const bodyEnd = matchingToken(tokens, bodyStart, '{', '}');
      if (bodyEnd < 0) continue;
      if (!requireElse || hasElseBranch(tokens, bodyEnd + 1)) return true;
      continue;
    }

    // Also recognize the valid single-statement form: if (condition) action();
    // The runtime success check rejects malformed or incomplete statements.
    if (!requireElse) return true;
    let statementEnd = bodyStart;
    while (statementEnd < tokens.length && tokens[statementEnd].text !== ';') statementEnd++;
    if (tokens[statementEnd]?.text === ';' && hasElseBranch(tokens, statementEnd + 1)) return true;
  }
  return false;
}

function hasForStatement(tokens) {
  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i].text !== 'for') continue;
    const closeCondition = matchingToken(tokens, i + 1, '(', ')');
    if (closeCondition < 0 || closeCondition + 1 >= tokens.length) continue;
    if (tokens[closeCondition + 1].text === '{') {
      if (matchingToken(tokens, closeCondition + 1, '{', '}') >= 0) return true;
    } else {
      return true;
    }
  }
  return false;
}

function hasCalledFunctionDeclaration(tokens) {
  const declarations = [];
  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i].text !== 'function' || !/^[A-Za-z_$][\w$]*$/.test(tokens[i + 1]?.text || '')) continue;
    const nameIndex = i + 1;
    const closeParams = matchingToken(tokens, nameIndex + 1, '(', ')');
    const bodyStart = closeParams + 1;
    const bodyEnd = matchingToken(tokens, bodyStart, '{', '}');
    if (closeParams >= 0 && bodyEnd >= 0) declarations.push({ name: tokens[nameIndex].text, nameIndex, bodyStart, bodyEnd });
  }
  return declarations.some(({ name, nameIndex, bodyStart, bodyEnd }) => tokens.some((token, index) => (
    token.text === name && tokens[index + 1]?.text === '('
      && index !== nameIndex && (index < bodyStart || index > bodyEnd)
  )));
}

export function createChallengeValidator(challenge, source, { isCurrent, onComplete }) {
  const parsed = scan(source);
  const kind = challenge.validation;
  const variable = ['number', 'string'].includes(kind) && printsVariable(parsed.tokens, kind);
  const conditional = kind === 'heightIf'
    ? hasConditional(parsed.tokens, false)
    : kind === 'temperatureIfElse'
      ? hasConditional(parsed.tokens, true)
      : false;
  const syntax = conditional
    || (kind === 'for' && hasForStatement(parsed.tokens))
    || (kind === 'functionCall' && hasCalledFunctionDeclaration(parsed.tokens));
  let complete = false;
  let observed = false;
  let executedSuccessfully = false;
  const satisfy = () => {
    if (complete || !executedSuccessfully || !isCurrent()) return;
    complete = true;
    onComplete();
  };
  return {
    get complete() { return complete; },
    observe(name, value) {
      if (kind === name || (name === 'print' && variable && typeof value === kind
        && (kind !== 'number' || Number.isFinite(value)))) observed = true;
      satisfy();
    },
    succeeded() {
      executedSuccessfully = true;
      if (syntax || (kind === 'comment' && parsed.comment) || observed) satisfy();
    },
  };
}
