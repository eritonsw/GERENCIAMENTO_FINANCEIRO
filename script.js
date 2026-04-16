let state = {
  categorias: [],
  cartoes: [],
  lancamentos: [],
  fixas: [],
  faturas: [],
  dashboard: {},
};

let chartCategorias;

const $$ = sel => document.querySelector(sel);

const el = {
  filterMonth: $$('#filtroMes'),
  filterYear: $$('#filtroAno'),
  filterCategory: $$('#filtroCategoria'),
  filterStatus: $$('#filtroStatus'),
  filterForma: $$('#filtroForma'),
  filterConta: $$('#filtroConta'),

  saldoReal: $$('#saldoReal'),
  saldoProjetado: $$('#saldoProjetado'),
  receitasRecebidas: $$('#receitasRecebidas'),
  despesasPrevistas: $$('#despesasPrevistas'),

  proximaFatura: $$('#proximaFatura'),
  listaLancamentos: $$('#listaLancamentos'),
  listaFixas: $$('#listaFixas'),
  listaCartoes: $$('#listaCartoes'),

  modalLancamento: $$('#modalLancamento'),
  modalFixa: $$('#modalFixa'),
  modalCartao: $$('#modalCartao'),

  formLancamento: $$('#formLancamento'),
  formFixa: $$('#formFixa'),
  formCartao: $$('#formCartao'),

  lancCategoria: $$('#lancCategoria'),
  lancConta: $$('#lancConta'),
  fixaCategoria: $$('#fixaCategoria'),
};

document.addEventListener('DOMContentLoaded', async () => {
  initFilters();
  bindEvents();
  await loadDashboard();
  registerServiceWorker();
});

function initFilters() {
  const now = new Date();

  for (let m = 1; m <= 12; m++) {
    const opt = document.createElement('option');
    opt.value = m;
    opt.textContent = String(m).padStart(2, '0');
    if (m === now.getMonth() + 1) opt.selected = true;
    el.filterMonth.appendChild(opt);
  }

  for (let y = now.getFullYear() - 2; y <= now.getFullYear() + 2; y++) {
    const opt = document.createElement('option');
    opt.value = y;
    opt.textContent = y;
    if (y === now.getFullYear()) opt.selected = true;
    el.filterYear.appendChild(opt);
  }
}

function bindEvents() {
  [el.filterMonth, el.filterYear].forEach(item => {
    item?.addEventListener('change', loadDashboard);
  });

  [el.filterCategory, el.filterStatus, el.filterForma, el.filterConta].forEach(item => {
    item?.addEventListener('change', renderAll);
  });

  el.formLancamento?.addEventListener('submit', onSaveLancamento);
  el.formFixa?.addEventListener('submit', onSaveFixa);
  el.formCartao?.addEventListener('submit', onSaveCartao);
}

async function loadDashboard() {
  try {
    const params = new URLSearchParams({
      action: 'bootstrap',
      month: el.filterMonth.value,
      year: el.filterYear.value,
    });

    const res = await fetch(`${API_URL}?${params.toString()}`);
    const json = await res.json();

    if (!json.ok) throw new Error(json.error || 'Falha ao carregar');

    state = json;

    populateFilters();
    populateModals();
    renderAll();
  } catch (err) {
    alert('Erro ao carregar dados: ' + err.message);
  }
}

function populateFilters() {
  fillSelect(el.filterCategory, [''].concat(state.categorias || []), 'Todas');

  const formas = unique(
    (state.lancamentos || [])
      .map(l => l.forma_pagamento)
      .filter(Boolean)
      .concat(['Pix', 'Débito', 'Crédito', 'Dinheiro', 'Transferência'])
  );
  fillSelect(el.filterForma, [''].concat(formas), 'Todas');

  const contas = unique(
    (state.lancamentos || []).map(l => l.conta_pagamento).filter(Boolean)
      .concat((state.cartoes || []).map(c => c.nome_cartao))
  );
  fillSelect(el.filterConta, [''].concat(contas), 'Todos');
}

