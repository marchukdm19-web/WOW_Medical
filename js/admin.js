/* ============================================
   WOW Medical — Admin
   Імпорт Excel → Firebase Firestore + таблиця
   Працює без ES modules (для file:// протоколу)
   ============================================ */

(function() {
  'use strict';

  var IMPORT_DATE_KEY = 'lastImportDate';

  // DOM
  var fileInput = document.getElementById('fileInput');
  var dropzone = document.getElementById('dropzone');
  var fileNameEl = document.getElementById('fileName');
  var importBtn = document.getElementById('importBtn');
  var clearBtn = document.getElementById('clearBtn');
  var importStatus = document.getElementById('importStatus');
  var totalChildren = document.getElementById('totalChildren');
  var lastImport = document.getElementById('lastImport');
  var tableBody = document.getElementById('tableBody');
  var tableCount = document.getElementById('tableCount');
  var loadingOverlay = document.getElementById('loadingOverlay');

  // Журнал оглядів
  var exportJournalBtn = document.getElementById('exportJournalBtn');
  var clearJournalBtn = document.getElementById('clearJournalBtn');
  var journalBody = document.getElementById('journalBody');
  var journalCount = document.getElementById('journalCount');
  var journalToday = document.getElementById('journalToday');
  var journalFever = document.getElementById('journalFever');
  var journalTabs = document.getElementById('journalTabs');
  var currentExaminations = [];
  var journalFilter = 'all'; // 'all', 'white', 'black'

  var pendingData = null;
  var currentChildren = [];

  /* ========================================
     Ініціалізація
     ======================================== */

  async function init() {
    await refreshData();

    fileInput.addEventListener('change', handleFileSelect);

    // Drag & Drop
    dropzone.addEventListener('dragover', function(e) {
      e.preventDefault();
      dropzone.classList.add('import-box__dropzone--dragover');
    });
    dropzone.addEventListener('dragleave', function() {
      dropzone.classList.remove('import-box__dropzone--dragover');
    });
    dropzone.addEventListener('drop', function(e) {
      e.preventDefault();
      dropzone.classList.remove('import-box__dropzone--dragover');
      var file = e.dataTransfer.files[0];
      if (file) processFile(file);
    });

    dropzone.addEventListener('click', function(e) {
      if (e.target === fileInput) return;
      fileInput.click();
    });

    importBtn.addEventListener('click', handleImport);
    clearBtn.addEventListener('click', handleClear);

    exportJournalBtn.addEventListener('click', exportJournalToExcel);
    clearJournalBtn.addEventListener('click', handleClearJournal);

    // Таби журналу
    journalTabs.addEventListener('click', function(e) {
      var tab = e.target.closest('.journal-tab');
      if (!tab) return;
      journalFilter = tab.getAttribute('data-mp') || 'all';

      var allTabs = journalTabs.querySelectorAll('.journal-tab');
      allTabs.forEach(function(t) { t.classList.remove('journal-tab--active'); });
      tab.classList.add('journal-tab--active');

      renderJournal();
    });
  }

  /* ========================================
     Журнал оглядів
     ======================================== */

  function loadJournal() {
    currentExaminations = typeof getExaminations === 'function' ? getExaminations() : [];
    renderJournal();
    updateJournalStats();
  }

  /**
   * Повертає відфільтровані записи відповідно до journalFilter.
   */
  function getFilteredExaminations() {
    if (journalFilter === 'all') return currentExaminations;
    return currentExaminations.filter(function(exam) {
      return exam.medicalPoint === journalFilter;
    });
  }

  function updateJournalStats() {
    var now = new Date();
    var todayDay = now.getDate();
    var todayMonth = now.getMonth() + 1;
    var todayYear = now.getFullYear();

    var todayCount = 0;
    var feverCount = 0;

    currentExaminations.forEach(function(exam) {
      // Парсимо дату з українського формату "дд.мм.рррр, гг:хх:сс"
      if (exam.timestamp) {
        var parsed = parseTimestamp(exam.timestamp);
        if (parsed &&
            parsed.day === todayDay &&
            parsed.month === todayMonth &&
            parsed.year === todayYear) {
          todayCount++;
        }
      }

      // Рахуємо з підвищеною температурою (≥37°C)
      var temp = parseFloat(exam.temperature);
      if (!isNaN(temp) && temp >= 37) {
        feverCount++;
      }
    });

    journalToday.textContent = todayCount;
    journalFever.textContent = feverCount;
  }

  /**
   * Парсить timestamp у форматі "дд.мм.рррр, гг:хх:сс"
   * Повертає { day, month, year } або null.
   */
  function parseTimestamp(ts) {
    try {
      // Формат: "11.07.2026, 17:30:45"
      var datePart = ts.split(',')[0].trim(); // "11.07.2026"
      var parts = datePart.split('.');
      if (parts.length === 3) {
        return {
          day: parseInt(parts[0], 10),
          month: parseInt(parts[1], 10),
          year: parseInt(parts[2], 10)
        };
      }
    } catch (e) {}
    return null;
  }

  function renderJournal() {
    var filtered = getFilteredExaminations();

    journalCount.textContent = filtered.length + ' запис' + plural(filtered.length);

    var hasData = currentExaminations.length > 0;
    exportJournalBtn.disabled = !hasData;
    clearJournalBtn.disabled = !hasData;

    if (filtered.length === 0) {
      var emptyMsg = currentExaminations.length === 0
        ? 'Немає записів. Заповніть форму огляду на головній сторінці.'
        : 'Немає записів для обраного медпункту.';
      journalBody.innerHTML = '<tr><td colspan="11" class="data-table__empty">' + emptyMsg + '</td></tr>';
      return;
    }

    journalBody.innerHTML = filtered
      .map(function(exam, i) {
        var mpLabel = '';
        var mpClass = '';
        if (exam.medicalPoint === 'black') {
          mpLabel = 'Чорний';
          mpClass = 'data-table__mp-badge--black';
        } else {
          mpLabel = 'Білий';
          mpClass = 'data-table__mp-badge--white';
        }

        return (
          '<tr>' +
          '<td>' + (i + 1) + '</td>' +
          '<td>' + esc(exam.timestamp || '—') + '</td>' +
          '<td><strong>' + esc(exam.fullName || '—') + '</strong></td>' +
          '<td>' + esc(exam.age || '—') + '</td>' +
          '<td>' + esc(exam.teamLeader || '—') + '</td>' +
          '<td>' + (exam.temperature ? esc(exam.temperature) + '°C' : '—') + '</td>' +
          '<td class="data-table__cell--wrap">' + esc(exam.complaints || '—') + '</td>' +
          '<td class="data-table__cell--wrap">' + esc(exam.assistance || '—') + '</td>' +
          '<td class="data-table__cell--wrap">' + esc(exam.prescriptions || '—') + '</td>' +
          '<td><span class="data-table__mp-badge ' + mpClass + '">' + mpLabel + '</span></td>' +
          '<td>' + (exam.parentsNotified
            ? '<span class="data-table__badge data-table__badge--yes">Так</span>'
            : '<span class="data-table__badge data-table__badge--no">Ні</span>') + '</td>' +
          '</tr>'
        );
      })
      .join('');
  }

  function exportJournalToExcel() {
    if (currentExaminations.length === 0) {
      showStatus('❌ Немає записів для експорту', 'error');
      return;
    }

    var exportData = currentExaminations.map(function(exam) {
      return {
        '№': null,
        'Дата / Час': exam.timestamp || '',
        'Медпункт': exam.medicalPoint === 'black' ? 'Чорний' : 'Білий',
        'ПІБ дитини': exam.fullName || '',
        'Вік': exam.age || '',
        'Тім-лідер': exam.teamLeader || '',
        'Телефон батьків': exam.phone || '',
        'Температура (°C)': exam.temperature || '',
        'Скарги': exam.complaints || '',
        'Надана допомога': exam.assistance || '',
        'Призначення': exam.prescriptions || '',
        'Повідомлено батьків': exam.parentsNotified ? 'Так' : 'Ні',
        'Стан здоров\'я': exam.healthInfo || ''
      };
    });

    exportData.forEach(function(row, i) {
      row['№'] = i + 1;
    });

    var ws = XLSX.utils.json_to_sheet(exportData);

    // Автоширина колонок
    var colWidths = [
      { wch: 4 },   // №
      { wch: 22 },  // Дата/Час
      { wch: 14 },  // Медпункт
      { wch: 30 },  // ПІБ
      { wch: 5 },   // Вік
      { wch: 25 },  // Тім-лідер
      { wch: 16 },  // Телефон
      { wch: 14 },  // Температура
      { wch: 40 },  // Скарги
      { wch: 40 },  // Допомога
      { wch: 40 },  // Призначення
      { wch: 16 },  // Батьки
      { wch: 25 }   // Стан здоров'я
    ];
    ws['!cols'] = colWidths;

    var wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Журнал оглядів');

    var now = new Date();
    var fileName = 'WOW_Medical_Журнал_Оглядів_' +
      now.getFullYear() + '-' +
      String(now.getMonth() + 1).padStart(2, '0') + '-' +
      String(now.getDate()).padStart(2, '0') + '_' +
      String(now.getHours()).padStart(2, '0') + '-' +
      String(now.getMinutes()).padStart(2, '0') +
      '.xlsx';

    XLSX.writeFile(wb, fileName);
    showStatus('✅ Журнал вивантажено: ' + fileName, 'success');
  }

  function handleClearJournal() {
    if (currentExaminations.length === 0) {
      showStatus('🗑️ Журнал вже порожній', 'info');
      return;
    }

    if (!confirm('Ви впевнені, що хочете видалити всі ' + currentExaminations.length + ' записів оглядів?\nЦю дію неможливо скасувати.')) {
      return;
    }

    if (typeof clearExaminations === 'function') {
      clearExaminations();
    }
    currentExaminations = [];
    renderJournal();
    showStatus('🗑️ Журнал оглядів очищено', 'info');
  }

  /* ========================================
     Робота з даними
     ======================================== */

  async function refreshData() {
    currentChildren = await Database.loadChildren();
    loadJournal();
    updateUI();
  }

  function updateUI() {
    updateStats();
    renderTable();
  }

  /* ========================================
     Обробка Excel-файлу
     ======================================== */

  function handleFileSelect(event) {
    var file = event.target.files[0];
    if (file) processFile(file);
  }

  function processFile(file) {
    var validExts = ['.xlsx', '.xls', '.csv'];
    var ext = '.' + file.name.split('.').pop().toLowerCase();

    if (validExts.indexOf(ext) === -1) {
      showStatus('❌ Непідтримуваний формат. Виберіть .xlsx, .xls або .csv', 'error');
      return;
    }

    var reader = new FileReader();

    reader.onload = function(e) {
      try {
        var data = new Uint8Array(e.target.result);
        var workbook = XLSX.read(data, { type: 'array' });
        var firstSheet = workbook.SheetNames[0];
        var worksheet = workbook.Sheets[firstSheet];

        var rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

        if (rawData.length < 2) {
          showStatus('❌ Файл порожній або містить лише заголовки', 'error');
          return;
        }

        var headers = rawData[0].map(function(h) { return String(h || '').trim(); });
        var rows = rawData.slice(1).filter(function(row) {
          return row.some(function(cell) {
            return cell !== undefined && cell !== null && String(cell).trim() !== '';
          });
        });

        var map = findColumns(headers);

        if (!map) {
          showStatus(
            '❌ Колонки не знайдено. Очікуються: ПІБ, Вік, Тім-лідер, ПІБ батьків, Телефон, Стан здоров\'я',
            'error'
          );
          console.error('[Admin] Заголовки:', headers);
          return;
        }

        console.log('[Admin] Знайдено колонки:', map);

        var now = Date.now();

        pendingData = rows.map(function(row, index) {
          return {
            id: now + index,
            fullName: String(row[map.fullName] || '').trim(),
            age: String(row[map.age] !== undefined && row[map.age] !== null ? row[map.age] : '').trim(),
            teamLeader: String(row[map.teamLeader] !== undefined && row[map.teamLeader] !== null ? row[map.teamLeader] : '').trim(),
            parentName: String(row[map.parentName] !== undefined && row[map.parentName] !== null ? row[map.parentName] : '').trim(),
            phone: String(row[map.phone] !== undefined && row[map.phone] !== null ? row[map.phone] : '').trim(),
            healthInfo: String(row[map.healthInfo] !== undefined && row[map.healthInfo] !== null ? row[map.healthInfo] : '').trim()
          };
        }).filter(function(child) { return child.fullName !== ''; });

        if (pendingData.length === 0) {
          showStatus('❌ Не знайдено жодного рядка з ПІБ', 'error');
          pendingData = null;
          return;
        }

        fileNameEl.textContent = file.name;
        dropzone.classList.add('import-box__dropzone--has-file');
        importBtn.disabled = false;
        showStatus('📄 Знайдено ' + pendingData.length + ' дітей. Натисніть «Імпортувати» для збереження.', 'success');

        console.log('[Admin] Розпарсено:', pendingData.length, 'дітей');
      } catch (error) {
        console.error('[Admin] Помилка читання Excel:', error);
        showStatus('❌ Помилка читання файлу. Перевірте формат.', 'error');
      }
    };

    reader.readAsArrayBuffer(file);
  }

  function findColumns(headers) {
    var norm = headers.map(function(h) { return h.toLowerCase().replace(/\s+/g, ' ').trim(); });

    function idx(keywords) {
      return norm.findIndex(function(h) {
        return keywords.some(function(kw) { return h.indexOf(kw) !== -1; });
      });
    }

    var fullNameIdx = idx(['піб', 'прізвище', 'ім\'я', 'фио', 'full name', 'name']);
    var ageIdx = idx(['вік', 'возраст', 'age']);
    var teamLeaderIdx = idx(['тім-лідер', 'тім лідер', 'team leader', 'teamlead', 'тімлідер', 'вожатий', 'вожата', 'куратор', 'наставник']);
    var parentNameIdx = idx(['піб батьків', 'батьків', 'батьки', 'род', 'родител', 'опекун', 'parent']);
    var phoneIdx = idx(['телефон', 'phone', 'tel', 'номер', 'моб']);
    var healthInfoIdx = idx(['стан здоров', 'здоров\'я', 'здоровя', 'health', 'мед', 'хроніч', 'алерг', 'діагноз']);

    if (fullNameIdx === -1) return null;

    return {
      fullName: fullNameIdx,
      age: ageIdx,
      teamLeader: teamLeaderIdx,
      parentName: parentNameIdx,
      phone: phoneIdx,
      healthInfo: healthInfoIdx
    };
  }

  /* ========================================
     Імпорт
     ======================================== */

  async function handleImport() {
    if (!pendingData || pendingData.length === 0) {
      showStatus('❌ Немає даних для імпорту. Спочатку виберіть Excel-файл.', 'error');
      return;
    }

    // Підтвердження заміни
    if (currentChildren.length > 0) {
      var confirmed = confirm(
        'У базі вже є ' + currentChildren.length + ' дітей.\n\nЗамінити існуючу базу?\n\n"OK" — повністю перезаписати\n"Скасувати" — залишити без змін'
      );
      if (!confirmed) {
        showStatus('⚠️ Імпорт скасовано. Існуюча база не змінена.', 'info');
        return;
      }
    }

    var count = pendingData.length;

    // Індикатор завантаження
    showLoading(true);
    importBtn.disabled = true;
    showStatus('⏳ Зберігаємо...', 'info');

    try {
      await Database.saveChildren(pendingData);

      // Оновлюємо дату
      var now = new Date();
      var dateStr = now.toLocaleString('uk-UA', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
      localStorage.setItem(IMPORT_DATE_KEY, dateStr);

      // Оновлюємо UI
      await refreshData();
      resetImport();

      showStatus('✅ Успішно імпортовано ' + count + ' дітей', 'success');
      console.log('[Admin] Імпортовано ' + count + ' дітей');
    } catch (error) {
      console.error('[Admin] Помилка імпорту:', error);
      showStatus('❌ Помилка збереження: ' + error.message, 'error');
    } finally {
      showLoading(false);
    }
  }

  /* ========================================
     Очищення бази
     ======================================== */

  async function handleClear() {
    if (currentChildren.length === 0) {
      showStatus('🗑️ База вже порожня', 'info');
      return;
    }

    if (!confirm('Ви впевнені, що хочете видалити всі ' + currentChildren.length + ' записів?\nЦю дію неможливо скасувати.')) {
      return;
    }

    showLoading(true);
    showStatus('⏳ Видаляємо...', 'info');

    try {
      var deleted = await Database.deleteChildren();
      currentChildren = [];
      localStorage.removeItem(IMPORT_DATE_KEY);
      updateUI();
      resetImport();
      showStatus('🗑️ Видалено ' + deleted + ' записів', 'info');
    } catch (error) {
      console.error('[Admin] Помилка очищення:', error);
      showStatus('❌ Помилка: ' + error.message, 'error');
    } finally {
      showLoading(false);
    }
  }

  /* ========================================
     Статистика
     ======================================== */

  function updateStats() {
    totalChildren.textContent = currentChildren.length;
    lastImport.textContent = localStorage.getItem(IMPORT_DATE_KEY) || '—';
  }

  /* ========================================
     Таблиця
     ======================================== */

  function renderTable() {
    tableCount.textContent = currentChildren.length + ' запис' + plural(currentChildren.length);

    if (currentChildren.length === 0) {
      tableBody.innerHTML = '<tr><td colspan="7" class="data-table__empty">Немає даних. Імпортуйте Excel-файл.</td></tr>';
      return;
    }

    tableBody.innerHTML = currentChildren
      .map(function(child, i) {
        return (
          '<tr>' +
          '<td>' + (i + 1) + '</td>' +
          '<td><strong>' + esc(child.fullName) + '</strong></td>' +
          '<td>' + esc(child.age) || '—' + '</td>' +
          '<td>' + esc(child.teamLeader) || '—' + '</td>' +
          '<td>' + esc(child.parentName) || '—' + '</td>' +
          '<td>' + esc(child.phone) || '—' + '</td>' +
          '<td>' + healthBadge(child.healthInfo) + '</td>' +
          '</tr>'
        );
      })
      .join('');
  }

  function healthBadge(status) {
    if (!status) return '—';
    var s = status.toLowerCase();
    var cls = 'data-table__health--healthy';
    if (s.indexOf('хрон') !== -1 || s.indexOf('алерг') !== -1 || s.indexOf('особл') !== -1 || s.indexOf('група') !== -1) {
      cls = 'data-table__health--warning';
    } else if (s.indexOf('тяжк') !== -1 || s.indexOf('серйоз') !== -1 || s.indexOf('інвал') !== -1 || s.indexOf('гостр') !== -1) {
      cls = 'data-table__health--danger';
    }
    return '<span class="data-table__health ' + cls + '">' + esc(status) + '</span>';
  }

  /* ========================================
     Індикатор завантаження
     ======================================== */

  function showLoading(show) {
    if (loadingOverlay) {
      loadingOverlay.style.display = show ? 'flex' : 'none';
    }
  }

  /* ========================================
     Утиліти
     ======================================== */

  function esc(str) {
    if (str === undefined || str === null) return '—';
    var d = document.createElement('div');
    d.appendChild(document.createTextNode(String(str)));
    return d.innerHTML;
  }

  function plural(n) {
    var m10 = n % 10;
    var m100 = n % 100;
    if (m10 === 1 && m100 !== 11) return '';
    if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return 'и';
    return 'ів';
  }

  function showStatus(msg, type) {
    importStatus.textContent = msg;
    importStatus.className = 'import-box__status import-box__status--' + (type || 'info');
  }

  function resetImport() {
    pendingData = null;
    fileInput.value = '';
    fileNameEl.textContent = '';
    dropzone.classList.remove('import-box__dropzone--has-file');
    importBtn.disabled = true;
  }

  init();
})();