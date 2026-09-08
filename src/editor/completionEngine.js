/**
 * Shared completion builder.
 *
 * Range and insert text are independent:
 *
 *   RANGE  — the current Monaco identifier only.
 *            Answers: "What existing text should be replaced?"
 *
 *   TEXT   — the Code Coach template for Off / Basic / Guided / High.
 *            Answers: "What should be inserted into that range?"
 *
 * Token completions may include the API's own arguments and callbacks.
 * They must not include surrounding source the student already typed
 * (for example "const player = " or "print(").
 */
import {
  inferCompletion,
  isExpressionContext,
  lineAlreadyHasCall,
  resolveCompletionInsert,
  shouldEndWithSemicolon,
} from './codeCoach.js';

export function wordRangeFromMonaco(model, position) {
  const word = model.getWordUntilPosition(position);
  return {
    startLineNumber: position.lineNumber,
    endLineNumber: position.lineNumber,
    startColumn: word.startColumn,
    endColumn: word.endColumn,
  };
}

/** Replace only the identifier columns. Used by tests; Monaco does this natively. */
export function replaceWord(line, startColumn, endColumn, insertText) {
  return line.slice(0, startColumn - 1) + insertText + line.slice(endColumn - 1);
}

export function isMemberAccess(line, wordStartColumn) {
  return line[wordStartColumn - 2] === '.';
}

export function textAfterWord(line, wordEndColumn) {
  return line.slice(wordEndColumn - 1);
}

export function isInCommentOrString(line, column) {
  const before = line.slice(0, Math.max(0, column - 1));
  let inSingle = false;
  let inDouble = false;
  let inTemplate = false;
  for (let i = 0; i < before.length; i++) {
    const ch = before[i];
    const prev = before[i - 1];
    if (prev === '\\' && (inSingle || inDouble || inTemplate)) continue;
    if (ch === "'" && !inDouble && !inTemplate) inSingle = !inSingle;
    else if (ch === '"' && !inSingle && !inTemplate) inDouble = !inDouble;
    else if (ch === '`' && !inSingle && !inDouble) inTemplate = !inTemplate;
    else if (!inSingle && !inDouble && !inTemplate && ch === '/' && before[i + 1] === '/') {
      return true;
    }
  }
  return inSingle || inDouble || inTemplate;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Keep the API's own syntax. Only strip accidental source wrappers
 * such as "const player = getPlayer()" or a leading "await ".
 *
 * Never reduce a rich scaffold that already starts at the API name.
 * "onKeyDown("KeyE", () => {})" stays fully intact.
 */
export function asTokenTemplate(label, text) {
  if (text == null) return label;
  const trimmed = String(text).replace(/^\s+/, '');
  const escaped = escapeRegExp(label);

  if (new RegExp(`^${escaped}\\b`).test(trimmed)) {
    return trimmed;
  }

  const awaitWrapped = trimmed.match(new RegExp(`^await\\s+(${escaped}\\b[\\s\\S]*)`));
  if (awaitWrapped) return awaitWrapped[1];

  const declared = trimmed.match(
    new RegExp(`^(?:const|let|var)\\s+\\w+\\s*=\\s*(${escaped}\\b[\\s\\S]*)`)
  );
  if (declared) return declared[1];

  const word = trimmed.match(new RegExp(`\\b${escaped}\\b`));
  if (word && word.index != null) return trimmed.slice(word.index);
  return trimmed;
}

export function isAssignmentTemplate(label, text) {
  return new RegExp(`^${label}\\s*=`).test(String(text).trimStart());
}

function alreadyHasEqualsAfter(line, wordEndColumn) {
  return /^\s*=/.test(textAfterWord(line, wordEndColumn));
}

function alreadyHasLeadingKeyword(before, keyword) {
  return new RegExp(`\\b${keyword}\\s*$`).test(before.trimEnd());
}

function isStatementStart(before) {
  const t = before.trimEnd();
  return t === '' || /[{};]$/.test(t);
}

/**
 * Build the word-only range plus Code Coach insert text.
 * Does not shrink Guided/High scaffolds down to name().
 */
export function buildCompletion(item, {
  level,
  line = '',
  wordStartColumn = 1,
  wordEndColumn = 1,
} = {}) {
  const label = item.label;
  const kind = item.completion?.kind || 'token';
  const alreadyHasCall = lineAlreadyHasCall(line, wordEndColumn);
  const range = {
    startColumn: wordStartColumn,
    endColumn: wordEndColumn,
  };

  if (kind === 'statement') {
    const resolved = resolveCompletionInsert(item, level, {
      alreadyHasCall,
      line,
      wordStartColumn,
      wordEndColumn,
    });
    return { ...resolved, range, kind };
  }

  const resolved = resolveCompletionInsert(item, level, {
    alreadyHasCall,
    line,
    wordStartColumn,
    wordEndColumn,
  });

  let insertText = asTokenTemplate(label, resolved.insertText);

  if (alreadyHasCall) {
    return { insertText: label, isSnippet: false, range, kind: 'token' };
  }

  if (isAssignmentTemplate(label, insertText)) {
    const member = isMemberAccess(line, wordStartColumn);
    if (!member || alreadyHasEqualsAfter(line, wordEndColumn)) {
      insertText = label;
    }
  }

  const completion = inferCompletion(item);
  const keyword = completion.leadingKeyword;
  if (keyword && !alreadyHasCall) {
    const before = line.slice(0, Math.max(0, wordStartColumn - 1));
    if (
      isStatementStart(before)
      && !alreadyHasLeadingKeyword(before, keyword)
      && !insertText.startsWith(`${keyword} `)
    ) {
      insertText = `${keyword} ${insertText}`;
    }
  }

  if (shouldEndWithSemicolon(line, wordStartColumn, wordEndColumn, insertText)) {
    insertText = insertText.replace(/\s*$/, '') + ';';
  }

  return {
    insertText,
    isSnippet: /\$\{\d/.test(insertText),
    range,
    kind: 'token',
  };
}

/** Simulate Monaco: replace the word range, leave everything else. */
export function completeLine(line, partialStart, item, level) {
  const wordEndColumn = partialStart + (line.slice(partialStart - 1).match(/^\w*/)?.[0].length || 0);
  const { insertText } = buildCompletion(item, {
    level,
    line,
    wordStartColumn: partialStart,
    wordEndColumn,
  });
  return replaceWord(line, partialStart, wordEndColumn, insertText);
}
