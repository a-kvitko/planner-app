/**
 * Parse #hashtags from description-like text (Things / Apple Notes style).
 * Names: letters/digits, multi-word via _ or - (e.g. #tdw_web, #tdw-web).
 */

/** @returns {string[]} unique tag names in first-seen order (original casing) */
export function extractHashtagNames(text) {
  const s = String(text || '');
  const re = /(^|[^A-Za-z0-9_/])#([A-Za-z0-9]+(?:[_-][A-Za-z0-9]+)*)/g;
  const out = [];
  const seen = new Set();
  let m;
  while ((m = re.exec(s))) {
    const name = m[2];
    if (!name || name.length > 80) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(name);
  }
  return out;
}

/**
 * Diff hashtag sets between old and new text (case-insensitive).
 * @returns {{ added: string[], removed: string[], current: string[] }}
 */
export function diffHashtagNames(oldText, newText) {
  const current = extractHashtagNames(newText);
  const oldNames = extractHashtagNames(oldText);
  const curKeys = new Set(current.map((n) => n.toLowerCase()));
  const oldKeys = new Set(oldNames.map((n) => n.toLowerCase()));
  return {
    current,
    added: current.filter((n) => !oldKeys.has(n.toLowerCase())),
    removed: oldNames.filter((n) => !curKeys.has(n.toLowerCase())),
  };
}

/** Runnable: node --input-type=module -e "import('./js/hashtag-tags.js').then(m=>m._selfCheck())" */
export function _selfCheck() {
  const names = extractHashtagNames('see #tdw_web and #Do and again #tdw_web');
  if (names.join(',') !== 'tdw_web,Do') throw new Error('extract: ' + names.join(','));

  const hyphen = extractHashtagNames('use #tdw-web please');
  if (hyphen[0] !== 'tdw-web') throw new Error('hyphen: ' + hyphen.join(','));

  const url = extractHashtagNames('link https://x.com/#anchor and #real');
  if (url.join(',') !== 'real') throw new Error('url: ' + url.join(','));

  const mid = extractHashtagNames('foo#notag #yes');
  if (mid.join(',') !== 'yes') throw new Error('mid: ' + mid.join(','));

  const d = diffHashtagNames('had #a and #b', 'now #b and #c');
  if (d.added.join(',') !== 'c' || d.removed.join(',') !== 'a' || d.current.join(',') !== 'b,c') {
    throw new Error('diff: ' + JSON.stringify(d));
  }

  console.log('hashtag-tags self-check: ok');
}
