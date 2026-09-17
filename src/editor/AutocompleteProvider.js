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
import { buildCompletion, completionSourceContext, wordRangeFromMonaco, optionContext, currentPositionText, withCurrentPosition } from './completionEngine.js';
import { buildHover } from './hoverDocs.js';

/** Keep Monaco's document words out of authoritative API property lists. */
export function bindOptionSuggestionScope(editor) {
  const normal = editor.getRawOptions().wordBasedSuggestions ?? 'currentDocument';
  let exclusive = false;
  const update = () => {
    const model = editor.getModel();
    const position = editor.getPosition();
    const source = model && position ? model.getValueInRange({
      startLineNumber: 1, startColumn: 1,
      endLineNumber: position.lineNumber, endColumn: position.column,
    }) : null;
    // An empty list still identifies the property context: never use word fallback.
    const next = source != null && optionContext(source, API_DOCS, PLAYER_DOCS) !== null;
    if (next !== exclusive) {
      exclusive = next;
      editor.updateOptions({ wordBasedSuggestions: exclusive ? 'off' : normal });
    }
  };
  const listeners = [editor.onDidChangeCursorPosition(update),
    editor.onDidChangeModelContent(update), editor.onDidChangeModel(update)];
  editor.onDidDispose(() => listeners.forEach(listener => listener.dispose()));
  update();
}

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
    triggerCharacters: ['.', '{'],
    provideCompletionItems(model, position) {
      const range = wordRangeFromMonaco(model, position);
      const lineContent = model.getLineContent(position.lineNumber);
      const source = model.getValueInRange({
        startLineNumber: 1, startColumn: 1,
        endLineNumber: position.lineNumber, endColumn: position.column,
      });
      const context = completionSourceContext(source);
      if (!context) {
        return { suggestions: [] };
      }
      const prefix = lineContent.slice(range.startColumn - 1, position.column - 1);
      const matches = name => name.startsWith(prefix);

      const playerPosition = currentPositionText(getPlayerPosition);
      const options = optionContext(source, API_DOCS, PLAYER_DOCS);
      if (options) {
        return { incomplete: true, suggestions: options.filter(option => matches(option.name)).map(option => {
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
            filterText: option.name,
          };
        }) };
      }
      const beforeWord = context.masked.slice(0, source.length - prefix.length);
      // Objects and arrays contain keys/values, not global API identifiers.
      const inValue = context.stack.some(({ ch, index }) => ch === '['
        || (ch === '{' && !/(?:\)|=>|\belse|\btry|\bfinally)\s*$/.test(context.masked.slice(0, index))));
      if (inValue) return { suggestions: [] };
      if (/\.\s*$/.test(beforeWord)) {
        const owner = beforeWord.match(/(?:^|[^\w$.])([A-Za-z_$][\w$]*)\s*\.\s*$/)?.[1];
        let docs = owner === 'console' ? CONSOLE_DOCS : owner === 'player' ? PLAYER_DOCS : null;
        if (owner && !docs) {
          // Infer only directly assigned API results; unknown receivers belong to Monaco.
          const assignments = [...context.masked.matchAll(/\b(?:const|let|var)\s+([\w$]+)\s*=\s*([\w$]+)\s*\(/g)];
          const factory = assignments.filter(match => match[1] === owner).at(-1)?.[2];
          const entry = API_DOCS.find(item => item.label === factory);
          if (entry?.label === 'getPlayer') docs = PLAYER_DOCS;
          else if (entry && (entry.label.startsWith('create') || entry.label === 'findObject')) docs = MEMBER_DOCS;
        }
        return { incomplete: true, suggestions: (docs || []).filter(item => matches(item.label))
          .map(item => toSuggestion(item, range, monaco, lineContent, playerPosition)) };
      }

      // The next typed word may belong to an options object. Ask Monaco to
      // refresh this provider instead of only filtering cached global names.
      if (!prefix || !/(?:^|[;{}(=,!?:]|\breturn|\bawait|=>)\s*$/.test(beforeWord)) return { suggestions: [] };
      return { incomplete: true, suggestions: API_DOCS.filter(item => matches(item.label))
        .map(item => toSuggestion(item, range, monaco, lineContent, playerPosition)) };
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
