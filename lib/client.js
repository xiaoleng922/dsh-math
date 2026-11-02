// dsh-math — render LaTeX math in DeepSeek Harness chat replies with KaTeX.
//
// This is a client plugin: the host loads it in the browser through
// window.__ModuleLoader__, calls apply(ctx), and then this module watches the
// conversation DOM for new text and replaces math delimiters with KaTeX output.
//
// Supported delimiters:
//   $$ ... $$   display math
//   \[ ... \]   display math
//   \( ... \)   inline math
//   $ ... $     inline math (with a light guard so "$5" is not treated as math)
window.__ModuleLoader__.load({
  id: 'dsh-math',
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;

    if (typeof window === 'undefined' || typeof document === 'undefined') {
      exports.apply = function () {};
      exports.inject = [];
      return module.exports;
    }

    if (window.__dshMathLoaded) return module.exports;
    window.__dshMathLoaded = true;

    const KATEX_VERSION = '0.16.9';
    const KATEX_BASE = 'https://cdn.jsdelivr.net/npm/katex@' + KATEX_VERSION + '/dist/';

    const SKIP_TAGS = new Set([
      'SCRIPT',
      'STYLE',
      'CODE',
      'PRE',
      'TEXTAREA',
      'INPUT',
      'SELECT',
      'NOSCRIPT',
      'KBD',
      'SAMP',
      'MATH',
      'SVG'
    ]);

    let katexPromise = null;
    let observer = null;
    let frame = null;
    const pending = new Set();

    function loadKatex() {
      if (window.katex) return Promise.resolve(window.katex);
      if (katexPromise !== null) return katexPromise;

      katexPromise = new Promise((resolve, reject) => {
        if (!document.querySelector('link[data-dsh-math="css"]')) {
          const link = document.createElement('link');
          link.rel = 'stylesheet';
          link.href = KATEX_BASE + 'katex.min.css';
          link.dataset.dshMath = 'css';
          document.head.appendChild(link);
        }

        const script = document.createElement('script');
        script.src = KATEX_BASE + 'katex.min.js';
        script.async = true;
        script.dataset.dshMath = 'js';
        script.addEventListener(
          'load',
          () => {
            if (window.katex) resolve(window.katex);
            else reject(new Error('KaTeX loaded but window.katex is missing'));
          },
          { once: true }
        );
        script.addEventListener(
          'error',
          () => reject(new Error('Failed to load ' + script.src)),
          { once: true }
        );
        document.head.appendChild(script);
      });

      return katexPromise;
    }

    // ---------------------------------------------------------------- parsing

    function findInlineDollar(text, from) {
      for (let j = from; j < text.length; j++) {
        const ch = text[j];
        if (ch === '\\') {
          j += 1;
          continue;
        }
        if (ch === '\n') return -1;
        if (ch === '$') return j;
      }
      return -1;
    }

    function looksLikeMath(content) {
      if (!content) return false;
      if (content !== content.trim()) return false;
      if (content.length > 600) return false;
      return /[A-Za-z\\^_{}=<>+\-*/|∫∮√≈≤≥π]/.test(content);
    }

    function findSpans(text) {
      const out = [];
      let i = 0;
      const n = text.length;

      while (i < n) {
        if (text.startsWith('$$', i)) {
          const j = text.indexOf('$$', i + 2);
          if (j > i + 2) {
            out.push({ start: i, end: j + 2, content: text.slice(i + 2, j), display: true });
            i = j + 2;
            continue;
          }
          i += 2;
          continue;
        }

        if (text.startsWith('\\[', i)) {
          const j = text.indexOf('\\]', i + 2);
          if (j > i + 2) {
            out.push({ start: i, end: j + 2, content: text.slice(i + 2, j), display: true });
            i = j + 2;
            continue;
          }
          i += 2;
          continue;
        }

        if (text.startsWith('\\(', i)) {
          const j = text.indexOf('\\)', i + 2);
          if (j > i + 2) {
            out.push({ start: i, end: j + 2, content: text.slice(i + 2, j), display: false });
            i = j + 2;
            continue;
          }
          i += 2;
          continue;
        }

        if (text[i] === '$') {
          const j = findInlineDollar(text, i + 1);
          if (j !== -1) {
            const content = text.slice(i + 1, j);
            if (looksLikeMath(content)) {
              out.push({ start: i, end: j + 1, content: content, display: false });
              i = j + 1;
              continue;
            }
          }
          i += 1;
          continue;
        }

        i += 1;
      }

      return out;
    }

    // ---------------------------------------------------------------- DOM

    function isSkippable(el) {
      if (!el || el.nodeType !== 1) return true;
      if (SKIP_TAGS.has(el.tagName)) return true;
      if (el.isContentEditable) return true;
      try {
        if (el.closest('pre, code, .katex, .katex-display, [data-dsh-math]')) return true;
      } catch (_) {
        return true;
      }
      return false;
    }

    function renderTextNode(node) {
      const text = node.nodeValue;
      if (!text || !/[\\$]/.test(text)) return false;

      const spans = findSpans(text);
      if (spans.length === 0) return false;

      const frag = document.createDocumentFragment();
      let cursor = 0;

      for (const span of spans) {
        if (span.start > cursor) {
          frag.appendChild(document.createTextNode(text.slice(cursor, span.start)));
        }

        const host = document.createElement('span');
        host.className = 'dsh-math';
        host.dataset.dshMath = '';
        if (span.display) {
          host.dataset.dshMathDisplay = '';
          host.style.display = 'block';
          host.style.textAlign = 'center';
          host.style.margin = '0.6em 0';
          host.style.overflowX = 'auto';
          host.style.overflowY = 'hidden';
        }

        try {
          window.katex.render(span.content, host, {
            displayMode: span.display,
            throwOnError: false,
            strict: 'ignore',
            trust: false
          });
        } catch (_) {
          host.textContent = text.slice(span.start, span.end);
        }

        frag.appendChild(host);
        cursor = span.end;
      }

      if (cursor < text.length) {
        frag.appendChild(document.createTextNode(text.slice(cursor)));
      }

      node.parentNode.replaceChild(frag, node);
      return true;
    }

    function processRoot(root) {
      if (!root || !window.katex) return;

      if (root.nodeType === 3) {
        if (!isSkippable(root.parentElement)) renderTextNode(root);
        return;
      }

      if (root.nodeType !== 1 || isSkippable(root)) return;

      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
        acceptNode(n) {
          if (isSkippable(n.parentElement)) return NodeFilter.FILTER_REJECT;
          if (!n.nodeValue || !/[\\$]/.test(n.nodeValue)) return NodeFilter.FILTER_REJECT;
          return NodeFilter.FILTER_ACCEPT;
        }
      });

      const nodes = [];
      while (walker.nextNode()) nodes.push(walker.currentNode);
      for (const n of nodes) {
        if (n.parentNode) renderTextNode(n);
      }
    }

    function schedule(root) {
      if (!root) return;
      pending.add(root);
      if (frame !== null) return;

      frame = window.requestAnimationFrame(() => {
        frame = null;
        const roots = Array.from(pending);
        pending.clear();

        if (observer !== null) observer.disconnect();
        try {
          for (const r of roots) {
            if (r && r.isConnected !== false) processRoot(r);
          }
        } finally {
          if (observer !== null) {
            observer.observe(document.body, { childList: true, subtree: true, characterData: true });
          }
        }
      });
    }

    // ---------------------------------------------------------------- boot

    function start() {
      loadKatex()
        .then(() => {
          processRoot(document.body);

          if (observer !== null) return;
          observer = new MutationObserver((mutations) => {
            for (const m of mutations) {
              if (m.type === 'characterData') {
                if (m.target && m.target.parentElement) schedule(m.target.parentElement);
                continue;
              }
              for (const n of m.addedNodes) {
                if (n.nodeType === 1) schedule(n);
                else if (n.nodeType === 3 && n.parentElement) schedule(n.parentElement);
              }
            }
          });
          observer.observe(document.body, { childList: true, subtree: true, characterData: true });
        })
        .catch((err) => {
          console.warn('[dsh-math] KaTeX failed to load:', err);
        });
    }

    function apply(ctx) {
      start();
    }

    exports.apply = apply;
    exports.inject = [];
    return module.exports;
  }
});
