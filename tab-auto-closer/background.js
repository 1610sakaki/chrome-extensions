const STORAGE_KEY_LAST_ACTIVE = "tabLastActive";
const STORAGE_KEY_SETTINGS = "settings";
const ALARM_NAME = "checkTabs";
const DEFAULT_THRESHOLD_MINUTES = 60;

async function getSettings() {
  const result = await chrome.storage.sync.get(STORAGE_KEY_SETTINGS);
  return result[STORAGE_KEY_SETTINGS] ?? {
    enabled: true,
    thresholdMinutes: DEFAULT_THRESHOLD_MINUTES,
  };
}

async function getLastActiveMap() {
  const result = await chrome.storage.local.get(STORAGE_KEY_LAST_ACTIVE);
  return result[STORAGE_KEY_LAST_ACTIVE] ?? {};
}

async function saveLastActiveMap(map) {
  await chrome.storage.local.set({ [STORAGE_KEY_LAST_ACTIVE]: map });
}

async function recordTabActive(tabId) {
  const map = await getLastActiveMap();
  map[tabId] = Date.now();
  await saveLastActiveMap(map);
}

async function removeTabRecord(tabId) {
  const map = await getLastActiveMap();
  delete map[tabId];
  await saveLastActiveMap(map);
}

// 起動時：既存タブの初期化 & アクティブタブを現在時刻で記録
async function initExistingTabs() {
  const map = await getLastActiveMap();
  const now = Date.now();
  const tabs = await chrome.tabs.query({});

  for (const tab of tabs) {
    if (!(tab.id in map)) {
      map[tab.id] = now;
    }
  }

  // 存在しないタブのレコードを削除
  const existingIds = new Set(tabs.map((t) => t.id));
  for (const id of Object.keys(map)) {
    if (!existingIds.has(Number(id))) {
      delete map[id];
    }
  }

  await saveLastActiveMap(map);
}

// アラームを設定（重複登録を防ぐ）
async function ensureAlarm() {
  const existing = await chrome.alarms.get(ALARM_NAME);
  if (!existing) {
    chrome.alarms.create(ALARM_NAME, { periodInMinutes: 1 });
  }
}

// 非アクティブタブを閉じるメイン処理
async function checkAndCloseTabs() {
  const settings = await getSettings();
  if (!settings.enabled) return;

  const thresholdMs = settings.thresholdMinutes * 60 * 1000;
  const now = Date.now();
  const map = await getLastActiveMap();

  // フォーカス中のウィンドウを取得
  const focusedWindows = await chrome.windows.getAll({ populate: false });
  const focusedWindowIds = new Set(
    focusedWindows
      .filter((w) => w.focused)
      .map((w) => w.id)
  );

  const tabs = await chrome.tabs.query({});
  const tabsToClose = [];

  for (const tab of tabs) {
    if (tab.pinned) continue;
    if (tab.active && focusedWindowIds.has(tab.windowId)) continue;

    const lastActive = map[tab.id];
    if (lastActive === undefined) continue;

    if (now - lastActive >= thresholdMs) {
      tabsToClose.push(tab.id);
    }
  }

  if (tabsToClose.length > 0) {
    await chrome.tabs.remove(tabsToClose);
  }
}

// イベントリスナー

chrome.runtime.onInstalled.addListener(async () => {
  await initExistingTabs();
  await ensureAlarm();
});

chrome.runtime.onStartup.addListener(async () => {
  await initExistingTabs();
  await ensureAlarm();
});

chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  await recordTabActive(tabId);
});

chrome.tabs.onCreated.addListener(async (tab) => {
  await recordTabActive(tab.id);
});

chrome.tabs.onRemoved.addListener(async (tabId) => {
  await removeTabRecord(tabId);
});

// ウィンドウフォーカス変更時、フォーカスされたウィンドウのアクティブタブを更新
chrome.windows.onFocusChanged.addListener(async (windowId) => {
  if (windowId === chrome.windows.WINDOW_ID_NONE) return;
  const tabs = await chrome.tabs.query({ windowId, active: true });
  if (tabs.length > 0) {
    await recordTabActive(tabs[0].id);
  }
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === ALARM_NAME) {
    await checkAndCloseTabs();
  }
});
