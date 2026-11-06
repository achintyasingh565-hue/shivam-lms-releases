const browser = { window:'readonly',document:'readonly',localStorage:'readonly',sessionStorage:'readonly',
  indexedDB:'readonly',crypto:'readonly',console:'readonly',navigator:'readonly',setTimeout:'readonly',
  clearTimeout:'readonly',setInterval:'readonly',clearInterval:'readonly',requestAnimationFrame:'readonly',
  fetch:'readonly',location:'readonly',FileReader:'readonly',Blob:'readonly',File:'readonly',URL:'readonly',
  FormData:'readonly',TextEncoder:'readonly',TextDecoder:'readonly',atob:'readonly',btoa:'readonly',
  alert:'readonly',confirm:'readonly',prompt:'readonly',Image:'readonly',Event:'readonly',
  CustomEvent:'readonly',MutationObserver:'readonly',getComputedStyle:'readonly',Uint8Array:'readonly',
  Promise:'readonly',Intl:'readonly',module:'readonly',require:'readonly',process:'readonly',
  Buffer:'readonly',__dirname:'readonly',globalThis:'readonly',structuredClone:'readonly',
  AbortController:'readonly',Headers:'readonly',Request:'readonly',Response:'readonly',
  performance:'readonly',history:'readonly',screen:'readonly',DOMParser:'readonly',XMLHttpRequest:'readonly',
  HTMLElement:'readonly',Node:'readonly',NodeList:'readonly',WeakMap:'readonly',WeakSet:'readonly',
  Proxy:'readonly',Reflect:'readonly',BigInt:'readonly',queueMicrotask:'readonly',ResizeObserver:'readonly',
  IntersectionObserver:'readonly',matchMedia:'readonly',print:'readonly',open:'readonly',close:'readonly',
  electronAPI:'readonly',self:'readonly',top:'readonly',parent:'readonly',frames:'readonly' };
module.exports = [{
  files: ['**/*.js'],
  languageOptions: { ecmaVersion: 2021, sourceType: 'script', globals: browser },
  rules: { 'no-undef': 'error' }
}];
