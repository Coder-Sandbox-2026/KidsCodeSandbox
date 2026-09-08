/**
 * Code Coach – picks how much syntax an autocomplete item should insert.
 *
 * This is only the insert-text concern. The replacement range is decided
 * separately by the completion engine (always the current identifier).
 * Hover docs stay independent of the selected level.
 */
import { CODE_COACH_LEVELS } from '../settings/settingsSchema.js';

export function inferCompletion(item) {
  if (item.completion) return item.completion;
  const name = item.label;
  const high = item.insertText || name;
  const looksLikeCall = high.includes('(')
    || item.kind === 'Function'
    || item.kind === 'Method';
  return {
    kind: 'token',
    off: name,
    basic: looksLikeCall ? `${name}()` : name,
    guided: high,
    high,
  };
}

/** True if the student already typed a call after this identifier. */
export function lineAlreadyHasCall(line, wordEndColumn) {
  return /^\s*\(/.test(line.slice(wordEndColumn - 1));
}

export function lineAlreadyHasSemicolon(line, wordEndColumn) {
  return /^\s*;/.test(line.slice(wordEndColumn - 1));
}

/** Inside (...), [...], if/while, or after an operator — not a full statement. */
export function isExpressionContext(beforeText) {
  const before = (beforeText || '').trimEnd();
  if (/\b(if|while|for|switch|catch)\s*$/.test(before)) return true;

  let parens = 0;
  let squares = 0;
  for (const ch of before) {
    if (ch === '(') parens += 1;
    else if (ch === ')') parens -= 1;
    else if (ch === '[') squares += 1;
    else if (ch === ']') squares -= 1;
  }
  if (parens > 0 || squares > 0) return true;

  return /[?:+\-*/%<>!&|^~]$/.test(before);
}

/**
 * Add a trailing semicolon for statement completions, but not when the
 * student is still inside an expression or already typed one.
 */
export function shouldEndWithSemicolon(line, wordStartColumn, wordEndColumn, insertText) {
  const trimmed = String(insertText || '').trimEnd();
  if (!trimmed) return false;
  if (trimmed.endsWith(';')) return false;
  if (!trimmed.includes('(') && !trimmed.includes('=')) return false;
  if (lineAlreadyHasCall(line, wordEndColumn)) return false;
  if (lineAlreadyHasSemicolon(line, wordEndColumn)) return false;

  const before = line.slice(0, Math.max(0, wordStartColumn - 1));
  return !isExpressionContext(before);
}

export function withStatementSemicolon(insertText) {
  return String(insertText).replace(/\s*$/, '') + ';';
}

export function resolveCompletionInsert(item, level, {
  alreadyHasCall = false,
  line = '',
  wordStartColumn = 1,
  wordEndColumn = 1,
} = {}) {
  const name = item.label;
  const completion = inferCompletion(item);
  if (alreadyHasCall) {
    return { insertText: name, isSnippet: false };
  }
  const lvl = CODE_COACH_LEVELS.includes(level) ? level : 'high';
  let insertText = completion[lvl] ?? (lvl === 'off' ? name : completion.basic ?? name);
  if (shouldEndWithSemicolon(line, wordStartColumn, wordEndColumn, insertText)) {
    insertText = withStatementSemicolon(insertText);
  }
  const isSnippet = /\$\{\d/.test(insertText);
  return { insertText, isSnippet };
}
