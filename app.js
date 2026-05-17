const STORAGE_KEY = "estoque-aula-web-state-v1";
const ACTIVE_USER_KEY = "estoque-aula-web-active-user-v1";

let state = loadLocalState();
let activeUserId = localStorage.getItem(ACTIVE_USER_KEY) || "";
let filteredCategory = "todos";
let searchTerm = "";
let startDate = daysAgo(90);
let endDate = today();
let abcMode = "forecast";

const rowTemplate = document.querySelector("#rowTemplate");
const tableBody = document.querySelector("#inventoryTable");
const currencyFormatter = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const numberFormatter = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });

function defaultState() {
  return {
    users: [
      { id: createId(), name: "Professor / Gestor", username: "gestor", password: "admin123", role: "Gestor", active: true, createdAt: new Date().toISOString() },
      { id: createId(), name: "Grupo 1", username: "grupo1", password: "grupo123", role: "Operador", active: true, createdAt: new Date().toISOString() },
      { id: createId(), name: "Grupo 2", username: "grupo2", password: "grupo123", role: "Operador", active: true, createdAt: new Date().toISOString() },
      { id: createId(), name: "Grupo 3", username: "grupo3", password: "grupo123", role: "Operador", active: true, createdAt: new Date().toISOString() },
      { id: createId(), name: "Grupo 4", username: "grupo4", password: "grupo123", role: "Operador", active: true, createdAt: new Date().toISOString() }
    ],
    items: classroomItems(),
    movements: []
  };
}

function classroomItems() {
  const now = new Date().toISOString();
  return [
    item("PA-001", "Produto Acabado Alpha", "Produto", "Linha A", 420, 260, 38.9, 310, 12, [290, 320, 305, 330, 300, 315], now),
    item("PA-002", "Produto Acabado Beta", "Produto", "Linha A", 180, 220, 54.5, 210, 18, [160, 230, 180, 265, 190, 235], now),
    item("IN-101", "Embalagem primaria", "Insumo", "Embalagens", 5600, 4000, 0.92, 3800, 9, [3700, 3900, 3750, 3860, 3920, 3810], now),
    item("IN-102", "Rotulo adesivo", "Insumo", "Embalagens", 2300, 3200, 0.18, 2900, 7, [2500, 3100, 2700, 3300, 2800, 3000], now),
    item("MP-201", "Materia-prima base", "Insumo", "Materias-primas", 720, 540, 22.75, 510, 21, [505, 515, 500, 530, 490, 520], now),
    item("MP-202", "Aditivo premium", "Insumo", "Materias-primas", 96, 140, 148, 80, 35, [35, 110, 62, 95, 42, 138], now),
    item("PA-003", "Kit promocional", "Produto", "Kits", 65, 50, 96.2, 34, 14, [12, 46, 20, 70, 18, 38], now),
    item("IN-103", "Caixa de transporte", "Insumo", "Embalagens", 880, 760, 4.4, 610, 10, [590, 630, 605, 620, 600, 615], now),
    item("PA-004", "Produto Acabado Gamma", "Produto", "Linha B", 125, 90, 72.8, 92, 16, [84, 98, 89, 105, 91, 88], now),
    item("MP-203", "Componente importado", "Insumo", "Materias-primas", 38, 75, 215.5, 42, 45, [22, 58, 35, 66, 18, 55], now)
  ];
}

function item(sku, name, type, category, stock, minStock, unitCost, monthlyDemand, leadTime, demandHistory, updatedAt) {
  return { sku, name, type, category, stock, minStock, unitCost, monthlyDemand, leadTime, demandHistory, updatedAt };
}

function loadLocalState() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "");
    if (Array.isArray(parsed.items) && Array.isArray(parsed.movements) && Array.isArray(parsed.users)) return parsed;
  } catch {}
  const initial = defaultState();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
  return initial;
}

function saveLocalState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function login(event) {
  event.preventDefault();
  const username = document.querySelector("#loginUser").value.trim().toLowerCase();
  const password = document.querySelector("#loginPassword").value;
  const user = state.users.find((entry) => entry.active && entry.username.toLowerCase() === username && entry.password === password);
  if (!user) return showMessage(document.querySelector("#loginMessage"), "Usuario ou senha invalidos.", "error");
  activeUserId = user.id;
  localStorage.setItem(ACTIVE_USER_KEY, activeUserId);
  loadState();
}

