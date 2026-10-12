const LOOP_LIMIT = 100_000;

export class LoopLimitError extends Error {
  constructor() {
    super('Your code repeated too many times. Check that your loop has a stopping condition.');
    this.name = 'LoopLimitError';
  }
}

function isIdentifierStart(ch) { return /[A-Za-z_$]/.test(ch); }
function isIdentifierPart(ch) { return /[A-Za-z0-9_$]/.test(ch); }

function canStartRegex(previous) {
  return !previous || ['(', '[', '{', '=', ':', ',', ';', '!', '?', '&', '|', '+', '-', '*', '%', '<', '>', '^', '~'].includes(previous)
    || ['return', 'throw', 'case', 'typeof', 'void', 'delete', 'new', 'in', 'of'].includes(previous);
}

/** Tokenize enough JavaScript structure to find loop bodies without matching text in strings/comments. */
function tokenize(source) {
  const tokens = [];
  for (let i = 0; i < source.length;) {
    const ch = source[i];
    if (/\s/.test(ch)) { i += 1; continue; }
    if (source.startsWith('//', i)) {
      const end = source.indexOf('\n', i + 2);
      i = end < 0 ? source.length : end + 1;
      continue;
    }
    if (source.startsWith('/*', i)) {
      const end = source.indexOf('*/', i + 2);
      i = end < 0 ? source.length : end + 2;
      continue;
    }
    if (ch === '/' && canStartRegex(tokens.at(-1)?.value)) {
      const start = i++;
      let inClass = false;
      while (i < source.length) {
        if (source[i] === '\\') { i += 2; continue; }
        if (source[i] === '[') inClass = true;
        else if (source[i] === ']') inClass = false;
        else if (source[i] === '/' && !inClass) {
          i += 1;
          while (/[A-Za-z]/.test(source[i] || '')) i += 1;
          break;
        }
        i += 1;
      }
      tokens.push({ value: source.slice(start, i), start, end: i, kind: 'literal' });
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      const quote = ch;
      const start = i++;
      while (i < source.length) {
        if (source[i] === '\\') { i += 2; continue; }
        if (source[i] === quote) { i += 1; break; }
        i += 1;
      }
      tokens.push({ value: source.slice(start, i), start, end: i, kind: 'literal' });
      continue;
    }
    if (isIdentifierStart(ch)) {
      const start = i++;
      while (i < source.length && isIdentifierPart(source[i])) i += 1;
      tokens.push({ value: source.slice(start, i), start, end: i, kind: 'word' });
      continue;
    }
    tokens.push({ value: ch, start: i, end: i + 1, kind: 'punctuation' });
    i += 1;
  }
  return tokens;
}

function matchingToken(tokens, index, open, close) {
  let depth = 0;
  for (let i = index; i < tokens.length; i += 1) {
    if (tokens[i].value === open) depth += 1;
    else if (tokens[i].value === close && --depth === 0) return i;
  }
  return -1;
}

function bodyTokenIndex(tokens, index) {
  if (tokens[index]?.value === '{') return { index, braced: true };
  return { index, braced: false };
}

function statementEnd(tokens, index) {
  const token = tokens[index];
  if (!token) return index;
  if (token.value === '{') return matchingToken(tokens, index, '{', '}');
  if (token.value === 'if' || token.value === 'for' || token.value === 'while') {
    const open = tokens[index + 1]?.value === '(' ? index + 1 : -1;
    const close = open >= 0 ? matchingToken(tokens, open, '(', ')') : -1;
    if (close < 0) return index;
    let end = statementEnd(tokens, close + 1);
    if (token.value === 'if' && tokens[end + 1]?.value === 'else') end = statementEnd(tokens, end + 2);
    return end;
  }
  if (token.value === 'do') {
    const bodyEnd = statementEnd(tokens, index + 1);
    if (tokens[bodyEnd + 1]?.value !== 'while') return bodyEnd;
    const open = bodyEnd + 2;
    const close = matchingToken(tokens, open, '(', ')');
    return close >= 0 && tokens[close + 1]?.value === ';' ? close + 1 : close;
  }
  let parens = 0;
  let squares = 0;
  for (let i = index; i < tokens.length; i += 1) {
    if (tokens[i].value === '(') parens += 1;
    else if (tokens[i].value === ')') parens -= 1;
    else if (tokens[i].value === '[') squares += 1;
    else if (tokens[i].value === ']') squares -= 1;
    else if (tokens[i].value === ';' && parens === 0 && squares === 0) return i;
  }
  return tokens.length - 1;
}

/** Add one shared tick at every syntactic loop-body entry. */
export function instrumentLoops(source, guardName = '__kidsCodeLoopTick') {
  const tokens = tokenize(source);
  const insertions = [];
  const doWhileConditionTokens = new Set();
  for (let i = 0; i < tokens.length; i += 1) {
    if (tokens[i].value !== 'do') continue;
    let bodyEnd = i + 1;
    if (tokens[bodyEnd]?.value === '{') bodyEnd = matchingToken(tokens, bodyEnd, '{', '}');
    else while (bodyEnd < tokens.length && tokens[bodyEnd].value !== ';') bodyEnd += 1;
    if (bodyEnd >= 0 && tokens[bodyEnd + 1]?.value === 'while') doWhileConditionTokens.add(bodyEnd + 1);
  }
  for (let i = 0; i < tokens.length; i += 1) {
    const keyword = tokens[i].value;
    if (keyword !== 'for' && keyword !== 'while' && keyword !== 'do') continue;
    if (doWhileConditionTokens.has(i)) continue;

    let bodyIndex;
    if (keyword === 'do') {
      bodyIndex = i + 1;
    } else {
      const open = tokens[i + 1]?.value === '(' ? i + 1 : -1;
      if (open < 0) continue;
      const close = matchingToken(tokens, open, '(', ')');
      if (close < 0) continue;
      bodyIndex = close + 1;
    }
    const body = bodyTokenIndex(tokens, bodyIndex);
    const token = tokens[body.index];
    if (!token) continue;
    if (body.braced) {
      insertions.push({ position: token.end, text: `\n${guardName}();` });
    } else {
      const end = statementEnd(tokens, body.index);
      const endToken = tokens[end];
      insertions.push({ position: token.start, text: `{${guardName}();` });
      insertions.push({ position: endToken.end, text: '}' });
    }
  }
  let result = source;
  for (const insertion of insertions.sort((a, b) => b.position - a.position)) {
    result = result.slice(0, insertion.position) + insertion.text + result.slice(insertion.position);
  }
  return result;
}

export function createLoopGuard(limit = LOOP_LIMIT) {
  let iterations = 0;
  return () => {
    iterations += 1;
    if (iterations > limit) throw new LoopLimitError();
  };
}

export { LOOP_LIMIT };
