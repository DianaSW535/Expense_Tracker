/**
 * Слой данных и расчётов для трекера расходов (V2).
 * Без зависимостей: хранение в localStorage, простые функции.
 * Всё в одном объекте ExpenseData — так проще подключать из app.js.
 */
(function (global) {
  "use strict";

  /** Ключи в localStorage — расходы и отдельный справочник магазинов. */
  var STORAGE_KEY = "expense-tracker-v1";
  var STORES_KEY = "expense-tracker-stores-v1";

  /**
   * Форматирует дату в локальном часовом поясе как YYYY-MM-DD (как у input type="date").
   */
  function formatLocalDate(date) {
    var y = date.getFullYear();
    var m = String(date.getMonth() + 1).padStart(2, "0");
    var d = String(date.getDate()).padStart(2, "0");
    return y + "-" + m + "-" + d;
  }

  /** Сегодняшняя дата в формате YYYY-MM-DD (локальный календарь). */
  function todayLocalISO() {
    return formatLocalDate(new Date());
  }

  /**
   * Сдвигает дату в ISO-строке на deltaDays дней (локальный календарь).
   */
  function addDaysToISO(isoDateStr, deltaDays) {
    var parts = isoDateStr.split("-");
    var y = Number(parts[0]);
    var mo = Number(parts[1]) - 1;
    var day = Number(parts[2]);
    var d = new Date(y, mo, day);
    d.setDate(d.getDate() + deltaDays);
    return formatLocalDate(d);
  }

  /** Общий безопасный парсер массива строк/объектов из localStorage. */
  function loadArrayByKey(key) {
    try {
      var raw = global.localStorage.getItem(key);
      if (!raw) {
        return [];
      }
      var parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        return [];
      }
      return parsed;
    } catch (e) {
      return [];
    }
  }

  /** Загрузка массива расходов из localStorage; при ошибке или пустоте — []. */
  function loadExpenses() {
    return loadArrayByKey(STORAGE_KEY);
  }

  /** Сохранение массива расходов в localStorage. */
  function saveExpenses(list) {
    global.localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  }

  /** Загрузка справочника магазинов (массив строк). */
  function loadStores() {
    var parsed = loadArrayByKey(STORES_KEY);
    var normalized = parsed
      .map(function (name) {
        return String(name || "").trim();
      })
      .filter(function (name) {
        return name !== "";
      });
    return uniqueNormalized(normalized);
  }

  /** Сохранение справочника магазинов. */
  function saveStores(stores) {
    global.localStorage.setItem(STORES_KEY, JSON.stringify(stores));
  }

  /** Удаляет дубликаты магазинов с учётом регистра/пробелов для новичкового V2. */
  function uniqueNormalized(names) {
    var seen = {};
    var result = [];
    for (var i = 0; i < names.length; i++) {
      var value = String(names[i] || "").trim();
      var key = value.toLowerCase();
      if (!value || seen[key]) {
        continue;
      }
      seen[key] = true;
      result.push(value);
    }
    return result;
  }

  /**
   * Добавляет магазин в справочник, если такого имени ещё нет.
   * Возвращает объект с признаком успеха и актуальным списком.
   */
  function addStore(stores, storeName) {
    var value = String(storeName || "").trim();
    if (!value) {
      return { ok: false, message: "Введите название магазина.", stores: stores };
    }
    var exists = stores.some(function (item) {
      return String(item).toLowerCase() === value.toLowerCase();
    });
    if (exists) {
      return { ok: false, message: "Такой магазин уже есть.", stores: stores };
    }
    stores.push(value);
    saveStores(stores);
    return { ok: true, stores: stores };
  }

  /**
   * Переименовывает магазин в справочнике и во всех расходах.
   * Это сохраняет согласованность данных без изменения структуры localStorage.
   */
  function renameStore(stores, expenses, oldName, newName) {
    var from = String(oldName || "").trim();
    var to = String(newName || "").trim();
    if (!from) {
      return { ok: false, message: "Выберите магазин для переименования.", stores: stores, expenses: expenses };
    }
    if (!to) {
      return { ok: false, message: "Введите новое название магазина.", stores: stores, expenses: expenses };
    }

    var fromIndex = -1;
    for (var i = 0; i < stores.length; i++) {
      if (String(stores[i]).toLowerCase() === from.toLowerCase()) {
        fromIndex = i;
        break;
      }
    }
    if (fromIndex === -1) {
      return { ok: false, message: "Магазин не найден в справочнике.", stores: stores, expenses: expenses };
    }

    var duplicate = stores.some(function (item, idx) {
      return idx !== fromIndex && String(item).toLowerCase() === to.toLowerCase();
    });
    if (duplicate) {
      return { ok: false, message: "Магазин с таким названием уже есть.", stores: stores, expenses: expenses };
    }

    var oldStoredName = stores[fromIndex];
    stores[fromIndex] = to;
    for (var j = 0; j < expenses.length; j++) {
      if (String(expenses[j].storeName) === String(oldStoredName)) {
        expenses[j].storeName = to;
      }
    }
    saveStores(stores);
    saveExpenses(expenses);
    return { ok: true, stores: stores, expenses: expenses };
  }

  /**
   * Удаляет магазин из справочника, только если он не используется в расходах.
   */
  function deleteStore(stores, expenses, storeName) {
    var value = String(storeName || "").trim();
    if (!value) {
      return { ok: false, message: "Выберите магазин для удаления.", stores: stores };
    }

    var inUse = expenses.some(function (item) {
      return String(item.storeName).toLowerCase() === value.toLowerCase();
    });
    if (inUse) {
      return { ok: false, message: "Нельзя удалить: магазин используется в расходах.", stores: stores };
    }

    var idx = -1;
    for (var i = 0; i < stores.length; i++) {
      if (String(stores[i]).toLowerCase() === value.toLowerCase()) {
        idx = i;
        break;
      }
    }
    if (idx === -1) {
      return { ok: false, message: "Магазин не найден в справочнике.", stores: stores };
    }

    stores.splice(idx, 1);
    saveStores(stores);
    return { ok: true, stores: stores };
  }

  /** Простой id: время + случайное число (достаточно для учебного проекта). */
  function makeId() {
    return String(Date.now()) + "-" + String(Math.random()).slice(2, 8);
  }

  /**
   * Нормализует сумму из формы.
   * Поддерживаем запись с запятой: "12,5" -> "12.5".
   */
  function normalizeAmountInput(rawAmount) {
    return String(rawAmount == null ? "" : rawAmount)
      .trim()
      .replace(",", ".");
  }

  /**
   * Безопасно сохраняет список расходов.
   * Если localStorage недоступен или переполнен — возвращаем ошибку вместо падения.
   */
  function saveExpensesSafely(list) {
    try {
      saveExpenses(list);
      return { ok: true };
    } catch (e) {
      return { ok: false, message: "Не удалось сохранить данные: хранилище недоступно или переполнено." };
    }
  }

  /**
   * Проверяет поля расхода без id — общая логика для добавления и редактирования.
   */
  function parseExpenseFields(expense) {
    var amountStr = normalizeAmountInput(expense.amount);
    var parsedAmount = Number(amountStr);
    var categoryValue = String(expense.category || "").trim();
    var item = {
      productName: String(expense.productName || "").trim(),
      storeName: String(expense.storeName || "").trim(),
      amount: parsedAmount,
      date: String(expense.date || "").trim(),
      category: categoryValue || "Без категории",
    };
    if (!item.productName || !item.storeName || !item.date || amountStr === "" || !isFinite(item.amount) || item.amount < 0) {
      return { ok: false, message: "Проверьте поля: название, магазин, дата и сумма (число не меньше нуля)." };
    }
    return { ok: true, item: item };
  }

  /**
   * Добавляет расход. Поля: productName, amount (число), storeName, date (YYYY-MM-DD).
   * Мутирует переданный list и сохраняет в localStorage.
   */
  function addExpense(list, expense) {
    var parsed = parseExpenseFields(expense);
    if (!parsed.ok) {
      return parsed;
    }
    var item = parsed.item;
    item.id = makeId();
    list.push(item);
    var saveResult = saveExpensesSafely(list);
    if (!saveResult.ok) {
      // Откатываем push, чтобы память и localStorage не разъехались.
      list.pop();
      return saveResult;
    }
    return { ok: true };
  }

  /** Находит индекс расхода по id или -1. */
  function findExpenseIndex(list, id) {
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === id) {
        return i;
      }
    }
    return -1;
  }

  /**
   * Обновляет расход по id теми же правилами, что и при добавлении (товар, магазин, сумма, дата).
   */
  function updateExpense(list, id, expense) {
    var idx = findExpenseIndex(list, id);
    if (idx === -1) {
      return { ok: false, message: "Запись не найдена." };
    }
    var parsed = parseExpenseFields(expense);
    if (!parsed.ok) {
      return parsed;
    }
    var item = parsed.item;
    item.id = id;
    list[idx] = item;
    saveExpenses(list);
    return { ok: true };
  }

  /** Удаляет расход по id. */
  function deleteExpense(list, id) {
    var idx = findExpenseIndex(list, id);
    if (idx === -1) {
      return { ok: false, message: "Запись не найдена." };
    }
    list.splice(idx, 1);
    saveExpenses(list);
    return { ok: true };
  }

  /** Сортировка: сначала новая дата, при равной дате — больший id (обычно новее). */
  function sortByDateNewestFirst(list) {
    return list.slice().sort(function (a, b) {
      if (a.date !== b.date) {
        return a.date < b.date ? 1 : -1;
      }
      return a.id < b.id ? 1 : a.id > b.id ? -1 : 0;
    });
  }

  /**
   * Фильтрация: dateFrom / dateTo (YYYY-MM-DD, включительно), подстрока по магазину и товару.
   * Пустая строка фильтра = не учитывать это условие.
   */
  function filterExpenses(list, filters) {
    var dateFrom = (filters.dateFrom || "").trim();
    var dateTo = (filters.dateTo || "").trim();
    var storeQ = (filters.store || "").trim().toLowerCase();
    var productQ = (filters.product || "").trim().toLowerCase();
    var categoryQ = (filters.category || "").trim().toLowerCase();

    return list.filter(function (e) {
      var categoryValue = String(e.category || "Без категории");
      if (dateFrom && e.date < dateFrom) {
        return false;
      }
      if (dateTo && e.date > dateTo) {
        return false;
      }
      if (storeQ && String(e.storeName).toLowerCase().indexOf(storeQ) === -1) {
        return false;
      }
      if (productQ && String(e.productName).toLowerCase().indexOf(productQ) === -1) {
        return false;
      }
      if (categoryQ && categoryQ !== "__all__" && categoryQ !== String(categoryValue).toLowerCase()) {
        return false;
      }
      return true;
    });
  }

  function sumAmounts(list) {
    return list.reduce(function (acc, e) {
      return acc + (isFinite(e.amount) ? e.amount : 0);
    }, 0);
  }

  /**
   * Сводка по списку: общая сумма, число покупок, средний чек.
   */
  function summaryStats(list) {
    var count = list.length;
    var total = sumAmounts(list);
    var avg = count === 0 ? 0 : total / count;
    return { total: total, count: count, average: avg };
  }

  /** Сумма всех записей в указанном диапазоне дат (включительно). */
  function totalForPeriod(allList, dateFrom, dateTo) {
    var from = String(dateFrom || "").trim();
    var to = String(dateTo || "").trim();
    if (!from || !to || from > to) {
      return { ok: false, message: "Выберите корректный диапазон дат." };
    }
    var filtered = allList.filter(function (e) {
      return e.date >= from && e.date <= to;
    });
    return { ok: true, total: sumAmounts(filtered), count: filtered.length };
  }

  global.ExpenseData = {
    loadExpenses: loadExpenses,
    saveExpenses: saveExpenses,
    addExpense: addExpense,
    updateExpense: updateExpense,
    deleteExpense: deleteExpense,
    loadStores: loadStores,
    saveStores: saveStores,
    addStore: addStore,
    renameStore: renameStore,
    deleteStore: deleteStore,
    sortByDateNewestFirst: sortByDateNewestFirst,
    filterExpenses: filterExpenses,
    summaryStats: summaryStats,
    totalForPeriod: totalForPeriod,
    todayLocalISO: todayLocalISO,
  };
})(window);