function loadState() {
  state = loadLocalState();
  if (!activeUser()) {
    document.querySelector("#loginView").classList.remove("hidden");
    document.querySelector("#appView").classList.add("hidden");
    return;
  }
  document.querySelector("#loginView").classList.add("hidden");
  document.querySelector("#appView").classList.remove("hidden");
  render();
}

function activeUser() {
  return state.users.find((user) => user.id === activeUserId && user.active) || null;
}

function permissionsFor(role) {
  const map = {
    Gestor: ["items:write", "movements:write", "users:write"],
    Compras: ["items:write", "movements:write"],
    Operador: ["movements:write"],
    Auditor: []
  };
  return map[role] || [];
}

function can(permission) {
  const user = activeUser();
  return user?.role === "Gestor" || permissionsFor(user?.role).includes(permission);
}

function today() { return new Date().toISOString().slice(0, 10); }
function daysAgo(days) { const date = new Date(); date.setDate(date.getDate() - days); return date.toISOString().slice(0, 10); }

function enrichItems(sourceItems, period = periodMovements()) {
  const realConsumption = period
    .filter((movement) => movement.type === "exit")
    .reduce((map, movement) => {
      map.set(movement.sku, (map.get(movement.sku) || 0) + Number(movement.value || 0));
      return map;
    }, new Map());
  const basisValue = (entry) => abcMode === "real" ? Number(realConsumption.get(entry.sku) || 0) : Number(entry.monthlyDemand || 0) * 12 * Number(entry.unitCost || 0);
  const ranked = sourceItems.map((entry) => ({ ...entry, annualConsumptionValue: basisValue(entry) })).sort((a, b) => b.annualConsumptionValue - a.annualConsumptionValue);
  const totalValue = ranked.reduce((sumValue, entry) => sumValue + entry.annualConsumptionValue, 0) || 1;
  let cumulative = 0;
  const classes = new Map();
  ranked.forEach((entry) => {
    cumulative += entry.annualConsumptionValue;
    const participation = cumulative / totalValue;
    classes.set(entry.sku, { abc: participation <= 0.8 ? "A" : participation <= 0.95 ? "B" : "C", cumulativeParticipation: participation });
  });
  return sourceItems.map((entry) => {
    const demand = Number(entry.monthlyDemand || 0);
    const stock = Number(entry.stock || 0);
    const minStock = Number(entry.minStock || 0);
    const unitCost = Number(entry.unitCost || 0);
    const dailyDemand = demand / 30;
    const coverage = dailyDemand > 0 ? stock / dailyDemand : 999;
    const reorderPoint = Math.ceil(dailyDemand * Number(entry.leadTime || 0) + minStock);
    const suggestedPurchase = Math.max(reorderPoint - stock, 0);
    const xyz = classifyXyz(entry.demandHistory, demand);
    const status = stock <= minStock ? "critical" : stock <= reorderPoint ? "warn" : "ok";
    return {
      ...entry,
      stockValue: stock * unitCost,
      annualConsumptionValue: basisValue(entry),
      turnover: (demand * 12) / Math.max((stock + minStock) / 2, 1),
      coverage,
      reorderPoint,
      suggestedPurchase,
      suggestedPurchaseValue: suggestedPurchase * unitCost,
      xyz,
      status,
      ...(classes.get(entry.sku) || { abc: "C", cumulativeParticipation: 1 })
    };
  });
}

function classifyXyz(history = [], fallbackDemand = 0) {
  const values = history.length ? history.map(Number) : [Number(fallbackDemand || 0)];
  const avg = values.reduce((total, value) => total + value, 0) / values.length || 1;
  const variance = values.reduce((total, value) => total + (value - avg) ** 2, 0) / values.length;
  const coefficient = Math.sqrt(variance) / avg;
  if (coefficient <= 0.1) return "X";
  if (coefficient <= 0.25) return "Y";
  return "Z";
}

function visibleItems(period = periodMovements()) {
  return enrichItems(state.items, period).filter((entry) => {
    const categoryMatch = filteredCategory === "todos" || entry.category === filteredCategory;
    const haystack = `${entry.sku} ${entry.name} ${entry.type} ${entry.category}`.toLowerCase();
    return categoryMatch && haystack.includes(searchTerm);
  });
}

