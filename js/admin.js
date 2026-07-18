/* ============================================
   WOW Medical — Admin (ES Module)
   Захист: sessionStorage (пароль WOW1)
   Імпорт Excel → Firestore
   База дітей + Журнал оглядів
   ============================================ */

import { saveChildren, loadChildren, deleteChildren } from './database.js';
import { getExaminations, clearExaminations, deleteRecord } from './api.js';

const IMPORT_DATE_KEY = 'lastImportDate';
const AUTH_KEY = 'wow_admin_authenticated';

// === Login ===
const loginOverlay = document.getElementById('loginOverlay');
const adminPassword = document.getElementById('adminPassword');
const loginBtn = document.getElementById('loginBtn');
const loginError = document.getElementById('loginError');

function checkAuth() {
  return sessionStorage.getItem(AUTH_KEY) === 'true';
}

function showLogin() {
  loginOverlay.classList.remove('login-overlay--hidden');
  adminPassword.focus();
}

function hideLogin() {
  loginOverlay.classList.add('login-overlay--hidden');
  document.querySelector('.header').style.display = '';
  document.querySelector('.main').style.display = '';
  document.querySelector('.footer').style.display = '';
  sessionStorage.setItem(AUTH_KEY, 'true');
}

function handleLogin() {
  if (adminPassword.value === 'WOW1') {
    hideLogin();
    loginError.textContent = '';
    initApp();
  } else {
    loginError.textContent = 'Невірний пароль';
    adminPassword.value = '';
    adminPassword.focus();
  }
}

// === DOM (admin) ===
const fileInput = document.getElementById('fileInput');
const dropzone = document.getElementById('dropzone');
const fileNameEl = document.getElementById('fileName');
const importBtn = document.getElementById('importBtn');
const clearBtn = document.getElementById('clearBtn');
const importStatus = document.getElementById('importStatus');
const totalChildren = document.getElementById('totalChildren');
const tableBody = document.getElementById('tableBody');
const tableCount = document.getElementById('tableCount');
const loadingOverlay = document.getElementById('loadingOverlay');

const exportJournalBtn = document.getElementById('exportJournalBtn');
const clearJournalBtn = document.getElementById('clearJournalBtn');
const journalBody = document.getElementById('journalBody');
const journalCount = document.getElementById('journalCount');
const journalToday = document.getElementById('journalToday');
const journalFever = document.getElementById('journalFever');
const journalTabs = document.getElementById('journalTabs');

let currentExaminations = [];
let journalFilter = 'all';
let pendingData = null;
let currentChildren = [];

/* ========================================
   Ініціалізація (після входу)
   ======================================== */

async function initApp() {
  // Реєструємо обробники подій ДО завантаження даних
  fileInput.addEventListener('change', handleFileSelect);
  console.log('[Admin] Обробник зміни файлу зареєстровано');

  dropzone.addEventListener('dragover', (e) => { e.preventDefault(); dropzone.classList.add('import-box__dropzone--dragover'); });
  dropzone.addEventListener('dragleave', () => dropzone.classList.remove('import-box__dropzone--dragover'));
  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('import-box__dropzone--dragover');
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  });
  dropzone.addEventListener('click', (e) => { if (e.target !== fileInput) fileInput.click(); });

  importBtn.addEventListener('click', handleImport);
  clearBtn.addEventListener('click', handleClear);

  exportJournalBtn.addEventListener('click', exportJournalToExcel);
  clearJournalBtn.addEventListener('click', handleClearJournal);

  journalTabs.addEventListener('click', (e) => {
    const tab = e.target.closest('.journal-tab');
    if (!tab) return;
    journalFilter = tab.getAttribute('data-mp') || 'all';
    journalTabs.querySelectorAll('.journal-tab').forEach((t) => t.classList.remove('journal-tab--active'));
    tab.classList.add('journal-tab--active');
    renderJournal();
  });

  // Обробник видалення окремого запису (делегування на body)
  journalBody.addEventListener('click', async (e) => {
    const btn = e.target.closest('.btn-delete-record');
    if (!btn) return;
    const recordId = btn.getAttribute('data-record-id');
    if (!recordId) return;
    const name = btn.closest('tr')?.querySelector('strong')?.textContent || 'запис';
    if (!confirm(`Видалити запис «${name}»? Цю дію неможливо скасувати.`)) return;
    btn.disabled = true;
    const result = await deleteRecord(recordId);
    if (result.success) {
      showStatus(`✅ Запис «${name}» видалено`, 'success');
      await refreshData();
    } else {
      showStatus('❌ Помилка: ' + (result.message || 'невідома помилка'), 'error');
      btn.disabled = false;
    }
  });

  // Тепер завантажуємо дані
  await refreshData();
}

