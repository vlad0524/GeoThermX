/* GeoThermX services: anonymous usage statistics (GoatCounter) and the feedback / pilot form (Formspree or email).
   Everything is switched on from assets/js/config.js — nothing loads until a code is entered there. */
(function () {
  'use strict';
  const C = window.GX_CONFIG || {};
  const GX = window.GX = window.GX || {};

  /* ---------- Usage statistics ---------- */
  const gcCode = String(C.goatcounter || '').trim().replace(/[^a-z0-9-]/gi, '');
  GX.statsOn = !!gcCode;
  if (gcCode && typeof document !== 'undefined') {
    window.goatcounter = { no_onload: true, allow_local: false };   // page views are sent by the router (hash pages)
    const sc = document.createElement('script');
    sc.async = true; sc.src = 'https://gc.zgo.at/count.js';
    sc.setAttribute('data-goatcounter', `https://${gcCode}.goatcounter.com/count`);
    document.head.appendChild(sc);
  }
  const queue = [];
  function send(o) {
    if (!gcCode) return;
    if (window.goatcounter && typeof window.goatcounter.count === 'function') { try { window.goatcounter.count(o); } catch (e) { /* ignore */ } }
    else if (queue.length < 30) queue.push(o);
  }
  setInterval(() => { if (queue.length && window.goatcounter && window.goatcounter.count) queue.splice(0).forEach(send); }, 1500);

  /* Page view for hash routes: /#costs → path "/costs" */
  GX.trackPage = (id, title) => send({ path: '/' + (id || 'home'), title: title || id });
  /* In-app events, e.g. GX.track('project-created', 'Residential · MN') */
  GX.track = (name, title) => send({ path: 'event/' + name, title: title || name, event: true });

  /* ---------- Feedback / pilot form ---------- */
  GX.formMode = () => C.formspreeId ? 'formspree' : C.contactEmail ? 'email' : 'off';
  GX.publicStatsUrl = () => /^https:\/\//.test(C.publicStatsUrl || '') ? C.publicStatsUrl : '';
  GX.sendFeedback = async data => {
    const mode = GX.formMode();
    if (mode === 'formspree') {
      const res = await fetch('https://formspree.io/f/' + encodeURIComponent(C.formspreeId), {
        method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(data)
      });
      if (!res.ok) { let msg = 'The form service returned an error.'; try { const j = await res.json(); if (j && j.errors && j.errors[0]) msg = j.errors[0].message; } catch (e) { } throw new Error(msg); }
      GX.track('feedback-sent', data.role || 'feedback');
      return 'sent';
    }
    if (mode === 'email') {
      const body = Object.entries(data).filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`).join('\n');
      location.href = `mailto:${C.contactEmail}?subject=${encodeURIComponent('GeoThermX — ' + (data.interest || 'feedback'))}&body=${encodeURIComponent(body)}`;
      GX.track('feedback-email', data.role || 'feedback');
      return 'email';
    }
    throw new Error('not-connected');
  };
})();
