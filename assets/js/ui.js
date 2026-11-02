/* GeoThermX UI helpers: formatting, animation, toasts, modals, tooltips, SVG charts, exports. */
(function () {
  'use strict';
  const U = {};

  U.$ = (sel, root) => (root || document).querySelector(sel);
  U.$$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
  U.esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  U.clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  /* ---- formatting ---- */
  U.money = (v, d) => { if (!isFinite(v)) return '—'; const neg = v < 0; v = Math.abs(v); return (neg ? '-$' : '$') + v.toLocaleString('en-US', { maximumFractionDigits: d || 0, minimumFractionDigits: d || 0 }); };
  U.moneyK = v => { if (!isFinite(v)) return '—'; const a = Math.abs(v); const s = v < 0 ? '-' : ''; if (a >= 1e6) return s + '$' + (a / 1e6).toFixed(2) + 'M'; if (a >= 1e3) return s + '$' + (a / 1e3).toFixed(a >= 1e5 ? 0 : 1) + 'K'; return s + '$' + a.toFixed(0); };
  U.n = (v, d) => isFinite(v) ? Number(v).toLocaleString('en-US', { maximumFractionDigits: d || 0, minimumFractionDigits: d || 0 }) : '—';
  U.pct = (v, d) => isFinite(v) ? Number(v).toFixed(d == null ? 1 : d) + '%' : '—';
  U.signed = (v, d, suf) => (v >= 0 ? '+' : '') + Number(v).toFixed(d == null ? 1 : d) + (suf || '');
  U.date = iso => { const d = new Date(iso.length === 10 ? iso + 'T12:00:00' : iso); return d.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }); };
  U.today = () => new Date().toISOString().slice(0, 10);
  U.time = d => (d || new Date()).toTimeString().slice(0, 8);
  U.stamp = iso => iso.replace('T', ' ').slice(0, 19);

  /* ---- animated numbers: <span data-count="123.4" data-fmt="money|n1|pct1|..."> ---- */
  const FMT = {
    money: v => U.money(v), moneyK: v => U.moneyK(v), n0: v => U.n(v, 0), n1: v => U.n(v, 1), n2: v => U.n(v, 2),
    pct0: v => U.n(v, 0) + '%', pct1: v => U.n(v, 1) + '%', raw: v => String(Math.round(v))
  };
  U.fmt = (v, f) => (FMT[f] || FMT.n0)(v);
  U.animateNumbers = (root, fromMap) => {
    U.$$('[data-count]', root).forEach(el => {
      const to = parseFloat(el.dataset.count); const f = el.dataset.fmt || 'n0';
      const key = el.dataset.key;
      let from = key && fromMap && key in fromMap ? fromMap[key] : (el.dataset.from != null ? parseFloat(el.dataset.from) : to * 0.0);
      if (!isFinite(to)) { el.textContent = '—'; return; }
      if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) from = to;
      const t0 = performance.now(), dur = from === to ? 0 : 700;
      el.textContent = U.fmt(from, f);
      const step = t => {
        const k = dur ? Math.min(1, (t - t0) / dur) : 1; const e = 1 - Math.pow(1 - k, 3);
        el.textContent = U.fmt(from + (to - from) * e, f);
        if (k < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
      if (key && fromMap && fromMap[key] !== undefined && Math.abs(fromMap[key] - to) > 1e-9) { el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash'); }
    });
  };
  U.count = (v, fmt, key) => `<span data-count="${v}" data-fmt="${fmt || 'n0'}"${key ? ` data-key="${key}"` : ''}>${U.fmt(v, fmt)}</span>`;

  /* ---- toasts ---- */
  U.toast = (msg, kind) => {
    let wrap = U.$('.toasts'); if (!wrap) { wrap = document.createElement('div'); wrap.className = 'toasts'; document.body.appendChild(wrap); }
    const t = document.createElement('div'); t.className = 'toast ' + (kind || '');
    t.innerHTML = `<span class="ti">${kind === 'warn' ? '!' : kind === 'err' ? '×' : '✓'}</span><div>${msg}</div>`;
    wrap.appendChild(t);
    setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 260); }, 3400);
  };

  /* ---- modal ---- */
  U.modal = ({ title, body, actions, wide, onMount }) => {
    const s = document.createElement('div'); s.className = 'scrim';
    s.innerHTML = `<div class="modal ${wide ? 'wide' : ''}" role="dialog" aria-modal="true" aria-label="${U.esc(title)}">
      <div class="modal-h"><h3>${U.esc(title)}</h3><button class="modal-x" aria-label="Close">×</button></div>
      <div class="modal-b">${body}</div>
      <div class="modal-f"></div></div>`;
    const close = () => { s.remove(); document.removeEventListener('keydown', esc); };
    const esc = e => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', esc);
    s.addEventListener('mousedown', e => { if (e.target === s) close(); });
    U.$('.modal-x', s).onclick = close;
    const f = U.$('.modal-f', s);
    (actions || [{ label: 'Close', kind: 'ghost' }]).forEach(a => {
      const b = document.createElement('button'); b.className = 'btn btn-' + (a.kind || 'ghost'); b.textContent = a.label;
      b.onclick = () => { const r = a.onClick ? a.onClick(s) : undefined; if (r !== false) close(); };
      f.appendChild(b);
    });
    document.body.appendChild(s);
    const first = U.$('input,select,textarea', s); if (first) setTimeout(() => first.focus(), 50);
    if (onMount) onMount(s, close);
    return { el: s, close };
  };

  /* ---- export (download where allowed + always copyable) ---- */
  U.exportData = (title, filename, text, mime) => {
    let downloaded = false;
    try {
      const blob = new Blob([text], { type: mime || 'text/plain' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename;
      document.body.appendChild(a); a.click(); a.remove(); downloaded = true;
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    } catch (e) { downloaded = false; }
    U.modal({
      title, wide: true,
      body: `<div class="muted" style="font-size:13px">${downloaded ? `<b>${U.esc(filename)}</b> was sent to your browser's downloads. If nothing was saved (some embedded viewers block downloads), copy the data below.` : 'Copy the data below.'}</div><div class="code-box" id="export-box">${U.esc(text)}</div>`,
      actions: [{ label: 'Copy to clipboard', kind: 'primary', onClick: () => { U.copy(text); return false; } }, { label: 'Close', kind: 'ghost' }]
    });
  };
  U.copy = text => {
    const done = () => U.toast('Copied to clipboard');
    try {
      navigator.clipboard.writeText(text).then(done, () => fallback());
    } catch (e) { fallback(); }
    function fallback() {
      const ta = document.createElement('textarea'); ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); done(); } catch (e) { U.toast('Select the text and press Ctrl+C to copy', 'warn'); }
      ta.remove();
    }
  };
  U.csv = rows => rows.map(r => r.map(c => { const s = String(c == null ? '' : c); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }).join(',')).join('\n');

  /* ---- tooltip ---- */
  let tipEl;
  U.tip = (html, x, y) => {
    if (!tipEl) { tipEl = document.createElement('div'); tipEl.className = 'tip'; document.body.appendChild(tipEl); }
    if (html == null) { tipEl.classList.remove('show'); return; }
    tipEl.innerHTML = html; tipEl.style.left = x + 'px'; tipEl.style.top = y + 'px'; tipEl.classList.add('show');
  };

  /* ---- SVG chart builders ---- */
  U.smooth = (pts, tension) => {
    if (pts.length < 2) return '';
    const t = tension == null ? 0.18 : tension;
    let d = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
      const c1x = p1[0] + (p2[0] - p0[0]) * t, c1y = p1[1] + (p2[1] - p0[1]) * t;
      const c2x = p2[0] - (p3[0] - p1[0]) * t, c2y = p2[1] - (p3[1] - p1[1]) * t;
      d += ` C${c1x.toFixed(1)},${c1y.toFixed(1)} ${c2x.toFixed(1)},${c2y.toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
    }
    return d;
  };
  U.linePath = pts => pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ');
  U.scale = (d0, d1, r0, r1) => v => r0 + (v - d0) / ((d1 - d0) || 1) * (r1 - r0);
  U.pathLen = d => { try { const p = document.createElementNS('http://www.w3.org/2000/svg', 'path'); p.setAttribute('d', d); return p.getTotalLength(); } catch (e) { return 2000; } };

  /* Attach hover tooltips to [data-tip] elements inside root */
  U.bindTips = root => {
    U.$$('[data-tip]', root).forEach(el => {
      el.addEventListener('mousemove', e => U.tip(el.dataset.tip, e.clientX, e.clientY));
      el.addEventListener('mouseleave', () => U.tip(null));
    });
  };

  /* Crosshair hover for line charts. series: [{values, fmt, name}] */
  U.bindLineHover = (svg, xs, label, series, opts) => {
    const o = opts || {};
    const vb = svg.viewBox.baseVal;
    const guide = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    guide.setAttribute('y1', o.top || 0); guide.setAttribute('y2', vb.height - (o.bottom || 0));
    guide.setAttribute('stroke', '#94a3b8'); guide.setAttribute('stroke-dasharray', '3 3'); guide.style.opacity = 0;
    svg.appendChild(guide);
    const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    dot.setAttribute('r', 4.5); dot.setAttribute('fill', '#fff'); dot.setAttribute('stroke', o.color || '#14b8a6'); dot.setAttribute('stroke-width', 2.5); dot.style.opacity = 0;
    svg.appendChild(dot);
    svg.addEventListener('mousemove', e => {
      const r = svg.getBoundingClientRect(); const x = (e.clientX - r.left) / r.width * vb.width;
      let best = 0; xs.forEach((v, i) => { if (Math.abs(v - x) < Math.abs(xs[best] - x)) best = i; });
      guide.setAttribute('x1', xs[best]); guide.setAttribute('x2', xs[best]); guide.style.opacity = 1;
      if (o.ys) { dot.setAttribute('cx', xs[best]); dot.setAttribute('cy', o.ys[best]); dot.style.opacity = 1; }
      U.tip(`<div style="opacity:.75;margin-bottom:2px">${label(best)}</div>` + series.map(s => `${s.name}: <b>${s.fmt(s.values[best])}</b>`).join('<br>'), e.clientX, e.clientY);
    });
    svg.addEventListener('mouseleave', () => { guide.style.opacity = 0; dot.style.opacity = 0; U.tip(null); });
  };

  /* simple icon set (stroke icons) */
  U.icon = {
    menu: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 6h16M4 12h16M4 18h16"/></svg>',
    spark: '✦',
    plus: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 5v14M5 12h14"/></svg>',
    check: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M5 12l5 5L20 7"/></svg>',
    arrowR: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
    up: '↑', down: '↓'
  };

  window.GXUI = U;
})();
