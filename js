
"use strict";

// ========================================
// きょうの３つ Ver.1.0
// ========================================

const STORAGE_KEY = "kyouno3_v1_records";
const BACKUP_APP = "kyouno3";
const MAX_TASKS = 6;
const MAX_TEXT = 100;
const MAX_BACKUP_BYTES = 2 * 1024 * 1024;

let records = {};
let currentDate = getLocalDate();
let toastTimer = null;
let celebrationTimer = null;

// ========================================
// 日付
// ========================================

function getLocalDate() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function validDate(value) {
  if (typeof value !== "string") return false;

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;

  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);

  if (y < 2000 || y > 9999) return false;

  const date = new Date(0);
  date.setFullYear(y, m - 1, d);
  date.setHours(12, 0, 0, 0);

  return date.getFullYear() === y &&
    date.getMonth() === m - 1 &&
    date.getDate() === d;
}

function formatDate(value) {
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(0);
  date.setFullYear(y, m - 1, d);
  date.setHours(12, 0, 0, 0);

  const weekdays = [
    "日", "月", "火", "水", "木", "金", "土"
  ];

  return `${y}年${m}月${d}日 ` +
    `${weekdays[date.getDay()]}曜日`;
}

function checkDateChange() {
  const today = getLocalDate();

  if (today !== currentDate) {
    currentDate = today;
    renderAll();
  }
}

// ========================================
// データの検証
// ========================================

function isPlainObject(value) {
  return value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype;
}

function validateRecords(data) {
  if (!isPlainObject(data)) {
    throw new Error("記録の形式が正しくありません。");
  }

  const dates = Object.keys(data);

  if (dates.length > 10000) {
    throw new Error("記録の日数が多すぎます。");
  }

  let totalTasks = 0;

  for (const date of dates) {
    if (!validDate(date) || date > getLocalDate()) {
      throw new Error("日付に不正な値があります。");
    }

    const tasks = data[date];

    if (!Array.isArray(tasks) ||
        tasks.length > MAX_TASKS ||
        tasks.length === 0) {
      throw new Error("タスク数が不正です。");
    }

    const ids = new Set();

    for (const task of tasks) {
      if (!isPlainObject(task) ||
          Object.keys(task).length !== 3 ||
          typeof task.id !== "string" ||
          task.id.length < 1 ||
          task.id.length > 100 ||
          typeof task.text !== "string" ||
          task.text.length > MAX_TEXT ||
          !task.text.trim() ||
          typeof task.done !== "boolean" ||
          !Object.hasOwn(task, "id") ||
          !Object.hasOwn(task, "text") ||
          !Object.hasOwn(task, "done")) {
        throw new Error("タスク内容が不正です。");
      }

      if (ids.has(task.id)) {
        throw new Error("タスクIDが重複しています。");
      }

      ids.add(task.id);
      totalTasks++;
    }
  }

  if (totalTasks > 60000) {
    throw new Error("タスク数が多すぎます。");
  }

  return true;
}

// ========================================
// 保存と読み込み
// ========================================

function loadRecords() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);

    if (raw === null) return {};

    const parsed = JSON.parse(raw);
    validateRecords(parsed);

    return parsed;
  } catch (error) {
    console.error("読み込みエラー:", error);
    alert(
      "保存データを読み込めませんでした。\n" +
      "既存データを保護するため、" +
      "この画面では編集を停止します。"
    );

    throw error;
  }
}

function saveRecords(nextRecords) {
  try {
    validateRecords(nextRecords);
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(nextRecords)
    );

    records = nextRecords;
    return true;
  } catch (error) {
    console.error("保存エラー:", error);

    alert(
      "記録を保存できませんでした。\n" +
      "Safariの保存容量や設定を確認してください。" +
      "\n今回の変更は反映していません。"
    );

    return false;
  }
}

function cloneRecords() {
  return JSON.parse(JSON.stringify(records));
}

