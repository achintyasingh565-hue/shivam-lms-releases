// ESLint (flat config). The app is one shared global scope by design, so
// `no-undef`/`no-unused-vars` are intentionally OFF (they'd flag every
// cross-file global). What's enabled is the "possible problems" set — the rules
// that catch REAL bugs (duplicate object keys, unreachable code, accidental
// assignment in a condition, comparing with NaN, etc.) which the shared-scope
// style makes easy to introduce and hard to spot by eye.
const browser = {
  window: 'readonly', document: 'readonly', localStorage: 'readonly', sessionStorage: 'readonly',
  indexedDB: 'readonly', crypto: 'readonly', console: 'readonly', navigator: 'readonly',
  setTimeout: 'readonly', clearTimeout: 'readonly', setInterval: 'readonly', clearInterval: 'readonly',
  requestAnimationFrame: 'readonly', fetch: 'readonly', location: 'readonly',
  FileReader: 'readonly', Blob: 'readonly', File: 'readonly', URL: 'readonly', FormData: 'readonly',
  TextEncoder: 'readonly', TextDecoder: 'readonly', atob: 'readonly', btoa: 'readonly',
  alert: 'readonly', confirm: 'readonly', prompt: 'readonly', Image: 'readonly',
  Event: 'readonly', CustomEvent: 'readonly', MutationObserver: 'readonly', getComputedStyle: 'readonly',
  Uint8Array: 'readonly', Promise: 'readonly', Intl: 'readonly'
};

module.exports = [
  {
    files: ['src/app/**/*.js', 'src/theme-boot.js'],
    languageOptions: { ecmaVersion: 2021, sourceType: 'script', globals: browser },
    rules: {
      'no-dupe-keys': 'error',
      'no-dupe-args': 'error',
      'no-dupe-else-if': 'error',
      'no-duplicate-case': 'error',
      'no-unreachable': 'error',
      'no-cond-assign': ['error', 'always'],
      'no-constant-condition': ['error', { checkLoops: false }],
      'no-func-assign': 'error',
      'no-self-assign': 'error',
      'no-self-compare': 'error',
      'no-unsafe-negation': 'error',
      'valid-typeof': 'error',
      'use-isnan': 'error',
      'no-irregular-whitespace': 'error',
      'no-sparse-arrays': 'error',
      'no-unexpected-multiline': 'error',
      'no-empty-pattern': 'error',
      'getter-return': 'error',
      'no-obj-calls': 'error',
      'no-compare-neg-zero': 'error',
      'no-import-assign': 'error',
      'no-setter-return': 'error'
    }
  }
];
