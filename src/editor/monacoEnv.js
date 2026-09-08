/**
 * Must load before monaco-editor.
 * Use node_modules paths — monaco-editor's package "exports" rewrite
 * `monaco-editor/esm/...` to a missing file.
 * `?worker&inline` keeps workers working in Vite and in KidsCode3D.html.
 */
import EditorWorker from '../../node_modules/monaco-editor/esm/vs/editor/editor.worker.js?worker&inline';
import JsonWorker from '../../node_modules/monaco-editor/esm/vs/languages/features/json/json.worker.js?worker&inline';
import TsWorker from '../../node_modules/monaco-editor/esm/vs/languages/features/typescript/ts.worker.js?worker&inline';

function getWorker(_workerId, label) {
  if (label === 'json') return new JsonWorker();
  if (label === 'typescript' || label === 'javascript') return new TsWorker();
  return new EditorWorker();
}

const env = { getWorker };
globalThis.MonacoEnvironment = env;
self.MonacoEnvironment = env;