function makeId() {
  if (globalThis.crypto &&
      typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return Date.now().toString(36) +
    "-" + Math.random().toString(36).slice(2);
}

function getTodayTasks() {
  return records[currentDate] || [];
}

function updateToday(tasks) {
  const next = cloneRecords();

  if (tasks.length === 0) {
    delete next[currentDate];
  } else {
    next[currentDate] = tasks;
  }

  return saveRecords(next);
}

// ========================================
// 通知とお祝い
// ========================================

function showToast(message) {
  const toast = document.getElementById("toast");

  clearTimeout(toastTimer);
  toast.textContent = message;
  toast.hidden = false;

  toastTimer = setTimeout(() => {
    toast.hidden = true;
  }, 2500);
}

function showCelebration() {
  const element = document.getElementById(
    "celebration"
  );

  clearTimeout(celebrationTimer);
  element.hidden = true;

  // アニメーションを毎回再スタート
  void element.offsetWidth;
  element.hidden = false;

  celebrationTimer = setTimeout(() => {
    element.hidden = true;
  }, 1500);
}

// ========================================
// タスク操作
// ========================================

function addTask(event) {
  event.preventDefault();
  checkDateChange();

  const input = document.getElementById("taskInput");
  const text = input.value.trim();
  const tasks = getTodayTasks();

  if (!text) {
    showToast("タスクを入力してね ♡");
    return;
  }

  if (text.length > MAX_TEXT) {
    showToast("100文字以内で入力してね");
    return;
  }

  if (tasks.length >= MAX_TASKS) {
    showToast("タスクは最大6つまでです");
    return;
  }

  const nextTasks = [
    ...tasks,
    {
      id: makeId(),
      text,
      done: false
    }
  ];

  if (updateToday(nextTasks)) {
    input.value = "";
    renderAll();
    showToast("タスクを追加しました ♡");
  }
}

function toggleTask(id) {
  checkDateChange();

  const tasks = getTodayTasks();
  const target = tasks.find(task => task.id === id);

  if (!target) return;

  const nextTasks = tasks.map(task => (
    task.id === id
      ? { ...task, done: !task.done }
      : task
  ));

  if (updateToday(nextTasks)) {
    renderAll();

    if (!target.done) {
      showCelebration();
    }
  }
}

function editTask(id) {
  checkDateChange();

  const tasks = getTodayTasks();
  const target = tasks.find(task => task.id === id);

  if (!target) return;

  const result = prompt(
    "タスクを編集してください（100文字以内）",
    target.text
  );

  if (result === null) return;

  const text = result.trim();

  if (!text || text.length > MAX_TEXT) {
    showToast(
      "1〜100文字で入力してください"
    );
    return;
  }

  const nextTasks = tasks.map(task => (
    task.id === id
      ? { ...task, text }
      : task
  ));

  if (updateToday(nextTasks)) {
    renderAll();
    showToast("タスクを変更しました");
  }
}

function deleteTask(id) {
  checkDateChange();

  const tasks = getTodayTasks();
  const target = tasks.find(task => task.id === id);

  if (!target) return;

  const confirmed = confirm(
    `「${target.text}」を削除しますか？\n` +
    "この操作は取り消せません。"
  );

  if (!confirmed) return;

  const nextTasks = tasks.filter(
    task => task.id !== id
  );

  if (updateToday(nextTasks)) {
    renderAll();
    showToast("タスクを削除しました");
  }
}

// ========================================
// 今日の画面
// ========================================

function renderToday() {
  document.getElementById("todayDate").textContent =
    formatDate(currentDate);

  const tasks = getTodayTasks();
  const list = document.getElementById("taskList");

  list.replaceChildren();

  for (const task of tasks) {
    const li = document.createElement("li");
    li.className = "task-item";

    if (task.done) {
      li.classList.add("completed");
    }

    const check = document.createElement("button");
    check.type = "button";
    check.className = "check-button";
    check.textContent = task.done ? "✓" : "";
    check.setAttribute(
      "aria-label",
      task.done
        ? `${task.text}を未完了に戻す`
        : `${task.text}を完了する`
    );
    check.setAttribute("aria-pressed", String(task.done));
    check.addEventListener(
      "click",
      () => toggleTask(task.id)
    );

    const text = document.createElement("span");
    text.className = "task-text";
    text.textContent = task.text;

    const edit = document.createElement("button");
    edit.type = "button";
    edit.className = "icon-button";
    edit.textContent = "✎";
    edit.setAttribute(
      "aria-label",
      `${task.text}を編集`
    );
    edit.addEventListener(
      "click",
      () => editTask(task.id)
    );

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "icon-button";
    remove.textContent = "×";
    remove.setAttribute(
      "aria-label",
      `${task.text}を削除`
    );
    remove.addEventListener(
      "click",
      () => deleteTask(task.id)
    );

    li.append(check, text, edit, remove);
    list.appendChild(li);
  }

  const completed = tasks.filter(
    task => task.done
  ).length;

  const percent = tasks.length
    ? Math.round(completed / tasks.length * 100)
    : 0;

  document.getElementById("progressText")
    .textContent = `${completed} / ${tasks.length} 達成`;

  document.getElementById("progressBar")
    .style.width = `${percent}%`;

  document.getElementById("progressTrack")
    .setAttribute("aria-valuenow", String(percent));

  document.getElementById("emptyMessage")
    .hidden = tasks.length > 0;

  document.getElementById("taskCount")
    .textContent = `${tasks.length} / ${MAX_TASKS} 件登録中`;

  const full = tasks.length >= MAX_TASKS;

  document.getElementById("taskInput").disabled = full;
  document.getElementById("addButton").disabled = full;
}

// ========================================
// 過去の記録
// ========================================

function renderHistory() {
  const container = document.getElementById(
    "historyList"
  );

  container.replaceChildren();

  const dates = Object.keys(records)
    .filter(date => date < currentDate &&
      records[date].length > 0)
    .sort()
    .reverse();

  if (dates.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty";
    empty.textContent =
      "まだ過去の記録はありません ♡";
    container.appendChild(empty);
    return;
  }

  for (const date of dates) {
    const tasks = records[date];
    const done = tasks.filter(
      task => task.done
    ).length;

    const details = document.createElement("details");
    details.className = "history-day";

    const summary = document.createElement("summary");
    summary.textContent = formatDate(date) + " ";

    const count = document.createElement("span");
    count.textContent = `${done} / ${tasks.length} 達成`;
    summary.appendChild(count);

    const ul = document.createElement("ul");
    ul.className = "history-tasks";

    for (const task of tasks) {
      const li = document.createElement("li");
      li.textContent =
        (task.done ? "✓ " : "○ ") + task.text;

      if (task.done) {
        li.className = "done";
      }

      ul.appendChild(li);
    }

    details.append(summary, ul);
    container.appendChild(details);
  }
}

// ========================================
// 画面切り替え
// ========================================

function switchPage(pageName) {
  checkDateChange();

  document.querySelectorAll(".page").forEach(page => {
    page.hidden = page.id !== pageName;
  });

  document.querySelectorAll(".tab").forEach(tab => {
    const active = tab.dataset.page === pageName;
    tab.classList.toggle("active", active);

    if (active) {
      tab.setAttribute("aria-current", "page");
    } else {
      tab.removeAttribute("aria-current");
    }
  });

  if (pageName === "history") {
    renderHistory();
  }
}

function renderAll() {
  renderToday();
  renderHistory();
}

// ========================================
// JSONバックアップ
// ========================================

function downloadBackup() {
  checkDateChange();

  const backup = {
    app: BACKUP_APP,
    version: 1,
    exportedAt: new Date().toISOString(),
    records: cloneRecords()
  };

  const json = JSON.stringify(backup, null, 2);
  const blob = new Blob(
    [json],
    { type: "application/json" }
  );

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download =
    `kyouno3-backup-${getLocalDate()}.json`;

  document.body.appendChild(link);
  link.click();
  link.remove();

  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 60000);

  showToast(
    "保存先を確認してバックアップを保管してね"
  );
}

