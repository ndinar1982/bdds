/**
 * Семейный бюджет — сервер на Google Apps Script (v8.58).
 * Листы: «Данные» (БДДС: декады × статьи), «БДР» (месяцы × категории бюджета), «Счета» (счета, статьи, категории), «Настройки».
 * Все суммы хранятся положительными. Новая установка: один раз запустите setup.
 * Обновление с прошлой версии: при первом открытии данные переведутся сами.
 */
const APP_VERSION = '8.58';
const SHEET_DATA = 'Данные';
const SHEET_BDR = 'БДР';
const SHEET_SET = 'Настройки';
const SHEET_ACC = 'Счета';
const TYPES = ['cash', 'income', 'expense', 'credit', 'savings', 'debt', 'bcat'];
const SUFFIX = {
  credit: [['_in', 'пополнение'], ['_out', 'снятие'], ['_exp', 'покупки']],
  savings: [['_in', 'положил'], ['_out', 'взял']],
  debt: [['_in', 'взял в долг / мне вернули'], ['_out', 'дал в долг / я вернул']]
};
const DEFAULT_ITEMS = [
  {id:'cash',type:'cash',name:'Наличка и дебет'},
  {id:'inc_salary',type:'income',name:'ЗП, премии, кэшбэк'},
  {id:'inc_benefit',type:'income',name:'Пособия, вычеты, льготы'},
  {id:'inc_interest',type:'income',name:'Проценты, дивиденды'},
  {id:'mort',type:'expense',name:'Ипотека'},
  {id:'cash_exp',type:'expense',name:'Покупки: нал / дебет'},
  {id:'sber',type:'credit',name:'Сбер'},
  {id:'tb',type:'credit',name:'Т-Банк'},
  {id:'alfa',type:'credit',name:'Альфа'},
  {id:'sov',type:'credit',name:'Совком'},
  {id:'sav',type:'savings',name:'Накопления (НЗ)'},
  {id:'fund',type:'savings',name:'Фонд крупных покупок'},
  {id:'debt',type:'debt',name:'Мне должны'}
];
const DEFAULT_BCATS = [{"id": "b_mort", "type": "bcat", "group": "Обязательные", "name": "Ипотека"}, {"id": "b_utils", "type": "bcat", "group": "Обязательные", "name": "ЖКХ и связь"}, {"id": "b_kids", "type": "bcat", "group": "Обязательные", "name": "Дети"}, {"id": "b_auto", "type": "bcat", "group": "Обязательные", "name": "Авто: топливо, ТО, шины"}, {"id": "b_parents", "type": "bcat", "group": "Обязательные", "name": "Родители"}, {"id": "b_ins", "type": "bcat", "group": "Обязательные", "name": "Страховки"}, {"id": "b_tax", "type": "bcat", "group": "Обязательные", "name": "Налоги, госпошлины"}, {"id": "b_food", "type": "bcat", "group": "Повседневные", "name": "Продукты"}, {"id": "b_home", "type": "bcat", "group": "Повседневные", "name": "Товары для дома, химия"}, {"id": "b_med", "type": "bcat", "group": "Повседневные", "name": "Лекарства, медицина"}, {"id": "b_beauty", "type": "bcat", "group": "Повседневные", "name": "Красота"}, {"id": "b_sport", "type": "bcat", "group": "Повседневные", "name": "Спорт, фитнес"}, {"id": "b_services", "type": "bcat", "group": "Повседневные", "name": "Услуги разные"}, {"id": "b_cafe", "type": "bcat", "group": "Необязательные", "name": "Кафе, еда вне дома"}, {"id": "b_gifts", "type": "bcat", "group": "Необязательные", "name": "Подарки"}, {"id": "b_fun", "type": "bcat", "group": "Необязательные", "name": "Развлечения"}, {"id": "b_books", "type": "bcat", "group": "Необязательные", "name": "Книги, канцтовары"}, {"id": "b_habits", "type": "bcat", "group": "Необязательные", "name": "Вредные привычки"}, {"id": "b_clothes", "type": "bcat", "group": "Цели и годовые расходы", "name": "Одежда, обувь"}, {"id": "b_vacation", "type": "bcat", "group": "Цели и годовые расходы", "name": "Отпуск"}, {"id": "b_edu", "type": "bcat", "group": "Цели и годовые расходы", "name": "Образование"}];
const SEED = {
  config: [
    {id:'cash',type:'cash',name:'Наличка и дебет',opening:0},
    {id:'inc_salary',type:'income',name:'ЗП, премии, кэшбэк'},
    {id:'mort',type:'expense',name:'Ипотека'},
    {id:'cash_exp',type:'expense',name:'Покупки: нал / дебет'}
  ],
  decades: {}
};