function periodMovements() {
  return state.movements.filter((movement) => (!startDate || movement.date >= startDate) && (!endDate || movement.date <= endDate));
}

function render() {
  const user = activeUser();
  document.querySelector("#startDate").value = startDate;
  document.querySelector("#endDate").value = endDate;
  document.querySelector("#abcMode").value = abcMode;
  document.querySelector("#entryDate").value ||= today();
  document.querySelector("#exitDate").value ||= today();
  document.querySelector("#activeUserLabel").textContent = `${user.name} (${user.role})`;
  renderControlsByPermission();
  renderCategoryFilter();
  renderSkuOptions();
  const period = periodMovements();
  const enriched = visibleItems(period);
  renderKpis(enriched, period);
  renderTable(enriched);
  renderAlerts(enriched);
  renderHistory(period);
  renderUsers();
  renderReport(enriched, period);
  drawAbcChart(enriched);
  drawMatrixChart(enriched);
}

function renderControlsByPermission() {
  document.querySelector("#addItem").classList.toggle("locked", !can("items:write"));
  document.querySelector("#userForm").classList.toggle("locked", !can("users:write"));
  document.querySelector("#sala-aula").classList.toggle("locked", !can("users:write"));
  document.querySelector("#stockEntryForm").classList.toggle("locked", !can("movements:write"));
  document.querySelector("#stockExitForm").classList.toggle("locked", !can("movements:write"));
}

function renderCategoryFilter() {
  const categories = ["todos", ...new Set(state.items.map((entry) => entry.category).filter(Boolean))];
  document.querySelector("#categoryFilter").innerHTML = categories.map((category) => `<option value="${escapeHtml(category)}">${category === "todos" ? "Todas categorias" : escapeHtml(category)}</option>`).join("");
  document.querySelector("#categoryFilter").value = filteredCategory;
}

function renderSkuOptions() {
  document.querySelector("#skuOptions").innerHTML = state.items.map((entry) => `<option value="${escapeHtml(entry.sku)}">${escapeHtml(entry.name)}</option>`).join("");
}

function renderKpis(enriched, period) {
  const entries = period.filter((movement) => movement.type === "entry");
  const exits = period.filter((movement) => movement.type === "exit");
  setText("#stockValue", currencyFormatter.format(sum(enriched, "stockValue")));
  setText("#stockUnits", `${numberFormatter.format(sum(enriched, "stock"))} unidades`);
  setText("#belowMin", enriched.filter((entry) => entry.status === "critical").length);
  setText("#avgTurnover", `${numberFormatter.format(average(enriched.map((entry) => entry.turnover)))}x`);
  setText("#coverageDays", `${Math.round(average(enriched.filter((entry) => entry.coverage < 900).map((entry) => entry.coverage)) || 0)} dias`);
  setText("#periodEntries", numberFormatter.format(sum(entries, "quantity")));
  setText("#periodEntryValue", `${currencyFormatter.format(sum(entries, "value"))} recebidos`);
  setText("#periodExits", numberFormatter.format(sum(exits, "quantity")));
  setText("#periodExitValue", `${currencyFormatter.format(sum(exits, "value"))} consumidos`);
  setText("#suggestedPurchase", `${numberFormatter.format(sum(enriched, "suggestedPurchase"))} un.`);
  setText("#suggestedPurchaseValue", `${currencyFormatter.format(sum(enriched, "suggestedPurchaseValue"))} estimados`);
  setText("#activeUsersCount", state.users.filter((user) => user.active).length);
}