/* ========================================
   Журнал
   ======================================== */

async function loadJournal() {
  try {
    currentExaminations = await getExaminations();

    // Fallback: для старих записів без medicalStation вважаємо 'white'
    currentExaminations.forEach(function(exam) {
      if (!exam.medicalStation) exam.medicalStation = 'white';
    });

    // Сортуємо від найновіших до найстаріших
    currentExaminations.sort((a, b) => {
      const timeA = a.createdAt && a.createdAt.toDate ? a.createdAt.toDate().getTime() : 0;
      const timeB = b.createdAt && b.createdAt.toDate ? b.createdAt.toDate().getTime() : 0;
      return timeB - timeA;
    });
  } catch {
    currentExaminations = [];
  }
  renderJournal();
  updateJournalStats();
}

function getFilteredExaminations() {
  if (journalFilter === 'all') return currentExaminations;
  return currentExaminations.filter((exam) => exam.medicalStation === journalFilter);
}

function updateJournalStats() {
  const now = new Date();
  const todayDay = now.getDate();
  const todayMonth = now.getMonth() + 1;
  const todayYear = now.getFullYear();
  let todayCount = 0, feverCount = 0;
  let whiteCount = 0, blackCount = 0;

  currentExaminations.forEach((exam) => {
    if (exam.timestamp) {
      const parsed = parseTimestamp(exam.timestamp);
      if (parsed && parsed.day === todayDay && parsed.month === todayMonth && parsed.year === todayYear) todayCount++;
    }
    const temp = parseFloat(exam.temperature);
    if (!isNaN(temp) && temp >= 37) feverCount++;
    if (exam.medicalStation === 'white') whiteCount++;
    else if (exam.medicalStation === 'black') blackCount++;
  });

  journalToday.textContent = todayCount;
  journalFever.textContent = feverCount;
  document.getElementById('journalTotal').textContent = currentExaminations.length;
  document.getElementById('journalWhite').textContent = whiteCount;
  document.getElementById('journalBlack').textContent = blackCount;
}

function parseTimestamp(ts) {
  try {
    const parts = ts.split(',')[0].trim().split('.');
    if (parts.length === 3) return { day: +parts[0], month: +parts[1], year: +parts[2] };
  } catch {}
  return null;
}

function renderJournal() {
  const filtered = getFilteredExaminations();
  journalCount.textContent = filtered.length + ' запис' + plural(filtered.length);

  const hasData = currentExaminations.length > 0;
  exportJournalBtn.disabled = !hasData;
  clearJournalBtn.disabled = !hasData;

  if (filtered.length === 0) {
    const msg = currentExaminations.length === 0 ? 'Немає записів.' : 'Немає записів для обраного медпункту.';
    journalBody.innerHTML = `<tr><td colspan="12" class="data-table__empty">${msg}</td></tr>`;
    return;
  }

  journalBody.innerHTML = filtered.map((exam, i) => {
    const msLabel = exam.medicalStation === 'black' ? 'Чорний' : 'Білий';
    const msClass = exam.medicalStation === 'black' ? 'data-table__mp-badge--black' : 'data-table__mp-badge--white';
    return `<tr data-record-id="${esc(exam.id || '')}">
      <td>${i + 1}</td>
      <td>${esc(exam.timestamp || '—')}</td>
      <td><strong>${esc(exam.childName || '—')}</strong></td>
      <td>${exam.temperature ? esc(exam.temperature) + '°C' : '—'}</td>
      <td class="data-table__cell--wrap">${esc(exam.complaints || '—')}</td>
      <td class="data-table__cell--wrap">${esc(exam.actionsDone || '—')}</td>
      <td class="data-table__cell--wrap">${esc(exam.prescriptions || '—')}</td>
      <td>${esc(exam.doctorName || '—')}</td>
      <td><span class="data-table__mp-badge ${msClass}">${msLabel}</span></td>
      <td>${exam.parentsNotified ? '<span class="data-table__badge data-table__badge--yes">Так</span>' : '<span class="data-table__badge data-table__badge--no">Ні</span>'}</td>
      <td class="data-table__actions"><button type="button" class="btn-delete-record" data-record-id="${esc(exam.id || '')}" title="Видалити запис">🗑️</button></td>
    </tr>`;
  }).join('');
}

