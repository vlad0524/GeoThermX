/* GeoThermX configuration — the only file you need to edit to switch on the feedback form and usage statistics.
   Both services are free and work on GitHub Pages (no server needed). Leave a value empty to keep that feature off. */
window.GX_CONFIG = {
  /* Feedback / pilot form — create a free form at https://formspree.io and paste its ID (the part after /f/, e.g. 'xyzabcd').
     Submissions arrive in your email and in the Formspree dashboard. */
  formspreeId: '',

  /* Fallback when formspreeId is empty: the form opens the visitor's email app addressed to this inbox.
     Leave empty to hide the email fallback (the form then explains it is not connected yet). */
  contactEmail: '',

  /* Usage statistics — create a free counter at https://www.goatcounter.com and paste its code
     (for https://geothermx.goatcounter.com the code is 'geothermx'). Counts page views and in-app events
     (project created, report generated, map opened, form sent). No cookies, no personal data. */
  goatcounter: '',

  /* Optional: link to your public GoatCounter dashboard (Settings → "Allow public access" in GoatCounter).
     Shown on the Feedback page as independent, verifiable usage numbers. */
  publicStatsUrl: ''
};