function renderTable(enriched) {
  tableBody.innerHTML = "";
  enriched.forEach((entry) => {
    const row = rowTemplate.content.firstElementChild.cloneNode(true);
    row.querySelectorAll("[data-field]").forEach((input) => {
      const field = input.dataset.field;
      input.value = entry[field];
      input.disabled = !can("items:write");
      input.addEventListener("change", (event) => updateItem(entry.sku, field, event.target.value));
    });
    row.querySelector('[data-value="abc"]').textContent = entry.abc;
    row.querySelector('[data-value="abc"]').className = `badge ${entry.abc.toLowerCase()}`;
    row.querySelector('[data-value="xyz"]').textContent = entry.xyz;
    row.querySelector('[data-value="xyz"]').className = `badge ${entry.xyz.toLowerCase()}`;
    row.querySelector('[data-value="coverage"]').textContent = entry.coverage >= 900 ? "Sem consumo" : `${Math.round(entry.coverage)} dias`;
    row.querySelector('[data-value="suggested"]').textContent = entry.suggestedPurchase ? `${entry.suggestedPurchase} un.` : "-";
    const status = row.querySelector('[data-value="status"]');
    status.className = `status ${entry.status}`;
    status.textContent = entry.status === "critical" ? "Repor" : entry.status === "warn" ? "Ponto compra" : "OK";
    const deleteButton = row.querySelector(".delete");
    deleteButton.disabled = !can("items:write");
    deleteButton.addEventListener("click", () => deleteItem(entry.sku));
    tableBody.appendChild(row);
  });
}

function renderAlerts(enriched) {
  const alerts = enriched.filter((entry) => entry.status !== "ok").sort((a, b) => b.suggestedPurchaseValue - a.suggestedPurchaseValue);
  document.querySelector("#alerts").innerHTML = alerts.length ? alerts.map((entry) => `<div class="alert ${entry.status === "critical" ? "critical" : ""}"><strong>${escapeHtml(entry.name)} - ${entry.abc}${entry.xyz}</strong><span>Saldo ${entry.stock}, minimo ${entry.minStock}, ponto de compra ${entry.reorderPoint}, cobertura ${Math.round(entry.coverage)} dias. Comprar ${entry.suggestedPurchase} un. (${currencyFormatter.format(entry.suggestedPurchaseValue)}).</span></div>`).join("") : '<div class="alert"><strong>Nenhum alerta ativo</strong><span>Todos os itens estao acima do ponto de compra.</span></div>';
}

function renderHistory(period) {
  const recent = [...period].sort((a, b) => `${b.date}${b.createdAt}`.localeCompare(`${a.date}${a.createdAt}`)).slice(0, 12);
  document.querySelector("#historyList").innerHTML = recent.length ? recent.map((movement) => `<div class="history-item ${movement.type}"><strong>${movement.type === "entry" ? "Entrada" : "Saida"} - ${escapeHtml(movement.sku)} - ${numberFormatter.format(movement.quantity)} un.</strong><span>${formatDate(movement.date)} por ${escapeHtml(movement.userName)}. Saldo: ${numberFormatter.format(movement.previousStock)} -> ${numberFormatter.format(movement.newStock)}. ${escapeHtml(movement.note || "")}</span></div>`).join("") : '<div class="history-item"><strong>Sem movimentacoes</strong><span>Nenhum registro encontrado no periodo selecionado.</span></div>';
}

function renderUsers() {
  document.querySelector("#usersList").innerHTML = state.users.map((user) => `<div class="user-item"><div><strong>${escapeHtml(user.name)}</strong><span>${escapeHtml(user.username)} - ${escapeHtml(user.role)} ${user.active ? "- ativo" : "- inativo"}</span></div><button class="secondary" data-toggle-user="${escapeHtml(user.id)}" ${!can("users:write") || user.id === activeUserId ? "disabled" : ""}>${user.active ? "Inativar" : "Ativar"}</button></div>`).join("");
}

function renderReport(enriched, period) {
  const exits = period.filter((movement) => movement.type === "exit");
  const cards = [
    ["Periodo", `${formatDate(startDate) || "Inicio"} a ${formatDate(endDate) || "Hoje"}`],
    ["Itens criticos", enriched.filter((entry) => entry.status === "critical").length],
    ["No ponto de compra", enriched.filter((entry) => entry.status === "warn").length],
    ["Compra recomendada", currencyFormatter.format(sum(enriched, "suggestedPurchaseValue"))],
    ["Consumo do periodo", currencyFormatter.format(sum(exits, "value"))]
  ];
  document.querySelector("#reportPreview").innerHTML = cards.map(([label, value]) => `<div class="report-card"><span>${label}</span><strong>${value}</strong></div>`).join("");
  document.querySelector("#printArea").innerHTML = buildPrintableReport(enriched, period);
}