// Публичная иконка приложения. Тот же файл используется для favicon и iPhone Home Screen.
const APP_ICON_URL = 'https://ndinar1982.github.io/bdds/favicon-32.png?v=850';

function doGet() {
  const out = HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('Семейный бюджет')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover')
    // ALLOWALL оставлен намеренно: мобильная пусковая страница открывает приложение во фрейме.
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  try { out.setFaviconUrl(APP_ICON_URL); } catch (e) {}
  // Apps Script игнорирует meta-теги, вписанные прямо в HTML-файл, поэтому мобильные теги добавляем сервером.
  try { out.addMetaTag('theme-color', '#2f87d0'); } catch (e) {}
  try { out.addMetaTag('mobile-web-app-capable', 'yes'); } catch (e) {}
  try { out.addMetaTag('apple-mobile-web-app-capable', 'yes'); } catch (e) {}
  try { out.addMetaTag('apple-mobile-web-app-title', 'Семейный бюджет'); } catch (e) {}
  try { out.addMetaTag('apple-mobile-web-app-status-bar-style', 'default'); } catch (e) {}
  return out;
}

function ss_() {
  const id = PropertiesService.getScriptProperties().getProperty('SHEET_ID');
  if (id) return SpreadsheetApp.openById(id);
  const a = SpreadsheetApp.getActiveSpreadsheet();
  if (!a) throw new Error('Сначала запустите функцию setup в редакторе Apps Script.');
  return a;
}

/**
 * Для отдельной тестовой копии проекта: создаёт копию текущей Google Таблицы и переключает
 * ТОЛЬКО этот Apps Script-проект на неё. Рабочая таблица не меняется.
 * Запускайте эту функцию уже в скопированном тестовом Apps Script-проекте.
 */
function createSandboxDataCopy() {
  const source = ss_();
  const stamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HHmm');
  const copyFile = DriveApp.getFileById(source.getId()).makeCopy(source.getName() + ' — TEST v8 ' + stamp);
  const copy = SpreadsheetApp.openById(copyFile.getId());
  PropertiesService.getScriptProperties().setProperty('SHEET_ID', copy.getId());
  return { id: copy.getId(), name: copy.getName(), url: copy.getUrl(), version: APP_VERSION };
}

function ensureSize_(sh, rows, cols) {
  if (sh.getMaxColumns() < cols) sh.insertColumnsAfter(sh.getMaxColumns(), cols - sh.getMaxColumns());
  if (sh.getMaxRows() < rows) sh.insertRowsAfter(sh.getMaxRows(), rows - sh.getMaxRows());
}

function uniqueName_(ss, base) {
  let name = base, n = 2;
  while (ss.getSheetByName(name)) name = base + ' ' + (n++);
  return name;
}

function rowIds_(item) {
  if (item.type === 'income' || item.type === 'expense') return [item.id];
  return (SUFFIX[item.type] || []).map(function (s) { return item.id + s[0]; });
}

function labels_(items) {
  const m = {};
  items.forEach(function (it) {
    if (it.type === 'income' || it.type === 'expense' || it.type === 'bcat') m[it.id] = it.name;
    (SUFFIX[it.type] || []).forEach(function (s) { m[it.id + s[0]] = it.name + ': ' + s[1]; });
  });
  return m;
}

function colLabel_(colId, labels) {
  const p = String(colId).split('|');
  const base = labels[p[0]] || p[0];
  return base + (p[1] === 'p' ? ' · план' : p[1] === 'f' ? ' · факт' : '');
}

function writeGridSheet_(sh, head1, head2, data, firstTitle) {
  ensureSize_(sh, Math.max(data.length + 3, 50), Math.max(head2.length, 4));
  sh.getRange(1, 1, sh.getMaxRows(), 3).setNumberFormat('@');
  sh.getRange(1, 1, 1, head1.length).setValues([head1]).setFontWeight('bold').setWrap(true).setVerticalAlignment('top');
  sh.getRange(2, 1, 1, head2.length).setValues([head2]);
  if (data.length) sh.getRange(3, 1, data.length, head2.length).setValues(data);
  if (head2.length > 3) {
    sh.getRange(3, 4, sh.getMaxRows() - 2, head2.length - 3).setNumberFormat('#,##0.00');
    sh.setColumnWidths(4, head2.length - 3, 110);
  }
  sh.setFrozenRows(2); sh.setFrozenColumns(1); sh.hideRows(2); sh.setRowHeight(1, 48);
}