// ========================================
// JSON復元
// ========================================

async function restoreBackup(event) {
  const input = event.target;
  const file = input.files?.[0];

  if (!file) return;

  try {
    if (file.size > MAX_BACKUP_BYTES) {
      throw new Error(
        "ファイルが大きすぎます。"
      );
    }

    const content = await file.text();
    const backup = JSON.parse(content);

    if (!isPlainObject(backup) ||
        backup.app !== BACKUP_APP ||
        backup.version !== 1 ||
        typeof backup.exportedAt !== "string" ||
        !Number.isFinite(Date.parse(backup.exportedAt))) {
      throw new Error(
        "対応していないバックアップ形式です。"
      );
    }

    validateRecords(backup.records);

    checkDateChange();

    // 既存データを優先する
    const next = cloneRecords();
    let addedDays = 0;

    for (const [date, tasks] of
      Object.entries(backup.records)) {
      if (!Object.hasOwn(next, date)) {
        next[date] = tasks;
        addedDays++;
      }
    }

    if (addedDays === 0) {
      showToast(
        "追加できる新しい日付の記録はありません"
      );
      return;
    }

    validateRecords(next);

    const firstConfirm = confirm(
      `新しい日付の記録が${addedDays}日分あります。\n` +
      "同じ日付は現在の記録を優先します。\n\n" +
      "復元前に現在の記録をバックアップしましたか？"
    );

    if (!firstConfirm) return;

    const secondConfirm = confirm(
      `${addedDays}日分の記録を統合しますか？\n` +
      "現在の記録は残ります。"
    );

    if (!secondConfirm) return;

    // 確認中に日付が変わっても再検証する
    validateRecords(next);

    if (saveRecords(next)) {
      renderAll();
      showToast(
        `${addedDays}日分の記録を復元しました`
      );
    }

  } catch (error) {
    console.error("復元エラー:", error);
    alert(
      "復元できませんでした。\n" +
      error.message +
      "\n既存の記録は変更していません。"
    );
  } finally {
    input.value = "";
  }
}

// ========================================
// 初期化
// ========================================

function initialize() {
  try {
    records = loadRecords();
  } catch (error) {
    // 読み込めない既存データを上書きしない
    document.querySelectorAll(
      "button, input"
    ).forEach(element => {
      element.disabled = true;
    });
    return;
  }

  document.getElementById("taskForm")
    .addEventListener("submit", addTask);

  document.querySelectorAll(".tab")
    .forEach(tab => {
      tab.addEventListener("click", () => {
        switchPage(tab.dataset.page);
      });
    });

  document.getElementById("backupButton")
    .addEventListener("click", downloadBackup);

  document.getElementById("restoreInput")
    .addEventListener("change", restoreBackup);

  document.addEventListener(
    "visibilitychange",
    () => {
      if (!document.hidden) {
        checkDateChange();
      }
    }
  );

  window.addEventListener(
    "focus",
    checkDateChange
  );

  // 開いたまま日付が変わった場合も確認
  setInterval(checkDateChange, 30000);

  renderAll();
}

document.addEventListener(
  "DOMContentLoaded",
  initialize
);