function populateModals() {
  fillSelect(el.lancCategoria, state.categorias || [], 'Selecione');
  fillSelect(el.fixaCategoria, state.categorias || [], 'Selecione');
  fillSelect(el.lancConta, (state.cartoes || []).map(c => c.nome_cartao), 'Selecione');

  const lancData = document.getElementById('lancData');
  if (lancData) lancData.value = new Date().toISOString().slice(0, 10);
}

function renderAll() {
  renderCards();
  renderChart();
  renderProximaFatura();
  renderLancamentos();
  renderFixas();
  renderCartoes();
}

function renderCards() {
  const cards = state.dashboard?.cards || {};
  el.saldoReal.textContent = money(cards.saldo_real || 0);
  el.saldoProjetado.textContent = money(cards.saldo_projetado || 0);
  el.receitasRecebidas.textContent = money(cards.receitas_recebidas || 0);
  el.despesasPrevistas.textContent = money(cards.despesas_previstas || 0);
}

function renderChart() {
  const data = state.dashboard?.grafico_categorias || [];
  const ctx = document.getElementById('graficoCategorias');
  if (!ctx) return;

  if (chartCategorias) chartCategorias.destroy();

  chartCategorias = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: data.map(i => i.categoria),
      datasets: [{ data: data.map(i => i.valor) }],
    },
    options: {
      maintainAspectRatio: false,
      cutout: '62%',
      plugins: {
        legend: {
          position: 'bottom',
          labels: { color: '#dbe7ff' }
        }
      }
    },
    plugins: [{
      id: 'centerText',
      afterDraw(chart) {
        const total = data.reduce((s, i) => s + Number(i.valor || 0), 0);
        const { ctx } = chart;
        ctx.save();
        ctx.font = 'bold 16px Arial';
        ctx.fillStyle = '#eef4ff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(money(total), chart.width / 2, chart.height / 2);
        ctx.restore();
      }
    }]
  });
}

function renderProximaFatura() {
  const f = state.dashboard?.proxima_fatura;
  if (!f) {
    el.proximaFatura.innerHTML = `<div class="empty-state">Nenhuma fatura disponível.</div>`;
    return;
  }

  el.proximaFatura.innerHTML = `
    <div class="list-item">
      <div class="list-item-title">${escapeHtml(f.nome_cartao)}</div>
      <div class="list-item-meta">Competência ${escapeHtml(f.competencia)} • vence em ${formatDateBR(f.data_vencimento)}</div>
      <div class="list-item-title" style="margin-top:8px;">${money(f.valor_total)}</div>
    </div>
  `;
}

function renderLancamentos() {
  const items = filteredLancamentos();

  if (!items.length) {
    el.listaLancamentos.innerHTML = `<div class="empty-state">Nenhum lançamento encontrado.</div>`;
    return;
  }

  el.listaLancamentos.innerHTML = items.map(item => `
    <div class="list-item">
      <div class="list-item-title">${escapeHtml(item.descricao)}</div>
      <div class="list-item-meta">
        ${formatDateBR(item.data)} • ${escapeHtml(item.categoria)}${item.conta_pagamento ? ' • ' + escapeHtml(item.conta_pagamento) : ''}
      </div>
      <div class="list-item-title" style="margin-top:8px;">
        ${item.tipo === 'receita' ? '+' : '-'} ${money(item.valor)}
      </div>
    </div>
  `).join('');
}

function renderFixas() {
  const items = (state.fixas || []).filter(f => String(f.ativo || '').toLowerCase() === 'sim');

  if (!items.length) {
    el.listaFixas.innerHTML = `<div class="empty-state">Nenhuma fixa cadastrada.</div>`;
    return;
  }

  el.listaFixas.innerHTML = items.map(item => `
    <div class="list-item">
      <div class="list-item-title">${escapeHtml(item.descricao)}</div>
      <div class="list-item-meta">${escapeHtml(item.categoria)} • vence dia ${escapeHtml(item.dia_vencimento)}</div>
      <div class="list-item-title" style="margin-top:8px;">${money(item.valor_padrao)}</div>
    </div>
  `).join('');
}