function ensureBdrSheet_(ss, items) {
  let sh = ss.getSheetByName(SHEET_BDR);
  if (sh && sh.getLastRow() >= 2) return sh;
  if (!sh) sh = ss.insertSheet(SHEET_BDR);
  const labels = labels_(items);
  const cols = [];
  items.filter(function (x) { return x.type === 'bcat'; }).forEach(function (c) { cols.push(c.id + '|p', c.id + '|f'); });
  writeGridSheet_(sh, ['Месяц', 'Начало', 'Конец'].concat(cols.map(function (c) { return colLabel_(c, labels); })), ['key', 'start', 'end'].concat(cols), []);
  return sh;
}

function writeAcc_(ss, items) {
  let sh = ss.getSheetByName(SHEET_ACC);
  if (!sh) sh = ss.insertSheet(SHEET_ACC);
  sh.clear();
  const rows = [['id', 'Тип', 'Название', 'Лимит', 'Остаток на старте', 'Скрыт', 'Группа', 'Вне бюджета', 'Фикс. платёж', 'Корректировки остатков', 'История лимитов']];
  items.forEach(function (it) {
    rows.push([it.id, it.type, it.name, it.limit || '', typeof it.opening === 'number' ? it.opening : '', it.hidden ? true : false, it.group || '', it.off ? true : false, it.fixed ? true : false,
      Array.isArray(it.balanceHistory) && it.balanceHistory.length ? JSON.stringify(it.balanceHistory) : '',
      Array.isArray(it.limitHistory) && it.limitHistory.length ? JSON.stringify(it.limitHistory) : '']);
  });
  ensureSize_(sh, rows.length + 1, 11);
  sh.getRange(1, 1, rows.length, 11).setValues(rows);
  sh.getRange(1, 1, 1, 11).setFontWeight('bold');
  sh.setFrozenRows(1); sh.setColumnWidth(3, 220);
}

function readItems_(ss) {
  const sh = ss.getSheetByName(SHEET_ACC);
  let out = [];
  // весь лист одним запросом (раньше — три: число строк, размер листа и сами данные)
  const all = sh ? sh.getDataRange().getValues() : [];
  if (all.length >= 2) {
    all.slice(1).forEach(function (r) {
      while (r.length < 11) r.push('');
      const id = String(r[0]).trim(), type = String(r[1]).trim();
      if (!id || TYPES.indexOf(type) < 0) return;
      const it = { id: id, type: type, name: String(r[2] || id) };
      if (typeof r[3] === 'number' && r[3]) it.limit = r[3];
      if (['cash', 'credit', 'savings', 'debt'].indexOf(type) >= 0) it.opening = Number(r[4]) || 0;
      if (r[5] === true || /^(да|true|1)$/i.test(String(r[5]))) it.hidden = true;
      if (type === 'bcat') it.group = String(r[6] || 'Без группы');
      if (['credit', 'savings', 'debt'].indexOf(type) >= 0 && (r[7] === true || /^(да|true|1)$/i.test(String(r[7])))) it.off = true;
      if ((type === 'expense' || type === 'bcat') && (r[8] === true || /^(да|true|1)$/i.test(String(r[8])))) it.fixed = true;
      try {
        const h = JSON.parse(String(r[9] || '[]'));
        if (Array.isArray(h)) it.balanceHistory = h.filter(function (x) { return x && /^\d{4}-\d{2}-\d{2}$/.test(String(x.date || '')) && Number.isFinite(Number(x.delta)); }).map(function (x) { return { date: String(x.date), delta: Number(x.delta), value: Number.isFinite(Number(x.value)) ? Number(x.value) : undefined }; });
      } catch (e) {}
      try {
        const h = JSON.parse(String(r[10] || '[]'));
        if (Array.isArray(h)) it.limitHistory = h.filter(function (x) { return x && /^\d{4}-\d{2}-\d{2}$/.test(String(x.date || '')) && Number.isFinite(Number(x.value)); }).map(function (x) { return { date: String(x.date), value: Math.max(0, Number(x.value)) }; });
      } catch (e) {}
      out.push(it);
    });
  }
  if (!out.length) out = DEFAULT_ITEMS.slice();
  return out;
}