function exportJournalToExcel() {
  if (currentExaminations.length === 0) { showStatus('❌ Немає записів для експорту', 'error'); return; }

  const colWidths = [{ wch: 4 }, { wch: 22 }, { wch: 14 }, { wch: 30 }, { wch: 14 }, { wch: 40 }, { wch: 40 }, { wch: 40 }, { wch: 25 }, { wch: 16 }];

  function buildSheet(records, stationLabel) {
    const data = records.map((exam) => ({
      '№': null,
      'Дата / Час': exam.timestamp || '',
      'Медпункт': stationLabel,
      'ПІБ дитини': exam.childName || '',
      'Температура (°C)': exam.temperature || '',
      'Скарги': exam.complaints || '',
      'Надана допомога': exam.actionsDone || '',
      'Призначення': exam.prescriptions || '',
      'Лікар': exam.doctorName || '',
      'Повідомлено батьків': exam.parentsNotified ? 'Так' : 'Ні'
    }));
    data.forEach((row, i) => row['№'] = i + 1);
    const ws = XLSX.utils.json_to_sheet(data);
    ws['!cols'] = colWidths;
    return ws;
  }

  const whiteRecords = currentExaminations.filter((e) => e.medicalStation !== 'black');
  const blackRecords = currentExaminations.filter((e) => e.medicalStation === 'black');

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, buildSheet(whiteRecords, 'Білий'), 'Білий медпункт');
  XLSX.utils.book_append_sheet(wb, buildSheet(blackRecords, 'Чорний'), 'Чорний медпункт');

  const now = new Date();
  const fileName = `WOW_Medical_Журнал_${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}.xlsx`;
  XLSX.writeFile(wb, fileName);
  showStatus('✅ Вивантажено: ' + fileName, 'success');
}

async function handleClearJournal() {
  if (currentExaminations.length === 0) { showStatus('🗑️ Журнал порожній', 'info'); return; }
  if (!confirm(`Видалити всі ${currentExaminations.length} записів?`)) return;
  showLoading(true);
  try {
    await clearExaminations();
    currentExaminations = [];
    renderJournal();
    updateJournalStats();
    showStatus('🗑️ Журнал очищено', 'info');
  } catch (e) { showStatus('❌ Помилка: ' + e.message, 'error'); }
  finally { showLoading(false); }
}

/* ========================================
   Дані
   ======================================== */

async function refreshData() {
  try { currentChildren = await loadChildren(); } catch { currentChildren = []; }
  await loadJournal();
  updateUI();
}

function updateUI() { updateStats(); renderTable(); }

/* ========================================
   Excel
   ======================================== */

function handleFileSelect(event) { const file = event.target.files[0]; if (file) processFile(file); }

