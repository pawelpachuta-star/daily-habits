import { createElement as h, useState, useEffect, useRef, Fragment } from 'https://esm.sh/react@18';
import { createRoot } from 'https://esm.sh/react-dom@18/client';
import htm from 'https://esm.sh/htm@3';
import * as db from './db.js';

const html = htm.bind(h);

// ── Constants ────────────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  excellent:   { label: 'Excellent',   color: '#16a34a', text: '#fff',     emoji: '🙂' },
  good:        { label: 'Good',        color: '#86efac', text: '#166534',  emoji: '' },
  not_great:   { label: 'Not great',   color: '#fde047', text: '#854d0e',  emoji: '' },
  bad:         { label: 'Bad',         color: '#ef4444', text: '#fff',     emoji: '' },
  not_entered: { label: 'Not entered', color: '#e5e7eb', text: '#6b7280',  emoji: '' },
};

const STATUSES = ['excellent', 'good', 'not_great', 'bad', 'not_entered'];
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// ── Utils ────────────────────────────────────────────────────────────────────

function toDateStr(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getTodayStr() { return toDateStr(new Date()); }

function getEditableSet() {
  const today = new Date();
  const set = new Set();
  for (let i = 0; i < 7; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    set.add(toDateStr(d));
  }
  return set;
}

function formatFull(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });
}

function monthOffset(year, month) {
  return (new Date(year, month, 1).getDay() + 6) % 7; // Mon = 0
}