function buildPrintableReport(enriched, period) {
  const topRisks = [...enriched].sort((a, b) => b.suggestedPurchaseValue - a.suggestedPurchaseValue).slice(0, 12);
  const movements = [...period].sort((a, b) => `${b.date}${b.createdAt}`.localeCompare(`${a.date}${a.createdAt}`)).slice(0, 30);
  return `<h1>Relatorio gerencial de estoque - Aula Web</h1><p>Gerado em ${new Date().toLocaleString("pt-BR")} por ${escapeHtml(activeUser().name)}. Periodo: ${formatDate(startDate) || "Inicio"} a ${formatDate(endDate) || "Hoje"}.</p><div class="print-summary"><div><span>Valor em estoque</span><strong>${currencyFormatter.format(sum(enriched, "stockValue"))}</strong></div><div><span>Itens criticos</span><strong>${enriched.filter((entry) => entry.status === "critical").length}</strong></div><div><span>Compra sugerida</span><strong>${currencyFormatter.format(sum(enriched, "suggestedPurchaseValue"))}</strong></div><div><span>Saidas no periodo</span><strong>${currencyFormatter.format(sum(period.filter((movement) => movement.type === "exit"), "value"))}</strong></div></div><h2>Prioridades de compra</h2><table><thead><tr><th>SKU</th><th>Item</th><th>ABC/XYZ</th><th>Saldo</th><th>Min.</th><th>Ponto</th><th>Cobertura</th><th>Comprar</th><th>Valor</th></tr></thead><tbody>${topRisks.map((entry) => `<tr><td>${escapeHtml(entry.sku)}</td><td>${escapeHtml(entry.name)}</td><td>${entry.abc}${entry.xyz}</td><td>${entry.stock}</td><td>${entry.minStock}</td><td>${entry.reorderPoint}</td><td>${entry.coverage >= 900 ? "-" : `${Math.round(entry.coverage)} dias`}</td><td>${entry.suggestedPurchase}</td><td>${currencyFormatter.format(entry.suggestedPurchaseValue)}</td></tr>`).join("")}</tbody></table><h2>Movimentacoes recentes</h2><table><thead><tr><th>Data</th><th>Tipo</th><th>SKU</th><th>Qtd.</th><th>Usuario</th><th>Observacao</th></tr></thead><tbody>${movements.map((movement) => `<tr><td>${formatDate(movement.date)}</td><td>${movement.type === "entry" ? "Entrada" : "Saida"}</td><td>${escapeHtml(movement.sku)}</td><td>${numberFormatter.format(movement.quantity)}</td><td>${escapeHtml(movement.userName)}</td><td>${escapeHtml(movement.note || "")}</td></tr>`).join("")}</tbody></table>`;
}

function updateItem(sku, field, value) {
  if (!can("items:write")) return;
  const current = state.items.find((entry) => entry.sku === sku);
  if (!current) return;
  const numericFields = ["stock", "minStock", "unitCost", "monthlyDemand", "leadTime"];
  const nextSku = field === "sku" ? String(value).trim().toUpperCase() : current.sku;
  Object.assign(current, { [field]: numericFields.includes(field) ? Number(value) : String(value).trim(), sku: nextSku, updatedAt: new Date().toISOString() });
  state.movements.forEach((movement) => { if (movement.sku === sku) movement.sku = nextSku; });
  saveLocalState();
  render();
}

function addItem() {
  if (!can("items:write")) return;
  const nextNumber = String(state.items.length + 1).padStart(3, "0");
  state.items.push(item(`NOVO-${nextNumber}`, "Novo item", "Produto", "Sem categoria", 0, 0, 0, 0, 7, [0, 0, 0, 0, 0, 0], new Date().toISOString()));
  saveLocalState();
  render();
}

function deleteItem(sku) {
  if (!can("items:write") || !confirm(`Remover o item ${sku}?`)) return;
  state.items = state.items.filter((entry) => entry.sku !== sku);
  state.movements = state.movements.filter((movement) => movement.sku !== sku);
  saveLocalState();
  render();
}