function processFile(file) {
  const ext = '.' + file.name.split('.').pop().toLowerCase();
  console.log('[Admin] Отримано файл:', file.name, 'розширення:', ext);

  if (ext !== '.xlsx' && ext !== '.xls' && ext !== '.csv') {
    showStatus('❌ Непідтримуваний формат. Виберіть .xlsx, .xls або .csv', 'error');
    return;
  }

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      console.log('[Admin] Файл прочитано, парсимо Excel...');
      const wb = XLSX.read(new Uint8Array(e.target.result), { type: 'array' });
      const firstSheet = wb.SheetNames[0];
      console.log('[Admin] Аркуш:', firstSheet);
      const ws = wb.Sheets[firstSheet];
      const rawData = XLSX.utils.sheet_to_json(ws, { header: 1 });
      console.log('[Admin] Рядків у файлі:', rawData.length);

      if (rawData.length < 2) { showStatus('❌ Файл порожній або містить лише заголовки', 'error'); return; }

      const headers = rawData[0].map((h) => String(h || '').trim());
      console.log('[Admin] Заголовки:', headers);
      const rows = rawData.slice(1).filter((row) => row.some((cell) => cell !== undefined && cell !== null && String(cell).trim() !== ''));
      console.log('[Admin] Непорожніх рядків:', rows.length);

      const map = findColumns(headers);
      if (!map) {
        showStatus('❌ Колонки не знайдено. Очікуються: ПІБ, Вік, Тім-лідер, ПІБ батьків, Телефон, Стан здоров\'я', 'error');
        console.error('[Admin] Заголовки не знайдено:', headers);
        return;
      }
      console.log('[Admin] Знайдено колонки:', map);

      const now = Date.now();
      pendingData = rows.map((row, i) => ({
        id: now + i,
        fullName: String(row[map.fullName] || '').trim(),
        age: String(row[map.age] !== undefined && row[map.age] !== null ? row[map.age] : '').trim(),
        teamLeader: String(row[map.teamLeader] !== undefined && row[map.teamLeader] !== null ? row[map.teamLeader] : '').trim(),
        parentName: String(row[map.parentName] !== undefined && row[map.parentName] !== null ? row[map.parentName] : '').trim(),
        phone: String(row[map.phone] !== undefined && row[map.phone] !== null ? row[map.phone] : '').trim(),
        healthInfo: String(row[map.healthInfo] !== undefined && row[map.healthInfo] !== null ? row[map.healthInfo] : '').trim()
      })).filter((c) => c.fullName !== '');

      console.log('[Admin] Розпарсено дітей:', pendingData.length);

      if (pendingData.length === 0) { showStatus('❌ Не знайдено жодного рядка з ПІБ', 'error'); pendingData = null; return; }

      fileNameEl.textContent = file.name;
      dropzone.classList.add('import-box__dropzone--has-file');
      importBtn.disabled = false;
      showStatus(`📄 Знайдено ${pendingData.length} дітей. Натисніть «Імпортувати» для збереження.`, 'success');
    } catch (err) {
      console.error('[Admin] Помилка читання Excel:', err);
      showStatus('❌ Помилка читання файлу. Перевірте формат.', 'error');
    }
  };

  reader.onerror = (err) => {
    console.error('[Admin] Помилка FileReader:', err);
    showStatus('❌ Помилка читання файлу', 'error');
  };

  reader.readAsArrayBuffer(file);
}

function findColumns(headers) {
  const norm = headers.map((h) => h.toLowerCase().replace(/\s+/g, ' ').trim());
  const idx = (kw) => norm.findIndex((h) => kw.some((k) => h.includes(k)));
  const fi = idx(['піб', 'прізвище', 'ім\'я', 'фио', 'full name', 'name']);
  if (fi === -1) return null;
  return {
    fullName: fi, age: idx(['вік', 'возраст', 'age']),
    teamLeader: idx(['тім-лідер', 'тім лідер', 'team leader']),
    parentName: idx(['піб батьків', 'батьків', 'parent']),
    phone: idx(['телефон', 'phone', 'тел']),
    healthInfo: idx(['стан здоров', 'здоров\'я', 'health'])
  };
}

/* ========================================
   Імпорт / Очищення
   ======================================== */

