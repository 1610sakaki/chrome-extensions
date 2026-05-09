const DEFAULTS = {
  enabled: true,
  filterStrength: 100,
  forceMode: false,
  excludedSites: [],
};

let currentHostname = '';

function getSettings() {
  return new Promise(resolve => chrome.storage.sync.get(DEFAULTS, resolve));
}

function saveSettings(patch) {
  return new Promise(resolve => chrome.storage.sync.set(patch, resolve));
}

function getCurrentHostname() {
  return new Promise(resolve => {
    chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
      try {
        resolve(new URL(tabs[0]?.url || '').hostname);
      } catch {
        resolve('');
      }
    });
  });
}

function renderExcludedList(excludedSites) {
  const list = document.getElementById('excludedList');
  list.innerHTML = '';
  excludedSites.forEach(site => {
    const li = document.createElement('li');
    li.innerHTML = `<span>${site}</span><button class="btn-remove" data-site="${site}">×</button>`;
    list.appendChild(li);
  });
  list.querySelectorAll('.btn-remove').forEach(btn => {
    btn.addEventListener('click', async () => {
      const s = await getSettings();
      await saveSettings({ excludedSites: s.excludedSites.filter(x => x !== btn.dataset.site) });
      init();
    });
  });
}

async function init() {
  const [s, hostname] = await Promise.all([getSettings(), getCurrentHostname()]);
  currentHostname = hostname;

  document.getElementById('enabled').checked = s.enabled;

  const slider = document.getElementById('filterStrength');
  slider.value = s.filterStrength;
  document.getElementById('strengthValue').textContent = s.filterStrength + '%';

  document.getElementById('forceMode').checked = s.forceMode;

  document.getElementById('currentHostname').textContent = hostname || '-';

  const btn = document.getElementById('btnToggleExclude');
  const isExcluded = hostname && s.excludedSites.includes(hostname);
  btn.textContent = isExcluded ? '除外を解除' : 'このサイトを除外';
  btn.classList.toggle('excluded', isExcluded);
  btn.disabled = !hostname;

  renderExcludedList(s.excludedSites);
}

document.addEventListener('DOMContentLoaded', () => {
  init();

  document.getElementById('enabled').addEventListener('change', e => {
    saveSettings({ enabled: e.target.checked });
  });

  document.getElementById('filterStrength').addEventListener('input', e => {
    const val = parseInt(e.target.value);
    document.getElementById('strengthValue').textContent = val + '%';
    saveSettings({ filterStrength: val });
  });

  document.getElementById('forceMode').addEventListener('change', e => {
    saveSettings({ forceMode: e.target.checked });
  });

  document.getElementById('btnToggleExclude').addEventListener('click', async () => {
    const s = await getSettings();
    const isExcluded = s.excludedSites.includes(currentHostname);
    const updated = isExcluded
      ? s.excludedSites.filter(x => x !== currentHostname)
      : [...s.excludedSites, currentHostname];
    await saveSettings({ excludedSites: updated });
    init();
  });
});
