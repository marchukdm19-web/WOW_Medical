/* ============================================
   WOW Medical — App
   Основна логіка: пошук, автозаповнення, форма
   Дані завантажуються з localStorage
   ============================================ */

(() => {
  'use strict';

  const STORAGE_KEY = 'children';

  // Стан
  let childrenData = [];
  let selectedChild = null;
  let searchDebounceTimer = null;
  let selectedMedicalPoint = 'white';

  // DOM
  const searchInput = document.getElementById('searchInput');
  const searchBtn = document.getElementById('searchBtn');
  const searchResults = document.getElementById('searchResults');
  const searchTotal = document.getElementById('searchTotal');
  const form = document.getElementById('examinationForm');

  // Поля форми (readonly)
  const fieldFullName = document.getElementById('fullName');
  const fieldAge = document.getElementById('age');
  const fieldTeamLeader = document.getElementById('teamLeader');
  const fieldParentName = document.getElementById('parentName');
  const fieldPhone = document.getElementById('phone');
  const fieldHealthInfo = document.getElementById('healthInfo');

  // Поля медичного огляду (редаговані)
  const fieldTemperature = document.getElementById('temperature');
  const fieldComplaints = document.getElementById('complaints');
  const fieldAssistance = document.getElementById('assistance');
  const fieldPrescriptions = document.getElementById('prescriptions');
  const fieldParentsNotified = document.getElementById('parentsNotified');

  // Медпункт
  const mpWhiteBtn = document.getElementById('mpWhite');
  const mpBlackBtn = document.getElementById('mpBlack');

  // Історія звернень
  const historySection = document.getElementById('historySection');
  const historyBody = document.getElementById('historyBody');
  const historyCount = document.getElementById('historyCount');

  /* ========================================
      Завантаження даних із localStorage / JSON-файлу
      ======================================== */

  async function loadChildren() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        childrenData = JSON.parse(raw);
        console.log(`[WOW Medical] Завантажено ${childrenData.length} дітей із localStorage`);
        updateTotal();
        return;
      }

      // localStorage порожній — завантажуємо з вбудованої змінної CHILDREN_DATA
      if (typeof CHILDREN_DATA !== 'undefined' && Array.isArray(CHILDREN_DATA) && CHILDREN_DATA.length > 0) {
        childrenData = CHILDREN_DATA;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(childrenData));
        console.log(`[WOW Medical] Завантажено ${childrenData.length} дітей із CHILDREN_DATA (вбудована база) та збережено в localStorage`);
      } else {
        childrenData = [];
        console.log('[WOW Medical] Вбудована база недоступна. Імпортуйте дітей через Admin-панель.');
      }
    } catch (error) {
      console.error('[WOW Medical] Помилка завантаження даних:', error);
      childrenData = [];
    }

    updateTotal();
  }

  function updateTotal() {
    if (searchTotal) {
      searchTotal.textContent = childrenData.length;
    }
  }

  /* ========================================
     Пошук
     ======================================== */

  function normalize(str) {
    return str
      .toLowerCase()
      .replace(/[''`]/g, "'")
      .replace(/['']/g, "'")
      .replace(/[«»]/g, '"')
      .trim();
  }

  function searchChildren(query) {
    const q = normalize(query).trim();

    if (q.length < CONFIG.minSearchLength) {
      clearResults();
      return;
    }

    const tokens = q.split(/\s+/).filter(Boolean);

    const results = childrenData.filter((child) => {
      const haystack = normalize(
        `${child.fullName} ${child.teamLeader} ${child.parentName || ''} ${child.phone || ''}`
      );
      return tokens.every((token) => haystack.includes(token));
    });

    renderResults(results, q);
  }

  function highlightMatch(text, query) {
    if (!text) return '—';
    const tokens = normalize(query).split(/\s+/).filter(Boolean);
    if (tokens.length === 0) return escapeHTML(text);

    return escapeHTML(text).replace(
      new RegExp(`(${tokens.map((t) => escapeRegex(escapeHTML(t))).join('|')})`, 'gi'),
      '<span class="search-results__highlight">$1</span>'
    );
  }

  function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function escapeHTML(str) {
    const div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  }

  function renderResults(results, query) {
    searchResults.innerHTML = '';

    if (results.length === 0) {
      searchResults.innerHTML =
        '<div class="search-results__empty">😕 Нікого не знайдено. Спробуйте інший запит.</div>';
      searchResults.classList.add('search-results--visible');
      return;
    }

    const ul = document.createElement('ul');
    ul.className = 'search-results__list';

    results.forEach((child) => {
      const li = document.createElement('li');
      li.className = 'search-results__item';
      li.innerHTML = `
        <div class="search-results__item-info">
          <span class="search-results__item-name">${highlightMatch(child.fullName, query)}</span>
          <span class="search-results__item-meta">
            ${escapeHTML(child.age || '—')} р. · Тім-лідер: ${escapeHTML(child.teamLeader || '—')}
          </span>
        </div>
        <span class="search-results__item-badge">${escapeHTML(child.age || '—')} р.</span>
      `;

      li.addEventListener('click', () => selectChild(child));
      ul.appendChild(li);
    });

    searchResults.appendChild(ul);
    searchResults.classList.add('search-results--visible');
  }

  function clearResults() {
    searchResults.innerHTML = '';
    searchResults.classList.remove('search-results--visible');
  }

  function selectChild(child) {
    selectedChild = child;

    // Автозаповнення полів (readonly)
    fieldFullName.value = child.fullName || '';
    fieldAge.value = child.age || '';
    fieldTeamLeader.value = child.teamLeader || '';
    fieldParentName.value = child.parentName || '';
    fieldPhone.value = child.phone || '';
    fieldHealthInfo.value = child.healthInfo || '';

    // Візуальний фідбек
    searchInput.value = child.fullName;
    clearResults();

    showToast(`Обрано: ${child.fullName}`, 'success');

    // Показати історію звернень цієї дитини
    showChildHistory(child.fullName);

    // Фокус на температуру
    fieldTemperature.focus();

    console.log('[WOW Medical] Обрано дитину:', child);
  }

  /* ========================================
     Історія звернень
     ======================================== */

  function showChildHistory(fullName) {
    var examinations = typeof getExaminations === 'function' ? getExaminations() : [];

    // Фільтруємо записи за ПІБ дитини
    var childHistory = examinations.filter(function(exam) {
      return exam.fullName && normalize(exam.fullName) === normalize(fullName);
    });

    // Сортуємо від новіших до старіших
    childHistory.reverse();

    historyCount.textContent = childHistory.length;

    if (childHistory.length === 0) {
      historySection.style.display = 'none';
      return;
    }

    historySection.style.display = 'block';

    historyBody.innerHTML = childHistory.map(function(exam) {
      var mpLabel = exam.medicalPoint === 'black' ? 'Чорний' : 'Білий';
      var mpClass = exam.medicalPoint === 'black' ? 'data-table__mp-badge--black' : 'data-table__mp-badge--white';

      return (
        '<tr>' +
        '<td>' + escapeHTML(exam.timestamp || '—') + '</td>' +
        '<td><span class="data-table__mp-badge ' + mpClass + '">' + mpLabel + '</span></td>' +
        '<td>' + (exam.temperature ? escapeHTML(exam.temperature) + '°C' : '—') + '</td>' +
        '<td class="data-table__cell--wrap">' + escapeHTML(exam.complaints || '—') + '</td>' +
        '<td class="data-table__cell--wrap">' + escapeHTML(exam.assistance || '—') + '</td>' +
        '<td class="data-table__cell--wrap">' + escapeHTML(exam.prescriptions || '—') + '</td>' +
        '<td>' + (exam.parentsNotified
          ? '<span class="data-table__badge data-table__badge--yes">Так</span>'
          : '<span class="data-table__badge data-table__badge--no">Ні</span>') + '</td>' +
        '</tr>'
      );
    }).join('');
  }

  /* ========================================
     Вибір медпункту
     ======================================== */

  function setMedicalPoint(point) {
    selectedMedicalPoint = point;
    if (point === 'white') {
      mpWhiteBtn.classList.add('mp-btn--active');
      mpBlackBtn.classList.remove('mp-btn--active');
    } else {
      mpBlackBtn.classList.add('mp-btn--active');
      mpWhiteBtn.classList.remove('mp-btn--active');
    }
  }

  /* ========================================
     Debounce
     ======================================== */

  function debounceSearch() {
    clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(() => {
      searchChildren(searchInput.value);
    }, CONFIG.searchDebounce);
  }

  /* ========================================
     Форма
     ======================================== */

  function collectFormData() {
    const now = new Date();
    const timestamp = now.toLocaleString('uk-UA', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });

    return {
      fullName: fieldFullName.value.trim(),
      age: fieldAge.value.trim(),
      teamLeader: fieldTeamLeader.value.trim(),
      parentName: fieldParentName.value.trim(),
      phone: fieldPhone.value.trim(),
      healthInfo: fieldHealthInfo.value.trim(),
      medicalPoint: selectedMedicalPoint,
      temperature: fieldTemperature.value.trim(),
      complaints: fieldComplaints.value.trim(),
      assistance: fieldAssistance.value.trim(),
      prescriptions: fieldPrescriptions.value.trim(),
      parentsNotified: fieldParentsNotified.checked,
      timestamp
    };
  }

  function validateForm(data) {
    if (!data.fullName) {
      showToast('Будь ласка, оберіть дитину через пошук', 'error');
      searchInput.focus();
      return false;
    }
    if (data.temperature && (isNaN(data.temperature) || data.temperature < 34 || data.temperature > 43)) {
      showToast('Температура має бути від 34°C до 43°C', 'error');
      fieldTemperature.focus();
      return false;
    }
    return true;
  }

  async function handleSubmit(event) {
    event.preventDefault();

    const data = collectFormData();

    if (!validateForm(data)) return;

    // Виведення в консоль
    console.log('══════════════════════════════════');
    console.log('📋 Дані огляду:');
    console.log('──────────────────────────────────');
    console.log('🏥 Медпункт:          ', data.medicalPoint === 'white' ? 'Білий' : 'Чорний');
    console.log('👤 ПІБ дитини:        ', data.fullName);
    console.log('🔢 Вік:               ', data.age || '—');
    console.log('🧑‍🏫 Тім-лідер:         ', data.teamLeader || '—');
    console.log('👨 ПІБ батьків:        ', data.parentName || '—');
    console.log('📞 Телефон батьків:   ', data.phone || '—');
    console.log('💊 Стан здоров\'я:     ', data.healthInfo || '—');
    console.log('🌡️ Температура:       ', data.temperature || '—');
    console.log('💬 Скарги:            ', data.complaints || '—');
    console.log('🩺 Надана допомога:    ', data.assistance || '—');
    console.log('📝 Призначення:       ', data.prescriptions || '—');
    console.log('📢 Повідомлено батьків:', data.parentsNotified ? 'Так' : 'Ні');
    console.log('🕐 Дата/час огляду:   ', data.timestamp);
    console.log('══════════════════════════════════');

    // Відправка через API (Google Apps Script)
    const result = await saveVisit(data);

    if (result.success) {
      showToast('✅ Дані збережено!', 'success');
      resetForm();
    } else {
      showToast(result.message, 'error');
    }
  }

  function resetForm() {
    form.reset();
    selectedChild = null;
    searchInput.value = '';
    fieldFullName.value = '';
    fieldAge.value = '';
    fieldTeamLeader.value = '';
    fieldParentName.value = '';
    fieldPhone.value = '';
    fieldHealthInfo.value = '';
    fieldTemperature.value = '';
    fieldComplaints.value = '';
    fieldAssistance.value = '';
    fieldPrescriptions.value = '';
    fieldParentsNotified.checked = false;
    // Медпункт скидаємо на білий
    setMedicalPoint('white');
    // Ховаємо історію
    historySection.style.display = 'none';
    searchInput.focus();
  }

  /* ========================================
     Toast-повідомлення
     ======================================== */

  let toastTimer = null;

  function showToast(message, type) {
    const existing = document.querySelector('.toast');
    if (existing) existing.remove();
    if (toastTimer) clearTimeout(toastTimer);

    const toast = document.createElement('div');
    toast.className = `toast toast--${type || 'info'}`;
    toast.textContent = message;
    document.body.appendChild(toast);

    requestAnimationFrame(() => {
      toast.classList.add('toast--visible');
    });

    toastTimer = setTimeout(() => {
      toast.classList.remove('toast--visible');
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  }

  /* ========================================
     Підписки на події
     ======================================== */

  function init() {
    // Якщо localStorage порожній — показуємо підказку
    if (childrenData.length === 0) {
      showToast('База порожня. Імпортуйте дітей через Admin-панель.', 'error');
    }

    // Медпункт: обробники
    mpWhiteBtn.addEventListener('click', function() { setMedicalPoint('white'); });
    mpBlackBtn.addEventListener('click', function() { setMedicalPoint('black'); });

    // Пошук: реальний час
    searchInput.addEventListener('input', debounceSearch);

    // Кнопка пошуку
    searchBtn.addEventListener('click', () => {
      searchChildren(searchInput.value);
    });

    // Enter у полі пошуку
    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        searchChildren(searchInput.value);
      }
    });

    // Клік поза результатами — закрити
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.search-section')) {
        clearResults();
      }
    });

    // Сабміт форми
    form.addEventListener('submit', handleSubmit);

    // Слухаємо зміни в localStorage з інших вкладок
    window.addEventListener('storage', (e) => {
      if (e.key === STORAGE_KEY) {
        loadChildren();
        console.log('[WOW Medical] Дані оновлено з іншої вкладки');
      }
    });

    // Фокус на пошук при завантаженні
    searchInput.focus();
  }

  /* ========================================
     Старт
     ======================================== */

   (async () => {
     await loadChildren();
     init();
   })();
})();