function daysIn(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

let _toastId = 0;

// ── Toast ─────────────────────────────────────────────────────────────────────

function ToastContainer({ toasts, onRemove }) {
  return html`
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 flex flex-col gap-2 z-50 w-full max-w-sm px-4 pointer-events-none">
      ${toasts.map(t => html`
        <div key=${t.id}
          className="bg-gray-800 text-white rounded-xl px-4 py-3 text-sm shadow-lg flex items-center justify-between pointer-events-auto">
          <span>${t.msg}</span>
          <button onClick=${() => onRemove(t.id)} className="ml-3 text-gray-400 hover:text-white text-lg leading-none">✕</button>
        </div>
      `)}
    </div>
  `;
}

// ── StatusModal ───────────────────────────────────────────────────────────────

function StatusModal({ date, currentStatus, habitName, onSave, onClose }) {
  return html`
    <div
      className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-40 p-4"
      onClick=${e => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden">
        <div className="flex justify-between items-start p-4 pb-2">
          <div>
            <div className="font-semibold text-gray-900 text-base">${formatFull(date)}</div>
            <div className="text-sm text-gray-500 mt-0.5">${habitName}</div>
          </div>
          <button
            onClick=${onClose}
            className="text-gray-400 hover:text-gray-700 text-2xl leading-none ml-3 mt-0.5"
            aria-label="Close"
          >✕</button>
        </div>
        <div className="px-4 pb-4 pt-2 flex flex-col gap-2">
          ${STATUSES.map(status => {
            const cfg = STATUS_CONFIG[status];
            const selected = (currentStatus || 'not_entered') === status;
            return html`
              <button
                key=${status}
                onClick=${() => onSave(status)}
                className="w-full py-3.5 px-4 rounded-xl text-left font-medium flex items-center justify-between transition-all active:scale-95"
                style=${{
                  backgroundColor: cfg.color,
                  color: cfg.text,
                  outline: selected ? '2.5px solid #111827' : 'none',
                  outlineOffset: '2px',
                }}
              >
                <span>${cfg.emoji ? cfg.emoji + ' ' : ''}${cfg.label}</span>
                ${selected ? html`<span className="font-bold">✓</span>` : null}
              </button>
            `;
          })}
        </div>
      </div>
    </div>
  `;
}

// ── MonthGrid ─────────────────────────────────────────────────────────────────

function MonthGrid({ year, month, entries, editable, today, onDayClick }) {
  const offset = monthOffset(year, month);
  const count = daysIn(year, month);
  const label = new Date(year, month, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const cells = Array(offset).fill(null);
  for (let d = 1; d <= count; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  return html`
    <div id=${'month-' + year + '-' + month} className="mb-8">
      <h2 className="font-semibold text-gray-700 mb-2">${label}</h2>
      <div className="grid grid-cols-7 rounded-xl overflow-hidden border border-gray-200 gap-px bg-gray-200">
        ${WEEKDAYS.map(w => html`
          <div key=${w} className="bg-white text-center text-xs text-gray-400 font-medium py-1.5">${w}</div>
        `)}
        ${cells.map((day, i) => {
          if (!day) return html`<div key=${'e' + i} className="bg-white" style=${{ aspectRatio: '1' }} />`;
          const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const status = entries[dateStr] || 'not_entered';
          const cfg = STATUS_CONFIG[status];
          const isToday = dateStr === today;
          const isEditable = editable.has(dateStr);
          return html`
            <div
              key=${day}
              style=${{
                backgroundColor: cfg.color,
                aspectRatio: '1',
                boxShadow: isToday ? 'inset 0 0 0 2px #111827' : undefined,
                cursor: 'pointer',
              }}
              className="flex flex-col items-center justify-center select-none"
              onClick=${() => onDayClick(dateStr, isEditable)}
              role="button"
              tabIndex=${isEditable ? 0 : -1}
              onKeyDown=${e => e.key === 'Enter' && onDayClick(dateStr, isEditable)}
              aria-label=${`${dateStr} ${cfg.label}`}
            >
              <span className="text-xs font-semibold leading-none" style=${{ color: cfg.text }}>${day}</span>
              ${cfg.emoji ? html`<span className="text-base leading-none mt-0.5">${cfg.emoji}</span>` : null}
            </div>
          `;
        })}
      </div>
    </div>
  `;
}

// ── CalendarView ──────────────────────────────────────────────────────────────

const FLOOR_YEAR = 2026;
const FLOOR_MONTH = 3; // April (0-indexed)

function CalendarView({ entries, onDayClick, selectedYear }) {
  const today = getTodayStr();
  const editable = getEditableSet();
  const now = new Date();
  const curYear = now.getFullYear();
  const curMonth = now.getMonth();

  const startMonth = selectedYear > FLOOR_YEAR ? 0 : FLOOR_MONTH;
  const endMonth = selectedYear === curYear ? curMonth : 11;

  if (selectedYear < FLOOR_YEAR || endMonth < startMonth) {
    return html`
      <div className="px-4 py-16 text-center text-gray-400 text-sm">
        No data available for ${selectedYear}.
      </div>
    `;
  }

  const months = [];
  for (let m = endMonth; m >= startMonth; m--) {
    months.push({ year: selectedYear, month: m });
  }

  return html`
    <div className="px-4 pb-12">
      ${months.map(({ year, month }) => html`
        <${MonthGrid}
          key=${year + '-' + month}
          year=${year}
          month=${month}
          entries=${entries}
          editable=${editable}
          today=${today}
          onDayClick=${onDayClick}
        />
      `)}
    </div>
  `;
}

// ── HabitTabs ─────────────────────────────────────────────────────────────────

function HabitTabs({ habits, activeId, onSelect }) {
  return html`
    <div className="flex gap-1.5 px-3 py-2 overflow-x-auto no-scrollbar border-b border-gray-200 bg-white">
      ${habits.map(h => html`
        <button
          key=${h.id}
          onClick=${() => onSelect(h.id)}
          style=${{ maxWidth: '9rem' }}
          className=${'flex-shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ' +
            (h.id === activeId
              ? 'bg-green-600 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200')}
        >
          <span className="block truncate">${h.name}</span>
        </button>
      `)}
    </div>
  `;
}

// ── ManagementView ────────────────────────────────────────────────────────────

function ManagementView({ habits, onClose, onChange, onExport, onImport, toast }) {
  const [addName, setAddName] = useState('');
  const [renamingId, setRenamingId] = useState(null);
  const [renameVal, setRenameVal] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [importData, setImportData] = useState(null);
  const fileRef = useRef(null);
  const atCap = habits.length >= 5;

  async function add() {
    const name = addName.trim();
    if (!name) return;
    if (name.length > 40) { toast('Name must be 40 characters or fewer'); return; }
    const habit = { id: crypto.randomUUID(), name, createdAt: new Date().toISOString(), order: habits.length };
    await db.saveHabit(habit);
    setAddName('');
    onChange(habit.id);
  }

  async function rename(id) {
    const name = renameVal.trim();
    if (!name) return;
    if (name.length > 40) { toast('Name must be 40 characters or fewer'); return; }
    await db.saveHabit({ ...habits.find(h => h.id === id), name });
    setRenamingId(null);
    onChange(null);
  }

  async function doDelete(id) {
    await db.deleteHabit(id);
    const rest = habits.filter(h => h.id !== id);
    for (let i = 0; i < rest.length; i++) await db.saveHabit({ ...rest[i], order: i });
    setDeleteTarget(null);
    onChange(rest[0]?.id ?? null);
  }

  async function reorder(id, dir) {
    const idx = habits.findIndex(h => h.id === id);
    const next = idx + dir;
    if (next < 0 || next >= habits.length) return;
    const reordered = [...habits];
    [reordered[idx], reordered[next]] = [reordered[next], reordered[idx]];
    for (let i = 0; i < reordered.length; i++) await db.saveHabit({ ...reordered[i], order: i });
    onChange(null);
  }

  function pickFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const data = JSON.parse(ev.target.result);
        if (data.app !== 'daily-habits') throw new Error('Not a Daily Habits export file.');
        if (data.version !== 1) throw new Error(`Unsupported version ${data.version}. Expected version 1.`);
        setImportData(data);
      } catch (err) {
        toast('Import failed: ' + err.message);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  return html`
    <div className="fixed inset-0 bg-white z-30 overflow-y-auto">
      <div className="max-w-[480px] mx-auto pb-8">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-4 h-14 flex items-center justify-between z-10">
          <h1 className="text-lg font-semibold text-gray-900">Manage Habits</h1>
          <button onClick=${onClose} className="text-green-600 font-semibold text-sm">Done</button>
        </div>

        <div className="px-4 pt-4">
          ${habits.length === 0
            ? html`<p className="text-gray-400 text-sm text-center py-6">No habits yet.</p>`
            : habits.map((habit, idx) => html`
              <div key=${habit.id} className="flex items-center gap-2 py-2.5 border-b border-gray-100">
                ${renamingId === habit.id
                  ? html`
                    <input
                      className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
                      value=${renameVal}
                      maxLength=${40}
                      onChange=${e => setRenameVal(e.target.value)}
                      onKeyDown=${e => { if (e.key === 'Enter') rename(habit.id); if (e.key === 'Escape') setRenamingId(null); }}
                      autoFocus
                    />
                    <button onClick=${() => rename(habit.id)} className="text-green-600 font-medium text-sm px-1">Save</button>
                    <button onClick=${() => setRenamingId(null)} className="text-gray-400 text-sm px-1">Cancel</button>
                  `
                  : html`
                    <span className="flex-1 text-sm font-medium text-gray-900 truncate">${habit.name}</span>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button onClick=${() => reorder(habit.id, -1)} disabled=${idx === 0}
                        className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 disabled:opacity-25"
                        aria-label="Move up">↑</button>
                      <button onClick=${() => reorder(habit.id, 1)} disabled=${idx === habits.length - 1}
                        className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 disabled:opacity-25"
                        aria-label="Move down">↓</button>
                      <button
                        onClick=${() => { setRenamingId(habit.id); setRenameVal(habit.name); }}
                        className="px-2 h-8 text-xs text-gray-600 hover:bg-gray-100 rounded-lg">Rename</button>
                      <button
                        onClick=${() => setDeleteTarget(habit)}
                        className="px-2 h-8 text-xs text-red-600 hover:bg-red-50 rounded-lg">Delete</button>
                    </div>
                  `}
              </div>
            `)
          }

          <div className="mt-4">
            ${atCap
              ? html`<p className="text-xs text-gray-400 text-center py-2">Maximum 5 habits reached.</p>`
              : html`
                <div className="flex gap-2">
                  <input
                    className="flex-1 border border-gray-300 rounded-xl px-3 py-2.5 text-sm"
                    placeholder="New habit name…"
                    value=${addName}
                    maxLength=${40}
                    onChange=${e => setAddName(e.target.value)}
                    onKeyDown=${e => e.key === 'Enter' && add()}
                  />
                  <button
                    onClick=${add}
                    disabled=${!addName.trim()}
                    className="px-4 py-2.5 bg-green-600 text-white text-sm font-medium rounded-xl disabled:opacity-40 hover:bg-green-700 active:bg-green-800"
                  >Add</button>
                </div>
              `}
          </div>

          <div className="mt-8">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Data</p>
            <button onClick=${onExport}
              className="w-full py-3 px-4 bg-gray-50 hover:bg-gray-100 text-gray-700 text-sm font-medium rounded-xl text-left mb-2">
              📤 Export data
            </button>
            <button onClick=${() => fileRef.current?.click()}
              className="w-full py-3 px-4 bg-gray-50 hover:bg-gray-100 text-gray-700 text-sm font-medium rounded-xl text-left">
              📥 Import data
            </button>
            <input ref=${fileRef} type="file" accept=".json" className="hidden" onChange=${pickFile} />
          </div>
        </div>
      </div>

      ${deleteTarget && html`
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl">
            <h3 className="font-semibold text-gray-900 mb-2">Delete habit</h3>
            <p className="text-sm text-gray-600 mb-5">
              Delete "${deleteTarget.name}" and all its history? This cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button onClick=${() => setDeleteTarget(null)}
                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-xl">Cancel</button>
              <button onClick=${() => doDelete(deleteTarget.id)}
                className="px-4 py-2 text-sm text-white bg-red-600 hover:bg-red-700 rounded-xl font-medium">Delete</button>
            </div>
          </div>
        </div>
      `}

      ${importData && html`
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl">
            <h3 className="font-semibold text-gray-900 mb-2">Import data</h3>
            <p className="text-sm text-gray-600 mb-5">
              Import will replace all current habits and history. Continue?
            </p>
            <div className="flex gap-3 justify-end">
              <button onClick=${() => setImportData(null)}
                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-xl">Cancel</button>
              <button onClick=${async () => { await onImport(importData); setImportData(null); }}
                className="px-4 py-2 text-sm text-white bg-green-600 hover:bg-green-700 rounded-xl font-medium">Import</button>
            </div>
          </div>
        </div>
      `}
    </div>
  `;
}

// ── BackupBanner ──────────────────────────────────────────────────────────────

function BackupBanner({ onExport, onDismiss }) {
  return html`
    <div className="bg-amber-50 border-b border-amber-200 px-4 py-2.5 flex items-center gap-3">
      <p className="text-sm text-amber-800 flex-1">Backup reminder: export your data to keep it safe.</p>
      <button onClick=${onExport} className="text-xs font-semibold text-amber-900 underline whitespace-nowrap">Export now</button>
      <button onClick=${onDismiss} className="text-xs text-amber-600 whitespace-nowrap ml-1">Later</button>
    </div>
  `;
}

// ── App ───────────────────────────────────────────────────────────────────────

function App() {
  const now = new Date();
  const curYear = now.getFullYear();
  const curMonth = now.getMonth();

  const [habits, setHabits] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [entries, setEntries] = useState({});
  const [showMgmt, setShowMgmt] = useState(false);
  const [modal, setModal] = useState(null);
  const [toasts, setToasts] = useState([]);
  const [showBackup, setShowBackup] = useState(false);
  const [dbError, setDbError] = useState(false);
  const [availableYears, setAvailableYears] = useState([]);
  const [selectedYear, setSelectedYear] = useState(curYear);

  function toast(msg) {
    const id = ++_toastId;
    setToasts(t => [...t, { id, msg }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3500);
  }

  async function loadHabits(forceId) {
    try {
      const h = await db.getHabits();
      setHabits(h);
      setActiveId(prev => {
        if (forceId !== undefined) {
          return (forceId && h.find(x => x.id === forceId)) ? forceId : (h[0]?.id ?? null);
        }
        return (prev && h.find(x => x.id === prev)) ? prev : (h[0]?.id ?? null);
      });
      return h;
    } catch {
      setDbError(true);
      return [];
    }
  }

  async function loadEntries(id) {
    if (!id) { setEntries({}); return; }
    try { setEntries(await db.getEntriesForHabit(id)); }
    catch { setEntries({}); }
  }

  async function refreshYears() {
    try { setAvailableYears(await db.getAvailableYears()); }
    catch {}
  }

  useEffect(() => {
    (async () => {
      await loadHabits();
      await refreshYears();
      try {
        const last = await db.getMeta('lastExportPromptAt');
        if (!last || Date.now() - new Date(last).getTime() > 7 * 864e5) setShowBackup(true);
      } catch {}
    })();
  }, []);

  useEffect(() => { loadEntries(activeId); }, [activeId]);

  function handleDayClick(dateStr, isEditable) {
    if (!isEditable) { toast('Only the last 7 days can be edited'); return; }
    setModal({ date: dateStr });
  }

  async function handleStatusSave(status) {
    if (!modal || !activeId) return;
    try {
      await db.setEntry(activeId, modal.date, status);
      if (status === 'not_entered') {
        setEntries(prev => { const n = { ...prev }; delete n[modal.date]; return n; });
      } else {
        setEntries(prev => ({ ...prev, [modal.date]: status }));
      }
      await refreshYears();
    } catch {
      toast('Failed to save. Please try again.');
    }
    setModal(null);
  }

  async function doExport() {
    try {
      const data = await db.exportAllData();
      const dateStr = new Date().toISOString().slice(0, 10);
      const payload = { app: 'daily-habits', version: 1, exportedAt: new Date().toISOString(), habits: data };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `daily-habits-export-${dateStr}.json`; a.click();
      URL.revokeObjectURL(url);
      await db.setMeta('lastExportPromptAt', new Date().toISOString());
      setShowBackup(false);
      toast('Data exported successfully');
    } catch { toast('Export failed. Please try again.'); }
  }

  async function doImport(data) {
    try {
      await db.importAllData(data.habits);
      const h = await db.getHabits();
      setHabits(h);
      const first = h[0]?.id ?? null;
      setActiveId(first);
      await loadEntries(first);
      await refreshYears();
      setShowMgmt(false);
      toast('Data imported successfully');
    } catch { toast('Import failed. Please try again.'); }
  }

  function handleYearSelect(year) {
    setSelectedYear(year);
  }

  const activeHabit = habits.find(h => h.id === activeId);
  const dropdownYears = [...new Set([curYear, ...availableYears.filter(y => y >= FLOOR_YEAR)])].sort((a, b) => b - a);

  return html`
    <div className="max-w-[480px] mx-auto bg-white min-h-screen">
      ${dbError && html`
        <div className="bg-yellow-50 border-b border-yellow-200 px-4 py-2 text-sm text-yellow-800">
          Storage unavailable; your data will not persist.
        </div>
      `}
      ${showBackup && html`
        <${BackupBanner}
          onExport=${async () => { await doExport(); setShowBackup(false); }}
          onDismiss=${async () => {
            setShowBackup(false);
            await db.setMeta('lastExportPromptAt', new Date().toISOString()).catch(() => {});
          }}
        />
      `}

      <div className="sticky top-0 z-20 bg-white border-b border-gray-200 shadow-sm">
        <div className="flex items-center justify-between px-4 h-14">
          <h1 className="text-lg font-bold text-gray-900">Daily Habits</h1>
          <div className="flex items-center gap-2">
            <select
              onChange=${e => handleYearSelect(parseInt(e.target.value))}
              value=${selectedYear}
              className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 text-gray-700 bg-white"
              aria-label="Jump to year"
            >
              ${dropdownYears.map(y => html`<option key=${y} value=${y}>${y}</option>`)}
            </select>
            <button
              onClick=${() => setShowMgmt(true)}
              className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-gray-100 text-lg"
              aria-label="Manage habits"
            >☰</button>
          </div>
        </div>
        ${habits.length > 0 && html`
          <${HabitTabs} habits=${habits} activeId=${activeId} onSelect=${setActiveId} />
        `}
      </div>

      ${habits.length === 0
        ? html`
          <div className="flex flex-col items-center justify-center px-8 py-24 text-center">
            <p className="text-gray-500 mb-5 text-base">No habits yet. Add your first habit to get started.</p>
            <button
              onClick=${() => setShowMgmt(true)}
              className="px-6 py-3 bg-green-600 text-white font-semibold rounded-2xl hover:bg-green-700 active:bg-green-800 text-base"
            >Add habit</button>
          </div>
        `
        : html`
          <${CalendarView}
            entries=${entries}
            onDayClick=${handleDayClick}
            selectedYear=${selectedYear}
          />
        `
      }

      ${modal && activeHabit && html`
        <${StatusModal}
          date=${modal.date}
          currentStatus=${entries[modal.date] || 'not_entered'}
          habitName=${activeHabit.name}
          onSave=${handleStatusSave}
          onClose=${() => setModal(null)}
        />
      `}

      ${showMgmt && html`
        <${ManagementView}
          habits=${habits}
          onClose=${() => setShowMgmt(false)}
          onChange=${async id => { await loadHabits(id); await refreshYears(); }}
          onExport=${doExport}
          onImport=${doImport}
          toast=${toast}
        />
      `}

      <${ToastContainer} toasts=${toasts} onRemove=${id => setToasts(t => t.filter(x => x.id !== id))} />
    </div>
  `;
}

createRoot(document.getElementById('root')).render(html`<${App} />`);