function movementHandler(type) {
  return (event) => {
    event.preventDefault();
    if (!can("movements:write")) return;
    const prefix = type === "entry" ? "entry" : "exit";
    const message = document.querySelector("#stockMovementMessage");
    const sku = document.querySelector(`#${prefix}Sku`).value.trim().toUpperCase();
    const quantity = Number(document.querySelector(`#${prefix}Quantity`).value);
    const date = document.querySelector(`#${prefix}Date`).value || today();
    const note = document.querySelector(`#${prefix}Note`).value.trim();
    const entry = state.items.find((candidate) => candidate.sku === sku);
    if (!entry || !Number.isFinite(quantity) || quantity <= 0) return showMessage(message, "Informe SKU existente e quantidade maior que zero.", "error");
    const previousStock = Number(entry.stock || 0);
    if (type === "exit" && quantity > previousStock) return showMessage(message, `Saida bloqueada. Saldo disponivel: ${previousStock}.`, "error");
    const newStock = type === "entry" ? previousStock + quantity : previousStock - quantity;
    entry.stock = newStock;
    entry.updatedAt = new Date().toISOString();
    const user = activeUser();
    state.movements.unshift({
      id: createId(),
      type,
      sku,
      itemName: entry.name,
      quantity,
      unitCost: Number(entry.unitCost || 0),
      value: quantity * Number(entry.unitCost || 0),
      previousStock,
      newStock,
      date,
      note,
      userId: user.id,
      userName: user.name,
      createdAt: new Date().toISOString()
    });
    document.querySelector(`#${prefix}Quantity`).value = "";
    document.querySelector(`#${prefix}Note`).value = "";
    saveLocalState();
    showMessage(message, `${type === "entry" ? "Entrada" : "Saida"} registrada no navegador.`, "success");
    render();
  };
}

function addUser(event) {
  event.preventDefault();
  if (!can("users:write")) return;
  const username = document.querySelector("#userLogin").value.trim().toLowerCase();
  if (state.users.some((user) => user.username.toLowerCase() === username)) return alert("Usuario ja existe.");
  state.users.push({
    id: createId(),
    name: document.querySelector("#userName").value.trim(),
    username,
    password: document.querySelector("#userPassword").value,
    role: document.querySelector("#userRole").value,
    active: true,
    createdAt: new Date().toISOString()
  });
  document.querySelector("#userForm").reset();
  saveLocalState();
  render();
}

function toggleUser(id, active) {
  if (!can("users:write")) return;
  const user = state.users.find((entry) => entry.id === id);
  if (user) user.active = active;
  saveLocalState();
  render();
}

function classroomAction(action, successMessage) {
  if (!can("users:write")) return;
  if (action === "setup") setupClassroom();
  if (action === "prepare-activity" || action === "reset-scenario") resetScenario();
  if (action === "reset-movements") state.movements = [];
  saveLocalState();
  render();
  showMessage(document.querySelector("#classroomMessage"), successMessage, "success");
}

function setupClassroom() {
  const existing = new Set(state.users.map((user) => user.username));
  [1, 2, 3, 4].forEach((number) => {
    const username = `grupo${number}`;
    if (!existing.has(username)) {
      state.users.push({ id: createId(), name: `Grupo ${number}`, username, password: "grupo123", role: "Operador", active: true, createdAt: new Date().toISOString() });
    }
  });
}

function resetScenario() {
  state.items = classroomItems();
  state.movements = [];
  setupClassroom();
}

function exportCsv() {
  const headers = ["sku", "name", "type", "category", "stock", "minStock", "unitCost", "monthlyDemand", "leadTime", "abc", "xyz", "coverage", "reorderPoint", "suggestedPurchase"];
  const csv = [headers.join(";"), ...enrichItems(state.items, periodMovements()).map((entry) => headers.map((header) => String(entry[header] ?? "").replaceAll(";", ",")).join(";"))].join("\n");
  downloadFile("controle-estoque-aula.csv", csv, "text/csv;charset=utf-8");
}

function exportJson() {
  downloadFile("controle-estoque-aula-dados.json", JSON.stringify(state, null, 2), "application/json;charset=utf-8");
}

function importJson(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(String(reader.result || ""));
      if (!Array.isArray(parsed.items) || !Array.isArray(parsed.movements) || !Array.isArray(parsed.users)) throw new Error("Arquivo invalido.");
      state = parsed;
      saveLocalState();
      render();
    } catch (error) {
      alert(error.message);
    }
  };
  reader.readAsText(file, "utf-8");
}