function readGrid_(sh) {
  const out = {};
  if (!sh) return out;
  // Значения — одним запросом; текст (как он виден в таблице) нужен только для первых трёх столбцов: ключ и даты декады.
  // Раньше текстом читался весь лист — это самая медленная часть загрузки.
  const vals = sh.getDataRange().getValues();
  if (vals.length < 3) return out;
  const disp = sh.getRange(1, 1, vals.length, 3).getDisplayValues();
  const ids = vals[1] || [];
  for (let i = 2; i < vals.length; i++) {
    const key = disp[i][0]; if (!key) continue;
    const d = { start: disp[i][1], end: disp[i][2], v: {} };
    for (let j = 3; j < ids.length; j++) {
      const x = vals[i][j];
      if (typeof x === 'number') { const p = String(ids[j]).split('|'); (d.v[p[0]] = d.v[p[0]] || {})[p[1]] = Math.abs(x); }
    }
    out[key] = d;
  }
  return out;
}

/** Новая установка или ручной запуск обновления. Существующие данные не удаляет. */
function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const props = PropertiesService.getScriptProperties();
  props.setProperty('SHEET_ID', ss.getId());
  const sh = ss.getSheetByName(SHEET_DATA);
  if (sh && sh.getLastRow() >= 2) { migrate_(); return 'Готово: данные на месте'; }
  const items = SEED.config;
  const labels = labels_(items);
  const cols = [];
  items.forEach(function (it) { rowIds_(it).forEach(function (rid) { cols.push(rid + '|p', rid + '|f'); }); });
  const data = Object.keys(SEED.decades).sort().map(function (k) {
    const d = SEED.decades[k];
    return [k, d.start, d.end].concat(cols.map(function (c) { const p = c.split('|'); const e = d.v[p[0]] || {}; return typeof e[p[1]] === 'number' ? e[p[1]] : ''; }));
  });
  writeGridSheet_(sh || ss.insertSheet(SHEET_DATA), ['Декада', 'Начало', 'Конец'].concat(cols.map(function (c) { return colLabel_(c, labels); })), ['key', 'start', 'end'].concat(cols), data);
  writeAcc_(ss, items);
  ensureBdrSheet_(ss, items);
  let st = ss.getSheetByName(SHEET_SET);
  if (!st) st = ss.insertSheet(SHEET_SET);
  if (st.getLastRow() < 1) {
    st.getRange(1, 1, 2, 3).setValues([['key', 'value', 'Что это'], ['factDate', '', 'Факт закрыт по (ГГГГ-ММ-ДД); пусто — сегодня']]);
    st.getRange('B2').setNumberFormat('@'); st.getRange(1, 1, 1, 3).setFontWeight('bold'); st.setColumnWidth(3, 320);
  }
  props.setProperty('SCHEMA', '4');
  return 'Готово: ' + APP_VERSION;
}

/** Обновление данных прошлых версий. v1→v2: кредитки — две строки, суммы положительные. v2→v3: категории и лист «БДР». */
function migrate_() {
  const props = PropertiesService.getScriptProperties();
  if (props.getProperty('SCHEMA') === '4') return;
  const lock = LockService.getScriptLock(); lock.waitLock(30000);
  try {
    const ss = ss_();
    const sc = props.getProperty('SCHEMA');
    if (sc !== '2' && sc !== '3' && sc !== '4') migrateV2_(ss);
    if (props.getProperty('SCHEMA') === '2') {
      const items = readItems_(ss);
      writeAcc_(ss, items);
      ensureBdrSheet_(ss, items);
      props.setProperty('SCHEMA', '3');
    }
    if (props.getProperty('SCHEMA') === '3') { migrateV4_(ss); props.setProperty('SCHEMA', '4'); }
  } finally { lock.releaseLock(); }
}

/**
 * Версия 4: разбивка по категориям — только в Бюджете.
 *  • Статьи расходов БДДС, кроме ипотеки, «Покупок: нал / дебет» и статей, на счета которых идут платежи
 *    (сопоставление счетов Дзен-мани), становятся категориями Бюджета (план и факт по месяцам, лист «БДР»).
 *  • Их суммы в БДДС переходят в «Покупки: нал / дебет» (план и факт по декадам), в Бюджет — суммы за месяц.
 *  • Старые категории Бюджета по умолчанию (b_…), которые давно нигде не показывались, убираются из списка;
 *    их суммы на листе «БДР» остаются как были.
 */
