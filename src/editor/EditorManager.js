/**
 * EditorManager.js – Sets up Monaco Editor with JS highlighting, autocomplete,
 * and the kid-friendly theme.
 */
import './monacoEnv.js';
import * as monaco from 'monaco-editor';
import { typescript as monacoTypescript } from 'monaco-editor';
import { registerAutocomplete } from './AutocompleteProvider.js';
import { GAME_API_DTS } from './gameApiTypes.js';
import { bindHoverDisclosureLayout } from './hoverLayout.js';

registerAutocomplete(monaco);

const typescript = monacoTypescript || monaco.languages?.typescript;
const KID_CODE_URI = monaco.Uri.parse('file:///kids-code.js');
const API_LIB_PATH = 'file:///kids-code-api.d.ts';

if (typescript?.javascriptDefaults) {
  const js = typescript.javascriptDefaults;
  const ts = typescript.typescriptDefaults;
  const compilerOptions = {
    allowNonTsExtensions: true,
    allowJs: true,
    checkJs: true,
    noLib: false,
    noEmit: true,
    target: typescript.ScriptTarget.ESNext,
    module: typescript.ModuleKind.ESNext,
    lib: ['es2020'],
  };
  js.setCompilerOptions(compilerOptions);
  ts.setCompilerOptions(compilerOptions);
  js.setDiagnosticsOptions({
    noSemanticValidation: false,
    noSyntaxValidation: false,
    noSuggestionDiagnostics: false,
  });
  ts.setDiagnosticsOptions({
    noSemanticValidation: false,
    noSyntaxValidation: false,
  });
  js.setEagerModelSync(true);
  ts.setEagerModelSync(true);
  js.addExtraLib(GAME_API_DTS, API_LIB_PATH);
  ts.addExtraLib(GAME_API_DTS, API_LIB_PATH);
}

const DEFAULT_CODE = `// 🎮 Welcome to Kids Code 3D!
// Write JavaScript below and press ▶ Run to see it in the 3D world!

createCube({
    position: [0, 3, -5],
    color: "red",
    physics: true
});

print("Hello! I made a red cube!");
`;

export class EditorManager {
  constructor(container) {
    monaco.editor.defineTheme('kidsDark', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'comment', foreground: '6a9955', fontStyle: 'italic' },
        { token: 'string', foreground: 'ce9178' },
        { token: 'keyword', foreground: 'c586c0' },
        { token: 'number', foreground: 'b5cea8' },
      ],
      colors: {
        'editor.background': '#1e1e2e',
        'editor.foreground': '#cdd6f4',
        'editorCursor.foreground': '#f5e0dc',
        'editor.lineHighlightBackground': '#2a2a3e',
        'editor.selectionBackground': '#44475a',
        'editorSuggestWidget.background': '#1e1e2e',
        'editorSuggestWidget.border': '#45475a',
        'editorSuggestWidget.selectedBackground': '#45475a',
        'editorHoverWidget.background': '#1e1e2e',
        'editorHoverWidget.border': '#45475a',
      },
    });

    const code = this._loadSaved() || DEFAULT_CODE;
    let model = monaco.editor.getModel(KID_CODE_URI);
    if (model) model.setValue(code);
    else model = monaco.editor.createModel(code, 'javascript', KID_CODE_URI);

    this.editor = monaco.editor.create(container, {
      model,
      theme: 'kidsDark',
      fontSize: 15,
      lineNumbers: 'on',
      minimap: { enabled: false },
      automaticLayout: true,
      scrollBeyondLastLine: false,
      tabSize: 2,
      wordWrap: 'on',
      fixedOverflowWidgets: true,
      suggestOnTriggerCharacters: true,
      quickSuggestions: { other: 'on', comments: 'off', strings: 'on' },
      quickSuggestionsDelay: 0,
      wordBasedSuggestions: 'currentDocument',
      snippetSuggestions: 'inline',
      snippetsPreventQuickSuggestions: false,
      tabCompletion: 'on',
      acceptSuggestionOnCommitCharacter: true,
      acceptSuggestionOnEnter: 'on',
      parameterHints: { enabled: true },
      hover: { enabled: true, delay: 200, sticky: true, hidingDelay: 300 },
      bracketPairColorization: { enabled: true },
      autoClosingBrackets: 'always',
      autoClosingQuotes: 'always',
      matchBrackets: 'always',
      suggest: {
        showWords: true,
        showFunctions: true,
        showSnippets: true,
        showKeywords: true,
        preview: true,
        snippetsPreventQuickSuggestions: false,
        filterGraceful: true,
        localityBonus: true,
      },
    });
    bindHoverDisclosureLayout(this.editor);
  }

  getCode() {
    return this.editor.getValue();
  }

  setCode(code) {
    this.editor.setValue(code);
  }

  highlightError(lineNumber) {
    if (!lineNumber) return;
    this._clearDecorations();
    this._decorations = this.editor.deltaDecorations([], [{
      range: new monaco.Range(lineNumber, 1, lineNumber, 1),
      options: {
        isWholeLine: true,
        className: 'error-line',
        glyphMarginClassName: 'error-glyph',
      },
    }]);
  }

  _clearDecorations() {
    if (this._decorations) {
      this.editor.deltaDecorations(this._decorations, []);
      this._decorations = null;
    }
  }

  save() {
    localStorage.setItem('kidscode3d_code', this.editor.getValue());
  }

  _loadSaved() {
    return localStorage.getItem('kidscode3d_code');
  }
}