function downloadFile(name, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}

function setRange(range) { startDate = range === "year" ? `${new Date().getFullYear()}-01-01` : daysAgo(Number(range)); endDate = today(); render(); }
function sum(values, field) { return values.reduce((total, entry) => total + Number(entry[field] || 0), 0); }
function average(values) { return values.length ? values.reduce((total, value) => total + value, 0) / values.length : 0; }
function setText(selector, value) { document.querySelector(selector).textContent = value; }
function showMessage(element, text, type) { element.className = `form-message ${type}`; element.textContent = text; }
function formatDate(value) { if (!value) return ""; const [year, month, day] = value.split("-"); return day ? `${day}/${month}/${year}` : value; }
function escapeHtml(value) { return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;"); }
function createId() { return globalThis.crypto?.randomUUID?.() || `id-${Date.now()}-${Math.random().toString(16).slice(2)}`; }

function drawAbcChart(enriched) {
  const canvas = document.querySelector("#abcChart");
  const ctx = prepareCanvas(canvas);
  const data = [...enriched].sort((a, b) => b.annualConsumptionValue - a.annualConsumptionValue);
  const width = canvas.clientWidth, height = canvas.clientHeight, pad = 44, labelSpace = 96;
  const chartWidth = width - pad * 2, chartHeight = height - pad - labelSpace;
  const maxValue = Math.max(...data.map((entry) => entry.annualConsumptionValue), 1);
  ctx.clearRect(0, 0, width, height);
  drawGrid(ctx, pad, chartWidth, chartHeight);
  const barWidth = chartWidth / Math.max(data.length, 1) * 0.62;
  data.forEach((entry, index) => {
    const x = pad + index * (chartWidth / Math.max(data.length, 1)) + barWidth * 0.25;
    const barHeight = (entry.annualConsumptionValue / maxValue) * (chartHeight - 18);
    ctx.fillStyle = entry.abc === "A" ? "#176b54" : entry.abc === "B" ? "#d99a2b" : "#8a9690";
    ctx.fillRect(x, pad + chartHeight - barHeight, barWidth, barHeight);
    drawRotatedLabel(ctx, shorten(entry.name, 18), x + barWidth / 2, pad + chartHeight + 18);
  });
  ctx.strokeStyle = "#b12d2d";
  ctx.lineWidth = 3;
  ctx.beginPath();
  data.forEach((entry, index) => {
    const x = pad + index * (chartWidth / Math.max(data.length, 1)) + barWidth * 0.75;
    const y = pad + chartHeight - entry.cumulativeParticipation * chartHeight;
    index === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  });
  ctx.stroke();
  ctx.fillStyle = "#617066";
  ctx.font = "12px Segoe UI, Arial";
  ctx.fillText("Valor de consumo anual", pad, 22);
  ctx.fillText("Linha vermelha: acumulado ABC", width - 220, 22);
}

function drawMatrixChart(enriched) {
  const canvas = document.querySelector("#matrixChart");
  const ctx = prepareCanvas(canvas);
  const width = canvas.clientWidth, height = canvas.clientHeight, pad = 48, plotWidth = width - pad - 36, plotHeight = height - pad - 78;
  const maxValue = Math.max(...enriched.map((entry) => entry.annualConsumptionValue), 1);
  const xyzScore = { X: 1, Y: 2, Z: 3 };
  ctx.clearRect(0, 0, width, height);
  drawGrid(ctx, pad, plotWidth, plotHeight);
  ctx.fillStyle = "#617066";
  ctx.font = "12px Segoe UI, Arial";
  ctx.fillText("Baixa variacao", pad, pad + plotHeight + 30);
  ctx.fillText("Alta variacao", width - 126, pad + plotHeight + 30);
  enriched.forEach((entry) => {
    const x = pad + ((xyzScore[entry.xyz] - 0.5) / 3) * plotWidth;
    const radius = Math.max(7, Math.min(24, Math.sqrt(Number(entry.stock || 0)) / 2));
    const y = Math.max(pad + radius, Math.min(pad + plotHeight - radius, pad + plotHeight - (entry.annualConsumptionValue / maxValue) * plotHeight));
    ctx.beginPath();
    ctx.fillStyle = entry.status === "critical" ? "#b12d2d" : entry.abc === "A" ? "#176b54" : "#d99a2b";
    ctx.globalAlpha = .86;
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = "#17211b";
    ctx.font = "11px Segoe UI, Arial";
    ctx.fillText(entry.sku, x + radius + 4, y + 4);
  });
}

function prepareCanvas(canvas) {
  const rect = canvas.getBoundingClientRect();
  const ratio = window.devicePixelRatio || 1;
  canvas.width = rect.width * ratio;
  canvas.height = rect.height * ratio;
  const ctx = canvas.getContext("2d");
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  return ctx;
}

function drawGrid(ctx, pad, width, height) {
  ctx.strokeStyle = "#dbe4dd";
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i += 1) {
    const y = pad + (height / 4) * i;
    ctx.beginPath();
    ctx.moveTo(pad, y);
    ctx.lineTo(pad + width, y);
    ctx.stroke();
  }
}