async function handleImport() {
  if (!pendingData?.length) { showStatus('❌ Немає даних', 'error'); return; }
  if (currentChildren.length > 0 && !confirm(`У базі ${currentChildren.length} дітей. Замінити?`)) { showStatus('⚠️ Скасовано', 'info'); return; }
  showLoading(true); importBtn.disabled = true; showStatus('⏳ Зберігаємо...', 'info');
  try {
    await saveChildren(pendingData);
    sessionStorage.setItem(IMPORT_DATE_KEY, new Date().toLocaleString('uk-UA'));
    await refreshData();
    resetImport();
    showStatus(`✅ Імпортовано ${pendingData.length} дітей`, 'success');
  } catch (e) { showStatus('❌ Помилка: ' + e.message, 'error'); }
  finally { showLoading(false); }
}

async function handleClear() {
  if (currentChildren.length === 0) { showStatus('🗑️ База порожня', 'info'); return; }
  if (!confirm(`Видалити всі ${currentChildren.length} записів?`)) return;
  showLoading(true);
  try {
    await deleteChildren();
    currentChildren = [];
    sessionStorage.removeItem(IMPORT_DATE_KEY);
    updateUI(); resetImport();
    showStatus('🗑️ Базу очищено', 'info');
  } catch (e) { showStatus('❌ Помилка: ' + e.message, 'error'); }
  finally { showLoading(false); }
}

/* ========================================
   UI
   ======================================== */

function updateStats() {
  totalChildren.textContent = currentChildren.length;
}

function renderTable() {
  tableCount.textContent = currentChildren.length + ' запис' + plural(currentChildren.length);
  if (currentChildren.length === 0) { tableBody.innerHTML = '<tr><td colspan="7" class="data-table__empty">Немає даних</td></tr>'; return; }
  tableBody.innerHTML = currentChildren.map((c, i) => `<tr>
    <td>${i + 1}</td><td><strong>${esc(c.fullName)}</strong></td>
    <td>${esc(c.age) || '—'}</td><td>${esc(c.teamLeader) || '—'}</td>
    <td>${esc(c.parentName) || '—'}</td><td>${esc(c.phone) || '—'}</td>
    <td>${healthBadge(c.healthInfo)}</td>
  </tr>`).join('');
}

function healthBadge(s) {
  if (!s) return '—';
  const st = s.toLowerCase();
  let cls = 'data-table__health--healthy';
  if (['хрон','алерг','особл','група'].some((k) => st.includes(k))) cls = 'data-table__health--warning';
  else if (['тяжк','серйоз','інвал','гостр'].some((k) => st.includes(k))) cls = 'data-table__health--danger';
  return `<span class="data-table__health ${cls}">${esc(s)}</span>`;
}

/* ========================================
   Утиліти
   ======================================== */

function showLoading(s) { if (loadingOverlay) loadingOverlay.style.display = s ? 'flex' : 'none'; }

function esc(str) {
  if (str === undefined || str === null) return '—';
  const d = document.createElement('div'); d.appendChild(document.createTextNode(String(str)));
  return d.innerHTML;
}

function plural(n) {
  if (n % 10 === 1 && n % 100 !== 11) return '';
  if (n % 10 >= 2 && n % 10 <= 4 && !(n % 100 >= 10 && n % 100 <= 20)) return 'и';
  return 'ів';
}

function showStatus(msg, type) {
  importStatus.textContent = msg;
  importStatus.className = 'import-box__status import-box__status--' + (type || 'info');
}

function resetImport() {
  pendingData = null; fileInput.value = ''; fileNameEl.textContent = '';
  dropzone.classList.remove('import-box__dropzone--has-file'); importBtn.disabled = true;
}

/* ========================================
   Старт: завжди показуємо форму входу
   ======================================== */

showLogin();
loginBtn.addEventListener('click', handleLogin);
adminPassword.addEventListener('keydown', (e) => { if (e.key === 'Enter') handleLogin(); });
// Ховаємо весь контент, доки не залогінені
document.querySelector('.header').style.display = 'none';
document.querySelector('.main').style.display = 'none';
document.querySelector('.footer').style.display = 'none';
