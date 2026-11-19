import type { Plugin } from 'vite';

const noArgs = 'new Function(getStringFromWasm0(arg0, arg1))';
const withArgs = 'new Function(getStringFromWasm0(arg0, arg1), getStringFromWasm0(arg2, arg3))';

// Typst.ts 0.7.0's generated bindgen glue constructs these fixed default callbacks.
// Keep the build compatible with wasm-unsafe-eval and reject unsupported callbacks.
const staticCallbacks = `
function typstDefaultCallback(body, parameter) {
  if (parameter === 'path' && body === 'return path') return (path) => path;
  if (parameter === undefined) {
    switch (body) {
      case 'return 0': return () => 0;
      case 'return true': return () => true;
      case "throw new Error('Dummy AccessModel, please initialize compiler with withAccessModel()')":
        return () => { throw new Error('Typst file unavailable'); };
      case "throw new Error('Dummy Registry, please initialize compiler with withPackageRegistry()')":
        return () => { throw new Error('Typst package unavailable'); };
    }
  }
  throw new Error('Unsupported Typst WebAssembly default callback');
}
`;

export function typstWasmCsp(): Plugin {
  return {
    name: 'typst-wasm-csp',
    enforce: 'pre',
    transform(code, id) {
      const match =
        /\/node_modules\/@myriaddreamin\/typst-ts-(web-compiler|renderer)\/pkg\/typst_ts_(?:web_compiler|renderer)\.mjs$/u.exec(
          id,
        );
      if (!match) return;
      if (!code.includes(noArgs) || (match[1] === 'web-compiler' && !code.includes(withArgs)))
        this.error('Typst WebAssembly bindings changed. Review the CSP adapter.');
      const patched = code
        .replace(noArgs, 'typstDefaultCallback(getStringFromWasm0(arg0, arg1))')
        .replace(
          withArgs,
          'typstDefaultCallback(getStringFromWasm0(arg2, arg3), getStringFromWasm0(arg0, arg1))',
        );
      return { code: staticCallbacks + patched, map: null };
    },
  };
}