function shorten(value, maxLength) {
  const text = String(value || "");
  return text.length > maxLength ? `${text.slice(0, maxLength - 1)}...` : text;
}

function drawRotatedLabel(ctx, text, x, y) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-Math.PI / 4);
  ctx.fillStyle = "#17211b";
  ctx.font = "11px Segoe UI, Arial";
  ctx.textAlign = "right";
  ctx.fillText(text, 0, 0);
  ctx.restore();
}

document.querySelector("#loginForm").addEventListener("submit", login);
document.querySelector("#refreshData").addEventListener("click", loadState);
document.querySelector("#logoutBtn").addEventListener("click", () => { activeUserId = ""; localStorage.removeItem(ACTIVE_USER_KEY); loadState(); });
document.querySelector("#categoryFilter").addEventListener("change", (event) => { filteredCategory = event.target.value; render(); });
document.querySelector("#abcMode").addEventListener("change", (event) => { abcMode = event.target.value; render(); });
document.querySelector("#searchInput").addEventListener("input", (event) => { searchTerm = event.target.value.trim().toLowerCase(); render(); });
document.querySelector("#startDate").addEventListener("change", (event) => { startDate = event.target.value; render(); });
document.querySelector("#endDate").addEventListener("change", (event) => { endDate = event.target.value; render(); });
document.querySelectorAll("[data-range]").forEach((button) => button.addEventListener("click", () => setRange(button.dataset.range)));
document.querySelector("#addItem").addEventListener("click", addItem);
document.querySelector("#stockEntryForm").addEventListener("submit", movementHandler("entry"));
document.querySelector("#stockExitForm").addEventListener("submit", movementHandler("exit"));
document.querySelector("#userForm").addEventListener("submit", addUser);
document.querySelector("#usersList").addEventListener("click", (event) => {
  const button = event.target.closest("[data-toggle-user]");
  if (button) toggleUser(button.dataset.toggleUser, button.textContent.trim() === "Ativar");
});
document.querySelector("#exportCsv").addEventListener("click", exportCsv);
document.querySelector("#exportPdf").addEventListener("click", () => { render(); window.print(); });
document.querySelector("#printReport").addEventListener("click", () => { render(); window.print(); });
document.querySelector("#setupClassroom").addEventListener("click", () => classroomAction("setup", "Grupos locais prontos: grupo1, grupo2, grupo3 e grupo4. Senha: grupo123."));
document.querySelector("#prepareActivity").addEventListener("click", () => confirm("Preparar a atividade vai restaurar os itens e zerar as movimentacoes deste navegador. Continuar?") && classroomAction("prepare-activity", "Atividade preparada neste navegador."));
document.querySelector("#resetMovements").addEventListener("click", () => confirm("Zerar todas as movimentacoes deste navegador?") && classroomAction("reset-movements", "Movimentacoes zeradas neste navegador."));
document.querySelector("#resetScenario").addEventListener("click", () => confirm("Restaurar a atividade neste navegador?") && classroomAction("reset-scenario", "Atividade restaurada neste navegador."));
document.querySelectorAll(".nav-list a").forEach((link) => link.addEventListener("click", () => {
  document.querySelectorAll(".nav-list a").forEach((entry) => entry.classList.remove("active"));
  link.classList.add("active");
}));
window.addEventListener("resize", render);

loadState();