function renderCartoes() {
  if (!(state.cartoes || []).length && !(state.faturas || []).length) {
    el.listaCartoes.innerHTML = `<div class="empty-state">Nenhum cartão cadastrado.</div>`;
    return;
  }

  const cards = [];

  (state.cartoes || []).forEach(c => {
    cards.push(`
      <div class="list-item">
        <div class="list-item-title">${escapeHtml(c.nome_cartao)}</div>
        <div class="list-item-meta">Fecha dia ${escapeHtml(c.dia_fechamento)} • vence dia ${escapeHtml(c.dia_vencimento)}</div>
        <div class="list-item-meta">Limite ${money(c.limite || 0)}</div>
      </div>
    `);
  });

  (state.faturas || []).forEach(f => {
    cards.push(`
      <div class="list-item">
        <div class="list-item-title">Fatura ${escapeHtml(f.nome_cartao)}</div>
        <div class="list-item-meta">${escapeHtml(f.competencia)} • vencimento ${formatDateBR(f.data_vencimento)}</div>
        <div class="list-item-title" style="margin-top:8px;">${money(f.valor_total)}</div>
      </div>
    `);
  });

  el.listaCartoes.innerHTML = cards.join('');
}

function filteredLancamentos() {
  return (state.lancamentos || []).filter(item => {
    if (el.filterCategory.value && item.categoria !== el.filterCategory.value) return false;
    if (el.filterStatus.value && item.status !== el.filterStatus.value) return false;
    if (el.filterForma.value && item.forma_pagamento !== el.filterForma.value) return false;
    if (el.filterConta.value && item.conta_pagamento !== el.filterConta.value) return false;
    return true;
  });
}

async function onSaveLancamento(ev) {
  ev.preventDefault();

  const data = Object.fromEntries(new FormData(el.formLancamento).entries());
  await postAction('saveLancamento', data);
  closeModal('modalLancamento');
  await loadDashboard();
}

async function onSaveFixa(ev) {
  ev.preventDefault();

  const data = Object.fromEntries(new FormData(el.formFixa).entries());
  await postAction('saveFixa', data);
  closeModal('modalFixa');
  await loadDashboard();
}

async function onSaveCartao(ev) {
  ev.preventDefault();

  const data = Object.fromEntries(new FormData(el.formCartao).entries());
  await postAction('saveCartao', data);
  closeModal('modalCartao');
  await loadDashboard();
}

async function postAction(action, data) {
  const payload = { action, data };
  const body = new URLSearchParams();
  body.append('payload', JSON.stringify(payload));

  const res = await fetch(API_URL, {
    method: 'POST',
    body
  });

  const json = await res.json();
  if (!json.ok) throw new Error(json.error || 'Falha ao salvar');
  return json;
}

function fillSelect(select, values, placeholder) {
  if (!select) return;

  const current = select.value;
  select.innerHTML = '';

  if (placeholder !== undefined) {
    const opt = document.createElement('option');
    opt.value = '';
    opt.textContent = placeholder;
    select.appendChild(opt);
  }

  values.forEach(value => {
    if (value === '') return;
    const opt = document.createElement('option');
    opt.value = value;
    opt.textContent = value;
    select.appendChild(opt);
  });

  if ([...select.options].some(o => o.value === current)) {
    select.value = current;
  }
}

function openLancamentoModal() {
  openModal('modalLancamento');
}

function openFixaModal() {
  openModal('modalFixa');
}

function openCartaoModal() {
  openModal('modalCartao');
}

function openModal(id) {
  const modal = document.getElementById(id);
  if (modal) modal.style.display = 'flex';
}

function closeModal(id) {
  const modal = document.getElementById(id);
  if (modal) modal.style.display = 'none';
}

window.openLancamentoModal = openLancamentoModal;
window.openFixaModal = openFixaModal;
window.openCartaoModal = openCartaoModal;
window.closeModal = closeModal;
window.loadDashboard = loadDashboard;

function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./service-worker.js').catch(() => {});
  }
}

function money(value) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(Number(value || 0));
}

function formatDateBR(value) {
  if (!value) return '-';
  const [y, m, d] = String(value).split('-');
  return `${d}/${m}/${y}`;
}

function unique(arr) {
  return [...new Set(arr.filter(Boolean))];
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