function migrateV4_(ss) {
  const items = readItems_(ss);
  const legacy = {}; DEFAULT_BCATS.forEach(function (x) { legacy[x.id] = true; });
  const ids = {}; items.forEach(function (x) { ids[x.id] = x; });
  const keep = { mort: true, cash_exp: true };
  try { const zm = JSON.parse(PropertiesService.getScriptProperties().getProperty('ZEN_MAP') || 'null'); if (zm && zm.accounts) Object.keys(zm.accounts).forEach(function (k) { keep[zm.accounts[k]] = true; }); } catch (e) {}
  const buy = ids.cash_exp && ids.cash_exp.type === 'expense';
  const conv = buy ? items.filter(function (x) { return x.type === 'expense' && !keep[x.id] && !/ипотек/i.test(x.name); }) : [];
  const out = items.filter(function (x) { return !(x.type === 'bcat' && legacy[x.id]); }).map(function (x) {
    return conv.indexOf(x) >= 0 ? { id: x.id, type: 'bcat', name: x.name, hidden: x.hidden, group: 'Без группы' } : x;
  });
  if (conv.length) {
    const sh = ss.getSheetByName(SHEET_DATA);
    const vals = sh ? sh.getDataRange().getValues() : [];
    const disp = vals.length >= 3 ? sh.getRange(1, 1, vals.length, 3).getDisplayValues() : [];
    const col = {}; (vals[1] || []).forEach(function (id, j) { if (id) col[String(id)] = j; });
    const num = function (row, id) { const j = col[id]; const x = j === undefined ? '' : row[j]; return typeof x === 'number' ? Math.abs(x) : 0; };
    const changes = [], mon = {};
    for (let i = 2; i < vals.length; i++) {
      const key = disp[i][0]; if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) continue;
      const row = vals[i], dec = { key: key, start: disp[i][1], end: disp[i][2] };
      let p = 0, f = 0;
      conv.forEach(function (it) {
        const ip = num(row, it.id + '|p'), iff = num(row, it.id + '|f'), cc = num(row, it.id + '_cc|f');
        if (!ip && !iff && !cc) return;
        p += ip; f += iff;
        const m = key.slice(0, 7), M = mon[m] || (mon[m] = { start: dec.start, end: dec.end, v: {} });
        if (dec.start < M.start) M.start = dec.start; if (dec.end > M.end) M.end = dec.end;
        const e = M.v[it.id] || (M.v[it.id] = { p: 0, f: 0 }); e.p += ip; e.f += iff + cc;
        if (ip) changes.push({ sheet: 'decades', key: key, start: dec.start, end: dec.end, rid: it.id, k: 'p', value: null });
        if (iff) changes.push({ sheet: 'decades', key: key, start: dec.start, end: dec.end, rid: it.id, k: 'f', value: null });
        if (cc) changes.push({ sheet: 'decades', key: key, start: dec.start, end: dec.end, rid: it.id + '_cc', k: 'f', value: null });
      });
      if (p) changes.push({ sheet: 'decades', key: key, start: dec.start, end: dec.end, rid: 'cash_exp', k: 'p', value: Math.round((num(row, 'cash_exp|p') + p) * 100) / 100 });
      if (f) changes.push({ sheet: 'decades', key: key, start: dec.start, end: dec.end, rid: 'cash_exp', k: 'f', value: Math.round((num(row, 'cash_exp|f') + f) * 100) / 100 });
    }
    const labels = labels_(out);
    Object.keys(mon).forEach(function (m) {
      Object.keys(mon[m].v).forEach(function (id) {
        const e = mon[m].v[id];
        ['p', 'f'].forEach(function (k) { if (e[k]) changes.push({ sheet: 'months', key: m, start: mon[m].start, end: mon[m].end, rid: id, k: k, value: Math.round(e[k] * 100) / 100, label: labels[id] }); });
      });
    });
    writeAcc_(ss, out);
    writeChanges_(ss, changes);
  } else writeAcc_(ss, out);
  const labels = labels_(out);
  relabel_(ss.getSheetByName(SHEET_DATA), labels);
  relabel_(ss.getSheetByName(SHEET_BDR), labels);
}

