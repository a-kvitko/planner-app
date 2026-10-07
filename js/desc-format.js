/**
 * Lightweight markdown for planner descriptions (preview + Cmd+B/I markers).
 * Markers in stored text: **bold**, *italic*, lines "- " / "1. " for lists.
 */

const URL_IN_TEXT_RE = /\b(https?:\/\/[^\s<]+[^\s<.,:;"')\]\u2026]|www\.[^\s<]+[^\s<.,:;"')\]\u2026])/gi;

function esc(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Inline: links (protected), then **bold**, *italic* / _italic_. */
export function formatDescInline(raw) {
  const urls = [];
  let s = String(raw || '').replace(new RegExp(URL_IN_TEXT_RE.source, URL_IN_TEXT_RE.flags), (m) => {
    urls.push(m);
    return '\0U' + (urls.length - 1) + '\0';
  });
  s = esc(s);
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  s = s.replace(/_([^_\n]+)_/g, '<em>$1</em>');
  s = s.replace(/\0U(\d+)\0/g, (_, i) => {
    const url = urls[Number(i)];
    const href = /^https?:\/\//i.test(url) ? url : 'https://' + url;
    return (
      '<a href="' +
      esc(href) +
      '" class="task-desc-link" target="_blank" rel="noopener noreferrer">' +
      esc(url) +
      '</a>'
    );
  });
  return s;
}

const BULLET_RE = /^- /;
const ORDERED_RE = /^\d+\. /;

export function descPreviewInnerHTML(raw) {
  const v = String(raw || '');
  if (!v.trim()) return '';
  const lines = v.split('\n');
  let html = '';
  let i = 0;
  while (i < lines.length) {
    if (BULLET_RE.test(lines[i])) {
      html += '<ul class="task-desc-list">';
      while (i < lines.length && BULLET_RE.test(lines[i])) {
        html += '<li>' + formatDescInline(lines[i].slice(2)) + '</li>';
        i++;
      }
      html += '</ul>';
    } else if (ORDERED_RE.test(lines[i])) {
      html += '<ol class="task-desc-list">';
      while (i < lines.length && ORDERED_RE.test(lines[i])) {
        html += '<li>' + formatDescInline(lines[i].replace(ORDERED_RE, '')) + '</li>';
        i++;
      }
      html += '</ol>';
    } else {
      const chunk = [];
      while (i < lines.length && !BULLET_RE.test(lines[i]) && !ORDERED_RE.test(lines[i])) {
        chunk.push(formatDescInline(lines[i]));
        i++;
      }
      html += chunk.join('<br>');
    }
  }
  return html;
}

/** Toggle or apply open/close markers around a textarea selection. */
export function wrapSelectionMarkers(value, start, end, open, close) {
  const v = String(value ?? '');
  const a = Math.max(0, start | 0);
  const b = Math.max(a, end | 0);
  const selected = v.slice(a, b);
  if (
    a >= open.length &&
    v.slice(a - open.length, a) === open &&
    v.slice(b, b + close.length) === close
  ) {
    return {
      value: v.slice(0, a - open.length) + selected + v.slice(b + close.length),
      start: a - open.length,
      end: b - open.length,
    };
  }
  if (
    selected.startsWith(open) &&
    selected.endsWith(close) &&
    selected.length >= open.length + close.length
  ) {
    const inner = selected.slice(open.length, selected.length - close.length);
    return { value: v.slice(0, a) + inner + v.slice(b), start: a, end: a + inner.length };
  }
  return {
    value: v.slice(0, a) + open + selected + close + v.slice(b),
    start: a + open.length,
    end: b + open.length,
  };
}

/** Runnable: node --input-type=module -e "import('./js/desc-format.js').then(m=>m._selfCheck())" */
export function _selfCheck() {
  const bold = descPreviewInnerHTML('say **hi** there');
  if (!bold.includes('<strong>hi</strong>')) throw new Error('bold failed: ' + bold);
  const ital = descPreviewInnerHTML('say *hi* there');
  if (!ital.includes('<em>hi</em>')) throw new Error('italic failed: ' + ital);
  const ul = descPreviewInnerHTML('- one\n- two');
  if (!ul.includes('<ul class="task-desc-list">') || !ul.includes('<li>one</li>')) {
    throw new Error('ul failed: ' + ul);
  }
  const ol = descPreviewInnerHTML('1. a\n2. b');
  if (!ol.includes('<ol class="task-desc-list">') || !ol.includes('<li>a</li>')) {
    throw new Error('ol failed: ' + ol);
  }
  const link = descPreviewInnerHTML('see https://example.com ok');
  if (!link.includes('task-desc-link') || !link.includes('https://example.com')) {
    throw new Error('link failed: ' + link);
  }
  const wrap = wrapSelectionMarkers('hello', 0, 5, '**', '**');
  if (wrap.value !== '**hello**' || wrap.start !== 2 || wrap.end !== 7) {
    throw new Error('wrap failed: ' + JSON.stringify(wrap));
  }
  const unwrap = wrapSelectionMarkers('**hello**', 2, 7, '**', '**');
  if (unwrap.value !== 'hello') throw new Error('unwrap failed: ' + JSON.stringify(unwrap));
  console.log('desc-format self-check: ok');
}
