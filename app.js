/**
 * Интерфейс трекера расходов (V2).
 * Здесь только обработчики формы и вывод результата расчёта периода.
 * В V3 период и фильтры объединены в один блок.
 */
(function () {
  "use strict";

  /** Данные в памяти: расходы и отдельный справочник магазинов. */
  var expenses = ExpenseData.loadExpenses();
  var stores = ExpenseData.loadStores();

  var elProduct = document.getElementById("product-name");
  var elAmount = document.getElementById("amount");
  var elStore = document.getElementById("store-name");
  var elDate = document.getElementById("expense-date");
  var elSave = document.getElementById("save-expense");
  var elNewStore = document.getElementById("new-store-name");
  var elAddStore = document.getElementById("add-store");
  var elFormMessage = document.getElementById("form-message");

  var elCalcPeriodTotal = document.getElementById("calc-period-total");
  var elPeriodMessage = document.getElementById("period-message");

  var elFDateFrom = document.getElementById("filter-date-from");
  var elFDateTo = document.getElementById("filter-date-to");
  var elFStore = document.getElementById("filter-store");
  var elFProduct = document.getElementById("filter-product");
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

  /** Отрисовка выпадающего списка магазинов. */
  function renderStoreSelect() {
    var sorted = stores.slice().sort(function (a, b) {
      return a.localeCompare(b, "ru");
    });
    var options = ['<option value="">Выберите магазин</option>'];
    for (var i = 0; i < sorted.length; i++) {
      options.push('<option value="' + sorted[i] + '">' + sorted[i] + "</option>");
    }
    elStore.innerHTML = options.join("");
  }

  function readFilters() {
    return {
      dateFrom: elFDateFrom.value,
      dateTo: elFDateTo.value,
      store: elFStore.value,
      product: elFProduct.value,
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

  /** Добавление магазина в справочник, чтобы потом выбирать его из списка. */
  function onAddStore() {
    var result = ExpenseData.addStore(stores, elNewStore.value);
    if (!result.ok) {
      setFormMessage(result.message, true);
      return;
    }
    stores = result.stores;
    renderStoreSelect();
    elStore.value = elNewStore.value.trim();
    elNewStore.value = "";
    setFormMessage("Магазин добавлен в список.", false);
  }

  function onSave() {
    setFormMessage("", false);
    if (!elStore.value) {
      setFormMessage("Сначала выберите магазин из выпадающего списка.", true);
      return;
    }
    var result = ExpenseData.addExpense(expenses, {
      productName: elProduct.value,
      amount: elAmount.value,
      storeName: elStore.value.trim(),
      date: elDate.value,
    });
    if (!result.ok) {
      setFormMessage(result.message, true);
      return;
    }
    elProduct.value = "";
    elAmount.value = "";
    elStore.value = "";
    elDate.value = ExpenseData.todayLocalISO();
    setFormMessage("Расход сохранён.", false);
  }

  function onResetFilters() {
    elFDateFrom.value = "";
    elFDateTo.value = "";
    elFStore.value = "";
    elFProduct.value = "";
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
  elDate.value = today;
  elFDateFrom.value = today;
  elFDateTo.value = today;

  elAddStore.addEventListener("click", onAddStore);
  elSave.addEventListener("click", onSave);
  elCalcPeriodTotal.addEventListener("click", onCalcPeriodTotal);
  elResetFilters.addEventListener("click", onResetFilters);
})();
