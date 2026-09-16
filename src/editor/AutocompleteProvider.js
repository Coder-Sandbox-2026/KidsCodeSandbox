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
import { buildCompletion, isInCommentOrString, wordRangeFromMonaco, optionContext, currentPositionText, withCurrentPosition } from './completionEngine.js';
import { buildHover } from './hoverDocs.js';

export function registerAutocomplete(monaco, { getPlayerPosition } = {}) {
  const kindMap = {
    Function: monaco.languages.CompletionItemKind.Function,
    Method: monaco.languages.CompletionItemKind.Method,
    Property: monaco.languages.CompletionItemKind.Property,
  };

  function toSuggestion(item, range, monacoApi, line, playerPosition) {
    const built = buildCompletion(item, {
      level: appSettings.get('codeCoach'),
      line,
      wordStartColumn: range.startColumn,
      wordEndColumn: range.endColumn,
    });
    return {
      label: item.label,
      kind: kindMap[item.kind] || monacoApi.languages.CompletionItemKind.Function,
      insertText: withCurrentPosition(built.insertText, playerPosition),
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

      const playerPosition = currentPositionText(getPlayerPosition);
      const options = optionContext(model.getValueInRange({
        startLineNumber: 1, startColumn: 1,
        endLineNumber: position.lineNumber, endColumn: position.column,
      }), API_DOCS, PLAYER_DOCS);
      if (options) {
        return { suggestions: options.map(option => {
          const value = option.name === 'position' && playerPosition ? playerPosition : option.example;
          const nameOnly = appSettings.get('codeCoach') === 'off'
            || /^\s*:/.test(lineContent.slice(range.endColumn - 1));
          return {
            label: option.name, kind: kindMap.Property, range,
            insertText: nameOnly ? option.name : option.name + ': ' + (value ?? '${1:value}'),
            insertTextRules: nameOnly || value != null ? undefined
              : monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            detail: option.type, documentation: option.description,
            sortText: '0' + option.name,
          };
        }) };
      }
      const charBefore = lineContent[range.startColumn - 2];
      if (charBefore === '.') {
        const beforeDot = lineContent.slice(0, range.startColumn - 2);
        const owner = (beforeDot.match(/(\w+)$/) || [])[1];
        const docs = owner === 'console' ? CONSOLE_DOCS : owner === 'player' ? PLAYER_DOCS : MEMBER_DOCS;
        return { suggestions: docs.map(item => toSuggestion(item, range, monaco, lineContent, playerPosition)) };
      }

      return { suggestions: API_DOCS.map(item => toSuggestion(item, range, monaco, lineContent, playerPosition)) };
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