function migrateV2_(ss) {
  const props = PropertiesService.getScriptProperties();
  const st = ss.getSheetByName(SHEET_SET);
  const openings = {};
  if (st && st.getLastRow() > 1) {
    st.getRange(2, 1, st.getLastRow() - 1, 2).getValues().forEach(function (r) {
      const k = String(r[0]); if (k.indexOf('opening_') === 0) openings[k.slice(8)] = Number(r[1]) || 0;
    });
  }
  const items = DEFAULT_ITEMS.map(function (x) {
    const it = JSON.parse(JSON.stringify(x));
    if (['cash', 'credit', 'savings', 'debt'].indexOf(it.type) >= 0) it.opening = openings[it.id] || 0;
    return it;
  });
  const sh = ss.getSheetByName(SHEET_DATA);
  if (sh && sh.getLastRow() >= 2) {
    sh.copyTo(ss).setName(uniqueName_(ss, 'Данные (копия до обновления)'));
    const lastRow = sh.getLastRow(), lastCol = sh.getLastColumn();
    const vals = sh.getRange(1, 1, lastRow, lastCol).getValues();
    const disp = sh.getRange(1, 1, lastRow, 3).getDisplayValues();
    const ids = vals[1].map(String);
    const order = [], colIdx = {};
    for (let j = 3; j < ids.length; j++) {
      if (!ids[j]) continue;
      const p = ids[j].split('|');
      if (!colIdx[p[0]]) { colIdx[p[0]] = {}; order.push(p[0]); }
      colIdx[p[0]][p[1]] = j;
    }
    const outCols = [];
    order.forEach(function (rid) {
      const c = colIdx[rid];
      if (/_tr$/.test(rid)) {
        const base = rid.slice(0, -3);
        ['_in', '_out'].forEach(function (suf) {
          ['p', 'f'].forEach(function (k) {
            outCols.push({ id: base + suf + '|' + k, get: function (r) {
              const x = c[k] === undefined ? '' : r[c[k]];
              if (typeof x !== 'number' || !x) return '';
              return suf === '_in' ? (x > 0 ? x : '') : (x < 0 ? -x : '');
            } });
          });
        });
      } else {
        ['p', 'f'].forEach(function (k) {
          if (c[k] === undefined) return;
          outCols.push({ id: rid + '|' + k, get: function (r) { const x = r[c[k]]; return typeof x === 'number' ? Math.abs(x) : ''; } });
        });
      }
    });
    const labels = labels_(items);
    const data = [];
    for (let i = 2; i < lastRow; i++) {
      if (!disp[i][0]) continue;
      data.push([disp[i][0], disp[i][1], disp[i][2]].concat(outCols.map(function (o) { return o.get(vals[i]); })));
    }
    sh.clear();
    writeGridSheet_(sh, ['Декада', 'Начало', 'Конец'].concat(outCols.map(function (o) { return colLabel_(o.id, labels); })), ['key', 'start', 'end'].concat(outCols.map(function (o) { return o.id; })), data);
  }
  if (!ss.getSheetByName(SHEET_ACC)) writeAcc_(ss, items);
  if (st && st.getLastRow() > 1) {
    for (let i = st.getLastRow(); i >= 2; i--) {
      if (String(st.getRange(i, 1).getValue()).indexOf('opening_') === 0) st.deleteRow(i);
    }
  }
  props.setProperty('SCHEMA', '2');
}

function getAll() {
  migrate_();
  const ss = ss_();
  const sh = ss.getSheetByName(SHEET_DATA);
  if (!sh) throw new Error('Нет листа «Данные». Запустите setup.');
  const settings = { factDate: null };
  const st = ss.getSheetByName(SHEET_SET);
  if (st && st.getLastRow() > 1) {
    const n = st.getLastRow() - 1;
    const sv = st.getRange(2, 1, n, 2).getValues(), sd = st.getRange(2, 1, n, 2).getDisplayValues();
    sv.forEach(function (r, i) {
      if (String(r[0]) === 'order') { settings.order = String(sd[i][1] || '') || null; return; }
      if (String(r[0]) === 'nav') { settings.nav = String(sd[i][1] || '') || null; return; }
      if (String(r[0]) === 'launch') { settings.launch = String(sd[i][1] || '') || null; return; }
      if (String(r[0]) === 'opsFilter') { settings.opsFilter = String(sd[i][1] || '') || null; return; }
      if (String(r[0]) === 'opsPresets') { settings.opsPresets = String(sd[i][1] || '') || null; return; }
      if (String(r[0]) === 'opsPreset') { settings.opsPreset = String(sd[i][1] || '') || null; return; }
      if (String(r[0]) !== 'factDate') return;
      settings.factDate = /^\d{4}-\d{2}-\d{2}$/.test(sd[i][1]) ? sd[i][1] : (r[1] instanceof Date ? Utilities.formatDate(r[1], ss.getSpreadsheetTimeZone(), 'yyyy-MM-dd') : null);
    });
  }
  let appUrl = ''; try { appUrl = ScriptApp.getService().getUrl() || ''; } catch (e) {}
  return { version: APP_VERSION, settings: settings, config: readItems_(ss), decades: readGrid_(sh), months: readGrid_(ss.getSheetByName(SHEET_BDR)), url: ss.getUrl(), sheetName: ss.getName(), appUrl: appUrl };
}

function setCells(changes) {
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  try { writeChanges_(ss_(), changes); } finally { lock.releaseLock(); }
  return true;
}

