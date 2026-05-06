/**
 * Интерфейс трекера расходов.
 * Форма добавления / редактирования, история покупок, расчёт суммы за период (V3).
 */
(function () {
  "use strict";

  /** Данные в памяти: расходы и отдельный справочник магазинов. */
  var expenses = ExpenseData.loadExpenses();
  var stores = ExpenseData.loadStores();
  var categories = ["Еда", "Транспорт", "Одежда", "Развлечения"];

  /** Если не null — в форме редактируется существующая запись с этим id. */
  var editingId = null;

  var elProduct = document.getElementById("product-name");
  var elAmount = document.getElementById("amount");
  var elStore = document.getElementById("store-name");
  var elCategory = document.getElementById("category-name");
  var elDate = document.getElementById("expense-date");
  var elSave = document.getElementById("save-expense");
  var elCancelEdit = document.getElementById("cancel-edit");
  var elNewStore = document.getElementById("new-store-name");
  var elAddStore = document.getElementById("add-store");
  var elStoreEditSelect = document.getElementById("store-edit-select");
  var elStoreRenameName = document.getElementById("store-rename-name");
  var elRenameStore = document.getElementById("rename-store");
  var elDeleteStore = document.getElementById("delete-store");
  var elFormMessage = document.getElementById("form-message");

  var elHistoryList = document.getElementById("history-list");

  var elCalcPeriodTotal = document.getElementById("calc-period-total");
  var elPeriodMessage = document.getElementById("period-message");

  var elFDateFrom = document.getElementById("filter-date-from");
  var elFDateTo = document.getElementById("filter-date-to");
  var elFStore = document.getElementById("filter-store");
  var elFProduct = document.getElementById("filter-product");
  var elFCategory = document.getElementById("filter-category");
  var elResetFilters = document.getElementById("reset-filters");

  /** Форматирует число как денежную сумму для отображения (локаль ru). */
  function formatMoney(value) {
    return new Intl.NumberFormat("ru-RU", {
      style: "currency",
      currency: "RUB",
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(value);
  }

  /** Экранирование текста перед вставкой в HTML. */
  function escapeHtml(text) {
    var div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  /** Найти покупку по id (для режима редактирования). */
  function getExpenseById(id) {
    for (var i = 0; i < expenses.length; i++) {
      if (expenses[i].id === id) {
        return expenses[i];
      }
    }
    return null;
  }

  /** Есть ли магазин в справочнике (без учёта регистра). */
  function isStoreInCatalog(storeName) {
    var target = String(storeName || "").trim().toLowerCase();
    if (!target) {
      return false;
    }
    return stores.some(function (s) {
      return String(s).toLowerCase() === target;
    });
  }

  /**
   * Заполняет выпадающий список магазинов.
   * extraSelectedStore — если магазин записи нет в справочнике, добавляем одну опцию, чтобы можно было сохранить правку.
   */
  function renderStoreSelect(extraSelectedStore) {
    elStore.innerHTML = "";

    var optEmpty = document.createElement("option");
    optEmpty.value = "";
    optEmpty.textContent = "Выберите магазин";
    elStore.appendChild(optEmpty);

    var sorted = stores.slice().sort(function (a, b) {
      return a.localeCompare(b, "ru");
    });
    for (var i = 0; i < sorted.length; i++) {
      var opt = document.createElement("option");
      opt.value = sorted[i];
      opt.textContent = sorted[i];
      elStore.appendChild(opt);
    }

    var extra = String(extraSelectedStore || "").trim();
    if (extra && !isStoreInCatalog(extra)) {
      var optExtra = document.createElement("option");
      optExtra.value = extra;
      optExtra.textContent = extra + " (нет в справочнике)";
      elStore.appendChild(optExtra);
    }

    elStoreEditSelect.innerHTML = "";
    var editEmpty = document.createElement("option");
    editEmpty.value = "";
    editEmpty.textContent = "Выберите магазин";
    elStoreEditSelect.appendChild(editEmpty);
    for (var j = 0; j < sorted.length; j++) {
      var editOpt = document.createElement("option");
      editOpt.value = sorted[j];
      editOpt.textContent = sorted[j];
      elStoreEditSelect.appendChild(editOpt);
    }
  }

  /** Заполняет список категорий для формы добавления/редактирования и фильтра. */
  function renderCategorySelects() {
    elCategory.innerHTML = "";
    var emptyOption = document.createElement("option");
    emptyOption.value = "";
    emptyOption.textContent = "Выберите категорию";
    elCategory.appendChild(emptyOption);
    for (var i = 0; i < categories.length; i++) {
      var option = document.createElement("option");
      option.value = categories[i];
      option.textContent = categories[i];
      elCategory.appendChild(option);
    }

    elFCategory.innerHTML = "";
    var allOption = document.createElement("option");
    allOption.value = "__all__";
    allOption.textContent = "Все категории";
    elFCategory.appendChild(allOption);
    for (var j = 0; j < categories.length; j++) {
      var filterOption = document.createElement("option");
      filterOption.value = categories[j];
      filterOption.textContent = categories[j];
      elFCategory.appendChild(filterOption);
    }
    var noneOption = document.createElement("option");
    noneOption.value = "Без категории";
    noneOption.textContent = "Без категории";
    elFCategory.appendChild(noneOption);
  }

  /** Список покупок под формой: новые даты сверху, кнопки «Редактировать» и «Удалить». */
  function renderHistory() {
    var sorted = ExpenseData.sortByDateNewestFirst(expenses);
    elHistoryList.innerHTML = sorted
      .map(function (e) {
        var isRowEditing = editingId !== null && editingId === e.id;
        return (
          '<li class="history-item' +
          (isRowEditing ? " is-editing" : "") +
          '">' +
          "<div>" +
          '<div class="title">' +
          escapeHtml(e.productName) +
          "</div>" +
          '<div class="meta">' +
          escapeHtml(e.storeName) +
          " · " +
          escapeHtml(e.date) +
          " · " +
          escapeHtml(e.category || "Без категории") +
          "</div>" +
          "</div>" +
          '<div class="amount">' +
          formatMoney(e.amount) +
          "</div>" +
          '<div class="history-actions">' +
          '<button type="button" class="btn btn-secondary js-edit" data-id="' +
          escapeHtml(e.id) +
          '">Редактировать</button>' +
          '<button type="button" class="btn btn-danger js-delete" data-id="' +
          escapeHtml(e.id) +
          '">Удалить</button>' +
          "</div>" +
          "</li>"
        );
      })
      .join("");
  }

  function readFilters() {
    return {
      dateFrom: elFDateFrom.value,
      dateTo: elFDateTo.value,
      store: elFStore.value,
      product: elFProduct.value,
      category: elFCategory.value,
    };
  }

  function setFormMessage(text, isError) {
    elFormMessage.textContent = text;
    elFormMessage.classList.toggle("error", Boolean(isError));
  }

  function setPeriodMessage(text, isError) {
    elPeriodMessage.textContent = text;
    elPeriodMessage.classList.toggle("error", Boolean(isError));
  }

  /** Выйти из режима редактирования и очистить форму до состояния «новая покупка». */
  function cancelEdit() {
    editingId = null;
    elSave.textContent = "Сохранить";
    elCancelEdit.hidden = true;
    elProduct.value = "";
    elAmount.value = "";
    elStore.value = "";
    elCategory.value = "";
    elDate.value = ExpenseData.todayLocalISO();
    setFormMessage("", false);
    renderStoreSelect();
    renderHistory();
  }

  /** Подставить запись в форму и включить режим правки. */
  function beginEdit(id) {
    var row = getExpenseById(id);
    if (!row) {
      return;
    }
    editingId = id;
    elProduct.value = row.productName;
    elAmount.value = String(row.amount);
    elDate.value = row.date;
    elCategory.value = row.category || "Без категории";
    renderStoreSelect(row.storeName);
    elStore.value = row.storeName;
    elSave.textContent = "Сохранить изменения";
    elCancelEdit.hidden = false;
    setFormMessage("Редактирование: измените поля и нажмите «Сохранить изменения».", false);
    renderHistory();
  }

  function onDelete(id) {
    if (!window.confirm("Удалить эту покупку?")) {
      return;
    }
    var result = ExpenseData.deleteExpense(expenses, id);
    if (!result.ok) {
      setFormMessage(result.message, true);
      return;
    }
    if (editingId === id) {
      cancelEdit();
    } else {
      renderHistory();
    }
  }

  /** Добавление магазина в справочник, чтобы потом выбирать его из списка. */
  function onAddStore() {
    var result = ExpenseData.addStore(stores, elNewStore.value);
    if (!result.ok) {
      setFormMessage(result.message, true);
      return;
    }
    stores = result.stores;
    var keep = editingId ? getExpenseById(editingId) : null;
    renderStoreSelect(keep ? keep.storeName : "");
    if (keep) {
      elStore.value = keep.storeName;
    } else {
      elStore.value = elNewStore.value.trim();
    }
    elNewStore.value = "";
    setFormMessage("Магазин добавлен в список.", false);
    renderHistory();
  }

  /** Переименование магазина в справочнике и связанных расходах. */
  function onRenameStore() {
    var fromName = elStoreEditSelect.value;
    var toName = elStoreRenameName.value;
    var result = ExpenseData.renameStore(stores, expenses, fromName, toName);
    if (!result.ok) {
      setFormMessage(result.message, true);
      return;
    }
    stores = result.stores;
    expenses = result.expenses;
    var keep = editingId ? getExpenseById(editingId) : null;
    renderStoreSelect(keep ? keep.storeName : "");
    if (keep) {
      elStore.value = keep.storeName;
    }
    elStoreEditSelect.value = toName.trim();
    elStoreRenameName.value = "";
    setFormMessage("Магазин переименован.", false);
    renderHistory();
  }

  /** Удаление магазина из справочника (если он не используется в расходах). */
  function onDeleteStore() {
    var selectedStore = elStoreEditSelect.value;
    if (!window.confirm("Удалить выбранный магазин из справочника?")) {
      return;
    }
    var result = ExpenseData.deleteStore(stores, expenses, selectedStore);
    if (!result.ok) {
      setFormMessage(result.message, true);
      return;
    }
    stores = result.stores;
    if (elStore.value && !isStoreInCatalog(elStore.value)) {
      elStore.value = "";
    }
    elStoreRenameName.value = "";
    renderStoreSelect();
    setFormMessage("Магазин удалён из справочника.", false);
  }

  function onSave() {
    setFormMessage("", false);
    if (!elStore.value) {
      setFormMessage("Сначала выберите магазин из выпадающего списка.", true);
      return;
    }
    if (!elCategory.value) {
      setFormMessage("Сначала выберите категорию.", true);
      return;
    }

    var payload = {
      productName: elProduct.value,
      amount: elAmount.value,
      storeName: elStore.value.trim(),
      category: elCategory.value,
      date: elDate.value,
    };

    if (editingId) {
      var updateResult = ExpenseData.updateExpense(expenses, editingId, payload);
      if (!updateResult.ok) {
        setFormMessage(updateResult.message, true);
        return;
      }
      setFormMessage("Изменения сохранены.", false);
      cancelEdit();
      return;
    }

    var addResult = ExpenseData.addExpense(expenses, payload);
    if (!addResult.ok) {
      setFormMessage(addResult.message, true);
      return;
    }
    elProduct.value = "";
    elAmount.value = "";
    elStore.value = "";
    elCategory.value = "";
    elDate.value = ExpenseData.todayLocalISO();
    setFormMessage("Покупка сохранена.", false);
    renderHistory();
  }

  function onResetFilters() {
    elFDateFrom.value = "";
    elFDateTo.value = "";
    elFStore.value = "";
    elFProduct.value = "";
    elFCategory.value = "__all__";
  }

  /**
   * Расчёт суммы по единому блоку периода/фильтров.
   * Дата обязательна, поля магазина/товара — опциональны.
   */
  function onCalcPeriodTotal() {
    setPeriodMessage("", false);

    var baseFilters = readFilters();
    var periodFrom = baseFilters.dateFrom;
    var periodTo = baseFilters.dateTo;
    if (!periodFrom || !periodTo) {
      setPeriodMessage("Выберите обе даты периода.", true);
      return;
    }

    var filteredByAllRules = ExpenseData.filterExpenses(expenses, baseFilters);
    var result = ExpenseData.totalForPeriod(filteredByAllRules, periodFrom, periodTo);
    if (!result.ok) {
      setPeriodMessage(result.message, true);
      return;
    }

    setPeriodMessage(
      "Сумма за период: " + formatMoney(result.total) + " (покупок: " + String(result.count) + ").",
      false
    );
  }

  /** При старте: дата по умолчанию — сегодня. */
  var today = ExpenseData.todayLocalISO();
  renderStoreSelect();
  renderCategorySelects();
  elDate.value = today;
  elFDateFrom.value = today;
  elFDateTo.value = today;
  elFCategory.value = "__all__";

  renderHistory();

  elHistoryList.addEventListener("click", function (event) {
    var target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }
    var editBtn = target.closest(".js-edit");
    var delBtn = target.closest(".js-delete");
    if (editBtn) {
      beginEdit(editBtn.getAttribute("data-id") || "");
      return;
    }
    if (delBtn) {
      onDelete(delBtn.getAttribute("data-id") || "");
    }
  });

  elAddStore.addEventListener("click", onAddStore);
  elRenameStore.addEventListener("click", onRenameStore);
  elDeleteStore.addEventListener("click", onDeleteStore);
  elSave.addEventListener("click", onSave);
  elCancelEdit.addEventListener("click", cancelEdit);
  elCalcPeriodTotal.addEventListener("click", onCalcPeriodTotal);
  elResetFilters.addEventListener("click", onResetFilters);
})();
