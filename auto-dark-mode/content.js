(function () {
  const STYLE_ID = 'auto-dark-mode-style';

  const DEFAULTS = {
    enabled: true,
    filterStrength: 100,
    forceMode: false,
    excludedSites: [],
  };

  let settings = { ...DEFAULTS };

  function pageNativelySupportsDarkMode() {
    const meta = document.querySelector('meta[name="color-scheme"]');
    if (meta?.getAttribute('content')?.includes('dark')) return true;

    for (const sheet of document.styleSheets) {
      try {
        if (hasDarkMediaRule(sheet.cssRules)) return true;
      } catch (_) { /* cross-origin stylesheet */ }
    }
    return false;
  }

  function hasDarkMediaRule(rules) {
    if (!rules) return false;
    for (const rule of rules) {
      if (rule instanceof CSSMediaRule) {
        const media = rule.conditionText ?? rule.media?.mediaText ?? '';
        if (media.includes('prefers-color-scheme') && media.includes('dark')) return true;
      }
    }
    return false;
  }

  function applyDark(strength) {
    const inv = strength / 100;
    let style = document.getElementById(STYLE_ID);
    if (!style) {
      style = document.createElement('style');
      style.id = STYLE_ID;
      document.head.appendChild(style);
    }
    style.textContent = `
      html { filter: invert(${inv}) hue-rotate(180deg) !important; }
      img, video, picture, canvas, iframe {
        filter: invert(${inv}) hue-rotate(180deg) !important;
      }
    `;
  }

  function removeDark() {
    document.getElementById(STYLE_ID)?.remove();
  }

  function evaluate() {
    const { enabled, filterStrength, forceMode, excludedSites } = settings;

    if (!enabled) { removeDark(); return; }

    const hostname = location.hostname;
    if (excludedSites.some(s => hostname === s || hostname.endsWith('.' + s))) {
      removeDark(); return;
    }

    const isDarkOS = window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (!isDarkOS) { removeDark(); return; }

    if (!forceMode && pageNativelySupportsDarkMode()) { removeDark(); return; }

    applyDark(filterStrength);
  }

  chrome.storage.sync.get(DEFAULTS, (stored) => {
    settings = stored;
    evaluate();
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'sync') return;
    for (const [key, { newValue }] of Object.entries(changes)) {
      settings[key] = newValue;
    }
    evaluate();
  });

  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', evaluate);
})();
