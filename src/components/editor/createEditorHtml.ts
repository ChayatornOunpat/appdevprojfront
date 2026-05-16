export type TestCase = {
  item1?: string;
  item2?: string;
};

export const EDITOR_MESSAGE_SOURCE = 'isegrader-editor';

export type EditorFrameMessage =
  | { source: typeof EDITOR_MESSAGE_SOURCE; type: 'ready' }
  | { source: typeof EDITOR_MESSAGE_SOURCE; type: 'codeChanged'; code: string }
  | { source: typeof EDITOR_MESSAGE_SOURCE; type: 'status'; message: string }
  | {
      source: typeof EDITOR_MESSAGE_SOURCE;
      type: 'submitResult';
      score: number;
      passed: number;
      total: number;
    }
  | { source: typeof EDITOR_MESSAGE_SOURCE; type: 'error'; message: string };

function escapeJsonForHtml(value: string) {
  return value
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

export function createEditorHtml(initialCode: string, tests: TestCase[]) {
  const payload = escapeJsonForHtml(
    JSON.stringify({
      initialCode,
      tests,
      messageSource: EDITOR_MESSAGE_SOURCE,
    }),
  );

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta
      name="viewport"
      content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no"
    />
    <style>
      :root {
        color-scheme: dark;
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        background: #121723;
      }

      * {
        box-sizing: border-box;
      }

      body {
        margin: 0;
        height: 100vh;
        overflow: hidden;
        background: #121723;
        color: #f8fafc;
      }

      #shell {
        display: flex;
        flex-direction: column;
        height: 100vh;
        min-height: 0;
      }

      #toolbar {
        align-items: center;
        background: #172033;
        border-bottom: 1px solid #2b3548;
        display: flex;
        gap: 12px;
        min-height: 44px;
        padding: 8px 12px;
      }

      #language {
        color: #d9e3f0;
        font-size: 13px;
        font-weight: 700;
      }

      #status {
        color: #9fb0c4;
        font-size: 12px;
        margin-left: auto;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      #editor,
      #fallback {
        flex: 1;
        min-height: 0;
      }

      #fallback {
        background: #111827;
        border: 0;
        color: #e5e7eb;
        display: none;
        font-family: "SFMono-Regular", Consolas, "Liberation Mono", monospace;
        font-size: 14px;
        line-height: 1.55;
        outline: none;
        padding: 16px;
        resize: none;
        width: 100%;
      }
    </style>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.52.2/min/vs/loader.min.js"></script>
    <script src="https://cdn.jsdelivr.net/pyodide/v0.26.4/full/pyodide.js"></script>
  </head>
  <body>
    <script id="payload" type="application/json">${payload}</script>
    <div id="shell">
      <div id="toolbar">
        <div id="language">Python</div>
        <div id="status">Loading editor...</div>
      </div>
      <div id="editor"></div>
      <textarea id="fallback" spellcheck="false" autocapitalize="off" autocomplete="off"></textarea>
    </div>
    <script>
      (function () {
        var payloadElement = document.getElementById('payload');
        var payload = JSON.parse(payloadElement.textContent || '{}');
        var source = payload.messageSource;
        var tests = Array.isArray(payload.tests) ? payload.tests : [];
        var editorElement = document.getElementById('editor');
        var fallbackElement = document.getElementById('fallback');
        var statusElement = document.getElementById('status');
        var editor = null;
        var pyodidePromise = null;
        var changeTimer = null;

        function setStatus(message) {
          statusElement.textContent = message;
          post({ type: 'status', message: message });
        }

        function post(message) {
          var outgoing = Object.assign({ source: source }, message);
          if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
            window.ReactNativeWebView.postMessage(JSON.stringify(outgoing));
            return;
          }

          if (window.parent && window.parent !== window) {
            window.parent.postMessage(outgoing, '*');
          }
        }

        function getCode() {
          if (editor) {
            return editor.getValue();
          }

          return fallbackElement.value;
        }

        function notifyCodeChanged() {
          clearTimeout(changeTimer);
          changeTimer = setTimeout(function () {
            post({ type: 'codeChanged', code: getCode() });
          }, 250);
        }

        function showFallback(reason) {
          editorElement.style.display = 'none';
          fallbackElement.style.display = 'block';
          fallbackElement.value = payload.initialCode || '';
          fallbackElement.addEventListener('input', notifyCodeChanged);
          setStatus(reason || 'Text editor ready');
          post({ type: 'ready' });
        }

        function bootMonaco() {
          if (!window.require) {
            showFallback('Text editor ready');
            return;
          }

          try {
            window.require.config({
              paths: {
                vs: 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.52.2/min/vs',
              },
            });

            window.require(
              ['vs/editor/editor.main'],
              function () {
                editor = window.monaco.editor.create(editorElement, {
                  automaticLayout: true,
                  fontFamily: 'Consolas, "Liberation Mono", monospace',
                  fontSize: 14,
                  language: 'python',
                  minimap: { enabled: false },
                  padding: { top: 14 },
                  scrollBeyondLastLine: false,
                  theme: 'vs-dark',
                  value: payload.initialCode || '',
                });

                editor.onDidChangeModelContent(notifyCodeChanged);
                setStatus('Editor ready');
                post({ type: 'ready' });
              },
              function () {
                showFallback('Text editor ready');
              },
            );
          } catch (error) {
            showFallback('Text editor ready');
          }
        }

        async function getPyodide() {
          if (!pyodidePromise) {
            if (!window.loadPyodide) {
              throw new Error('Pyodide failed to load');
            }

            setStatus('Loading Python runtime...');
            pyodidePromise = window.loadPyodide({
              indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.26.4/full/',
            });
          }

          return pyodidePromise;
        }

        async function runTests() {
          if (!tests.length) {
            post({ type: 'error', message: 'No test cases were returned by the server.' });
            return;
          }

          var currentCode = getCode();
          var pyodide;
          var passed = 0;
          var runner = [
            'import sys, io',
            'input_iterator = iter(TEST_INPUT.split("\\\\n"))',
            'captured_output = io.StringIO()',
            'old_stdout = sys.stdout',
            'sys.stdout = captured_output',
            'namespace = {"input": lambda: next(input_iterator)}',
            'try:',
            '    exec(USER_CODE, namespace)',
            'finally:',
            '    sys.stdout = old_stdout',
            'captured_output.getvalue()',
          ].join('\\n');

          try {
            pyodide = await getPyodide();
          } catch (error) {
            post({ type: 'error', message: String(error && error.message ? error.message : error) });
            return;
          }

          setStatus('Running tests...');

          for (var index = 0; index < tests.length; index += 1) {
            var test = tests[index] || {};
            var expected = String(test.item2 || '').trim();
            var input = String(test.item1 || '');

            try {
              pyodide.globals.set('USER_CODE', currentCode);
              pyodide.globals.set('TEST_INPUT', input);

              var result = await pyodide.runPythonAsync(runner);
              if (String(result).trim() === expected) {
                passed += 1;
              }
            } catch (error) {
              console.error(error);
            }
          }

          var score = Math.round((passed * 100) / tests.length);
          setStatus('Finished ' + passed + ' of ' + tests.length + ' tests');
          post({ type: 'submitResult', score: score, passed: passed, total: tests.length });
        }

        window.ISEGraderEditor = { runTests: runTests };

        window.addEventListener('message', function (event) {
          var data = event.data;
          if (!data || data.source !== source) {
            return;
          }

          if (data.type === 'run-tests') {
            runTests();
          }
        });

        bootMonaco();
      })();
    </script>
  </body>
</html>`;
}