/** Запись изменений в листы «Данные» (декады) и «БДР» (месяцы) — без блокировки (её держит вызывающий). */
function writeChanges_(ss, changes) {
  {
    const ctx = {};
    const open = function (name) {
      if (ctx[name]) return ctx[name];
      const sh = name === 'months' ? ensureBdrSheet_(ss, readItems_(ss)) : ss.getSheetByName(SHEET_DATA);
      const c = { sh: sh, colOf: {}, rowOf: {}, lastRow: Math.max(sh.getLastRow(), 2), lastCol: Math.max(sh.getLastColumn(), 3) };
      // нужны только строка с id столбцов и столбец ключей — читаем их, а не весь лист
      sh.getRange(2, 1, 1, c.lastCol).getDisplayValues()[0].forEach(function (id, j) { if (id) c.colOf[id] = j + 1; });
      const keys = sh.getRange(1, 1, c.lastRow, 1).getDisplayValues();
      for (let i = 2; i < keys.length; i++) if (keys[i][0]) c.rowOf[keys[i][0]] = i + 1;
      return (ctx[name] = c);
    };
    changes.forEach(function (ch) {
      const months = ch.sheet === 'months';
      const keyOk = months ? /^\d{4}-\d{2}$/.test(ch.key) : /^\d{4}-\d{2}-\d{2}$/.test(ch.key);
      if (!keyOk || !/^[A-Za-z0-9_]+$/.test(ch.rid) || (ch.k !== 'p' && ch.k !== 'f')) return;
      const c = open(months ? 'months' : 'decades'), sh = c.sh;
      const colId = ch.rid + '|' + ch.k;
      let col = c.colOf[colId];
      if (!col) {
        c.lastCol++; col = c.lastCol; ensureSize_(sh, c.lastRow + 1, col);
        sh.getRange(1, col).setValue(String(ch.label || ch.rid) + (ch.k === 'p' ? ' · план' : ' · факт')).setFontWeight('bold').setWrap(true);
        sh.getRange(2, col).setValue(colId);
        sh.getRange(3, col, sh.getMaxRows() - 2, 1).setNumberFormat('#,##0.00');
        c.colOf[colId] = col;
      }
      let r = c.rowOf[ch.key];
      if (!r) { c.lastRow++; r = c.lastRow; ensureSize_(sh, r, c.lastCol); sh.getRange(r, 1, 1, 3).setNumberFormat('@').setValues([[ch.key, ch.start, ch.end]]); c.rowOf[ch.key] = r; }
      const v = ch.value === null || ch.value === '' || ch.value === undefined ? null : Math.abs(Number(ch.value));
      (c.todo || (c.todo = [])).push([r, col, v]);
    });
    Object.keys(ctx).forEach(function (name) { if (ctx[name].todo) writeCells_(ctx[name].sh, ctx[name].todo); });
    SpreadsheetApp.flush();
  }
}

/**
 * Запись изменённых ячеек ([строка, столбец, число или null]). Несколько изменений пишутся пачкой: одно чтение
 * и одна запись на прямоугольник, где они лежат, вместо отдельного запроса на каждую ячейку (синхронизация
 * с Дзен-мани меняет десятки ячеек). Если в этом прямоугольнике кто-то поставил формулы — по одной ячейке, как раньше.
 */
function writeCells_(sh, list) {
  const one = function (x) { const cell = sh.getRange(x[0], x[1]); if (x[2] === null) cell.clearContent(); else cell.setValue(x[2]); };
  if (list.length < 4) { list.forEach(one); return; }
  let r1 = Infinity, r2 = 0, c1 = Infinity, c2 = 0;
  list.forEach(function (x) { r1 = Math.min(r1, x[0]); r2 = Math.max(r2, x[0]); c1 = Math.min(c1, x[1]); c2 = Math.max(c2, x[1]); });
  const rg = sh.getRange(r1, c1, r2 - r1 + 1, c2 - c1 + 1);
  if (rg.getFormulas().some(function (row) { return row.some(function (f) { return f; }); })) { list.forEach(one); return; }
  const vals = rg.getValues();
  list.forEach(function (x) { vals[x[0] - r1][x[1] - c1] = x[2] === null ? '' : x[2]; });
  rg.setValues(vals);
}

