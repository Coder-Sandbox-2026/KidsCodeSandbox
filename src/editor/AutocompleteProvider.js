/**
 * Registers Monaco completion items and hover docs for the kid API.
 *
 * Range (what Monaco replaces) comes from the current word.
 * Insert text (what Code Coach writes into that range) comes from
 * apiCompletions metadata via the completion engine.
 */
import { appSettings } from '../settings/appSettings.js';
import {
  API_DOCS,
  CONSOLE_DOCS,
  MEMBER_DOCS,
  PLAYER_DOCS,
  findHoverEntry,
} from './apiCompletions.js';
import { buildCompletion, isInCommentOrString, wordRangeFromMonaco } from './completionEngine.js';
import { buildHover } from './hoverDocs.js';

export function registerAutocomplete(monaco) {
  const kindMap = {
    Function: monaco.languages.CompletionItemKind.Function,
    Method: monaco.languages.CompletionItemKind.Method,
    Property: monaco.languages.CompletionItemKind.Property,
  };

  function toSuggestion(item, range, monacoApi, line) {
    const built = buildCompletion(item, {
      level: appSettings.get('codeCoach'),
      line,
      wordStartColumn: range.startColumn,
      wordEndColumn: range.endColumn,
    });
    return {
      label: item.label,
      kind: kindMap[item.kind] || monacoApi.languages.CompletionItemKind.Function,
      insertText: built.insertText,
      insertTextRules: built.isSnippet
        ? monacoApi.languages.CompletionItemInsertTextRule.InsertAsSnippet
        : undefined,
      detail: item.detail,
      documentation: item.doc ? { value: item.doc } : undefined,
      range,
      sortText: '0' + item.label,
      filterText: item.label,
    };
  }

  monaco.languages.registerCompletionItemProvider('javascript', {
    triggerCharacters: ['.'],
    provideCompletionItems(model, position) {
      const range = wordRangeFromMonaco(model, position);
      const lineContent = model.getLineContent(position.lineNumber);
      if (isInCommentOrString(lineContent, position.column)) {
        return { suggestions: [] };
      }

      const charBefore = lineContent[range.startColumn - 2];
      if (charBefore === '.') {
        const beforeDot = lineContent.slice(0, range.startColumn - 2);
        const owner = (beforeDot.match(/(\w+)$/) || [])[1];
        const docs = owner === 'console' ? CONSOLE_DOCS : owner === 'player' ? PLAYER_DOCS : MEMBER_DOCS;
        return { suggestions: docs.map(item => toSuggestion(item, range, monaco, lineContent)) };
      }

      return { suggestions: API_DOCS.map(item => toSuggestion(item, range, monaco, lineContent)) };
    },
  });

  monaco.languages.registerHoverProvider('javascript', {
    provideHover(model, position, _token, context) {
      const word = model.getWordAtPosition(position);
      if (!word) return null;
      const entry = findHoverEntry(word.word);
      if (!entry) return null;
      return {
        range: new monaco.Range(
          position.lineNumber, word.startColumn,
          position.lineNumber, word.endColumn
        ),
        ...buildHover(entry, context),
      };
    },
  });
}
