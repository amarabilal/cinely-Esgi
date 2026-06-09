// Curated highlight.js grammars, loaded as a SEPARATE async chunk (see
// loadCodeHighlighting in ./extensions). highlight.js auto-registers each
// grammar's declared aliases (js, ts, html, py, sh, md, …) so `language-js`
// etc. resolve without registering them by hand.
import type { LanguageFn } from 'highlight.js';
import javascript from 'highlight.js/lib/languages/javascript';
import typescript from 'highlight.js/lib/languages/typescript';
import xml from 'highlight.js/lib/languages/xml'; // also covers html
import css from 'highlight.js/lib/languages/css';
import json from 'highlight.js/lib/languages/json';
import bash from 'highlight.js/lib/languages/bash'; // also covers sh / shell
import python from 'highlight.js/lib/languages/python';
import sql from 'highlight.js/lib/languages/sql';
import markdown from 'highlight.js/lib/languages/markdown';
import yaml from 'highlight.js/lib/languages/yaml';
import go from 'highlight.js/lib/languages/go';
import rust from 'highlight.js/lib/languages/rust';
import java from 'highlight.js/lib/languages/java';
import plaintext from 'highlight.js/lib/languages/plaintext';

const languages: Record<string, LanguageFn> = {
  javascript,
  typescript,
  xml,
  css,
  json,
  bash,
  python,
  sql,
  markdown,
  yaml,
  go,
  rust,
  java,
  plaintext,
};

export default languages;