/** Пишет только переданные настройки: factDate, order, nav, launch и фильтры операций. */
function setSettings(s) {
  s = s || {};
  const st = ss_().getSheetByName(SHEET_SET);
  ['factDate', 'order', 'nav', 'launch', 'opsFilter', 'opsPresets', 'opsPreset'].forEach(function (k) {
    if (!Object.prototype.hasOwnProperty.call(s, k)) return;
    let v = s[k] === null || s[k] === undefined ? '' : String(s[k]);
    if (k === 'factDate' && v && !/^\d{4}-\d{2}-\d{2}$/.test(v)) return;
    if (k === 'order' || k === 'nav') { try { if (v) JSON.parse(v); } catch (e) { return; } v = v.slice(0, 20000); }
    if (k === 'opsFilter' || k === 'opsPresets') { try { if (v) JSON.parse(v); } catch (e) { return; } if (v.length > (k === 'opsPresets' ? 45000 : 20000)) return; }
    if (k === 'opsPreset') v = v.slice(0, 200);
    if (k === 'launch' && v && !/^https:\/\/[^\s"'<>]+#u=https:\/\/script\.google\.com\/[^\s"'<>]+$/.test(v)) return; // ссылка «приложение на телефоне»
    const n = st.getLastRow();
    const keys = n > 1 ? st.getRange(2, 1, n - 1, 1).getValues().map(function (r) { return String(r[0]); }) : [];
    const i = keys.indexOf(k);
    if (i >= 0) st.getRange(i + 2, 2).setNumberFormat('@').setValue(v);
    else { st.appendRow([k, v]); st.getRange(st.getLastRow(), 2).setNumberFormat('@'); }
  });
  return true;
}

function relabel_(sh, labels) {
  if (!sh || sh.getLastColumn() <= 3) return;
  const ids = sh.getRange(2, 1, 1, sh.getLastColumn()).getValues()[0];
  const head = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  for (let j = 3; j < ids.length; j++) { if (ids[j] && labels[String(ids[j]).split('|')[0]]) head[j] = colLabel_(ids[j], labels); }
  sh.getRange(1, 1, 1, head.length).setValues([head]);
}

function saveConfig(items) {
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    const clean = [];
    (items || []).forEach(function (it) {
      if (!it || !/^[A-Za-z0-9_]+$/.test(String(it.id)) || TYPES.indexOf(it.type) < 0) return;
      const x = { id: String(it.id), type: it.type, name: String(it.name || it.id).slice(0, 80) };
      if (it.type === 'credit' && Number(it.limit)) x.limit = Math.abs(Number(it.limit));
      if (['cash', 'credit', 'savings', 'debt'].indexOf(it.type) >= 0) x.opening = Number(it.opening) || 0;
      if (['cash', 'credit', 'savings', 'debt'].indexOf(it.type) >= 0 && Array.isArray(it.balanceHistory)) {
        x.balanceHistory = it.balanceHistory.filter(function (h) { return h && /^\d{4}-\d{2}-\d{2}$/.test(String(h.date || '')) && Number.isFinite(Number(h.delta)); }).slice(-100).map(function (h) {
          const z = { date: String(h.date), delta: Math.round(Number(h.delta) * 100) / 100 };
          if (Number.isFinite(Number(h.value))) z.value = Math.round(Number(h.value) * 100) / 100;
          return z;
        }).sort(function (a, b) { return a.date.localeCompare(b.date); });
        if (!x.balanceHistory.length) delete x.balanceHistory;
      }
      if (it.type === 'credit' && Array.isArray(it.limitHistory)) {
        x.limitHistory = it.limitHistory.filter(function (h) { return h && /^\d{4}-\d{2}-\d{2}$/.test(String(h.date || '')) && Number.isFinite(Number(h.value)); }).slice(-100).map(function (h) { return { date: String(h.date), value: Math.max(0, Math.round(Number(h.value) * 100) / 100) }; }).sort(function (a, b) { return a.date.localeCompare(b.date); });
        if (!x.limitHistory.length) delete x.limitHistory;
      }
      if (it.type === 'bcat') x.group = String(it.group || 'Без группы').slice(0, 60);
      if (it.hidden) x.hidden = true;
      if (it.off && ['credit', 'savings', 'debt'].indexOf(it.type) >= 0) x.off = true;
      if (it.fixed && (it.type === 'expense' || it.type === 'bcat')) x.fixed = true;
      clean.push(x);
    });
    if (!clean.some(function (x) { return x.type === 'cash'; })) throw new Error('Нужен счёт «Наличка и дебет».');
    const ss = ss_();
    writeAcc_(ss, clean);
    const labels = labels_(clean);
    relabel_(ss.getSheetByName(SHEET_DATA), labels);
    relabel_(ss.getSheetByName(SHEET_BDR), labels);
  } finally { lock.releaseLock(); }
  return true;
}