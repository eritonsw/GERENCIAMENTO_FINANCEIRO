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
  filterMonth: $$('#filterMonth'),
  filterYear: $$('#filterYear'),
  filterCategory: $$('#filterCategory'),
  filterStatus: $$('#filterStatus'),
  filterForma: $$('#filterForma'),
  filterConta: $$('#filterConta'),
  cardSaldoReal: $$('#cardSaldoReal'),
  cardSaldoProjetado: $$('#cardSaldoProjetado'),
  cardReceitas: $$('#cardReceitas'),
  cardDespesas: $$('#cardDespesas'),
  extratoList: $$('#extratoList'),
  fixasList: $$('#fixasList'),
  faturasList: $$('#faturasList'),
  proximaFatura: $$('#proximaFatura'),
  btnRefresh: $$('#btnRefresh'),
  btnNewLancamento: $$('#btnNewLancamento'),
  btnNewFixa: $$('#btnNewFixa'),
  btnNewCartao: $$('#btnNewCartao'),
  modalLancamento: $$('#modalLancamento'),
  modalFixa: $$('#modalFixa'),
  modalCartao: $$('#modalCartao'),
  formLancamento: $$('#formLancamento'),
  formFixa: $$('#formFixa'),
  formCartao: $$('#formCartao'),
  modalCategoria: $$('#modalCategoria'),
  modalFixaCategoria: $$('#modalFixaCategoria'),
  modalConta: $$('#modalConta'),
};

document.addEventListener('DOMContentLoaded', async () => {
  initFilters();
  bindEvents();
  await loadBootstrap();
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
  [el.filterMonth, el.filterYear].forEach(item => item.addEventListener('change', loadBootstrap));
  [el.filterCategory, el.filterStatus, el.filterForma, el.filterConta].forEach(item => item.addEventListener('change', renderAll));
  el.btnRefresh.addEventListener('click', loadBootstrap);
  el.btnNewLancamento.addEventListener('click', () => openDialog(el.modalLancamento));
  el.btnNewFixa.addEventListener('click', () => openDialog(el.modalFixa));
  el.btnNewCartao.addEventListener('click', () => openDialog(el.modalCartao));

  el.formLancamento.addEventListener('submit', onSaveLancamento);
  el.formFixa.addEventListener('submit', onSaveFixa);
  el.formCartao.addEventListener('submit', onSaveCartao);
}

async function loadBootstrap() {
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
  fillSelect(el.filterCategory, [''].concat(state.categorias), 'Todas');
  fillSelect(el.modalCategoria, state.categorias, 'Selecione');
  fillSelect(el.modalFixaCategoria, state.categorias, 'Selecione');

  const formas = unique(state.lancamentos.map(l => l.forma_pagamento).filter(Boolean).concat(['Pix','Débito','Crédito','Boleto','Dinheiro','Transferência']));
  fillSelect(el.filterForma, [''].concat(formas), 'Todas');

  const contas = unique(
    state.lancamentos.map(l => l.conta_pagamento).filter(Boolean)
      .concat(state.cartoes.map(c => c.nome_cartao))
  );
  fillSelect(el.filterConta, [''].concat(contas), 'Todos');
  fillSelect(el.modalConta, state.cartoes.map(c => c.nome_cartao), 'Selecione');
}

function populateModals() {
  el.formLancamento.reset();
  el.formFixa.reset();
  el.formCartao.reset();
  const today = new Date().toISOString().slice(0, 10);
  el.formLancamento.elements.data.value = today;
}

function renderAll() {
  renderCards();
  renderChart();
  renderProximaFatura();
  renderExtrato();
  renderFixas();
  renderFaturas();
}

function renderCards() {
  const cards = state.dashboard.cards || {};
  el.cardSaldoReal.textContent = money(cards.saldo_real || 0);
  el.cardSaldoProjetado.textContent = money(cards.saldo_projetado || 0);
  el.cardReceitas.textContent = money(cards.receitas_recebidas || 0);
  el.cardDespesas.textContent = money(cards.despesas_previstas || 0);
}

function renderChart() {
  const data = state.dashboard.grafico_categorias || [];
  const ctx = document.getElementById('chartCategorias');
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
        legend: { position: 'bottom', labels: { color: '#e5e7eb' } },
      },
    },
    plugins: [{
      id: 'centerText',
      afterDraw(chart) {
        const { ctx } = chart;
        const total = data.reduce((s, i) => s + Number(i.valor || 0), 0);
        ctx.save();
        ctx.font = 'bold 16px Arial';
        ctx.fillStyle = '#e5e7eb';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(money(total), chart.width / 2, chart.height / 2);
        ctx.restore();
      }
    }]
  });
}

function renderProximaFatura() {
  const f = state.dashboard.proxima_fatura;
  if (!f) {
    el.proximaFatura.innerHTML = '<div class="empty-state">Nenhuma fatura disponível.</div>';
    return;
  }
  el.proximaFatura.innerHTML = `
    <div class="list-item">
      <div class="list-item-top">
        <div>
          <strong>${escapeHtml(f.nome_cartao)}</strong>
          <small>Competência ${escapeHtml(f.competencia)} • vence em ${formatDateBR(f.data_vencimento)}</small>
        </div>
        <strong>${money(f.valor_total)}</strong>
      </div>
      <div class="inline-actions">
        <span class="badge ${slugify(f.status)}">${escapeHtml(f.status)}</span>
      </div>
    </div>`;
}

function renderExtrato() {
  const items = filteredLancamentos();
  if (!items.length) {
    el.extratoList.innerHTML = '<div class="empty-state">Nenhum lançamento encontrado.</div>';
    return;
  }
  el.extratoList.innerHTML = items.map(item => `
    <div class="list-item">
      <div class="list-item-top">
        <div>
          <strong>${escapeHtml(item.descricao)}</strong>
          <small>${formatDateBR(item.data)} • ${escapeHtml(item.categoria)}${item.conta_pagamento ? ' • ' + escapeHtml(item.conta_pagamento) : ''}</small>
        </div>
        <div style="text-align:right">
          <strong>${item.tipo === 'receita' ? '+' : '-'} ${money(item.valor)}</strong>
          <span class="badge ${slugify(item.status)}">${escapeHtml(item.status)}</span>
        </div>
      </div>
    </div>`).join('');
}

function renderFixas() {
  const comp = `${el.filterYear.value}-${String(el.filterMonth.value).padStart(2, '0')}`;
  const materializadas = new Set(state.lancamentos.filter(l => l.origem_fixa && l.competencia === comp).map(l => l.origem_fixa));
  const items = state.fixas.filter(f => (f.ativo || '').toLowerCase() === 'sim');

  if (!items.length) {
    el.fixasList.innerHTML = '<div class="empty-state">Nenhuma fixa cadastrada.</div>';
    return;
  }

  el.fixasList.innerHTML = items.map(item => {
    const jaPaga = materializadas.has(item.id_fixa);
    return `
      <div class="list-item">
        <div class="list-item-top">
          <div>
            <strong>${escapeHtml(item.descricao)}</strong>
            <small>${escapeHtml(item.categoria)} • vence dia ${escapeHtml(item.dia_vencimento)}</small>
          </div>
          <strong>${money(item.valor_padrao)}</strong>
        </div>
        <div class="inline-actions">
          <span class="badge ${jaPaga ? 'pago' : 'pendente'}">${jaPaga ? 'materializada' : 'prevista'}</span>
          ${jaPaga ? '' : `<button onclick="payFixa('${item.id_fixa}')">Pagar</button>`}
        </div>
      </div>`;
  }).join('');
}

function renderFaturas() {
  if (!state.faturas.length && !state.cartoes.length) {
    el.faturasList.innerHTML = '<div class="empty-state">Nenhum cartão cadastrado.</div>';
    return;
  }

  const parts = [];
  if (state.cartoes.length) {
    parts.push(...state.cartoes.map(c => {
      const usadas = state.lancamentos.filter(l => l.id_cartao === c.id_cartao).reduce((s, l) => s + Number(l.valor || 0), 0);
      return `
        <div class="list-item">
          <div class="list-item-top">
            <div>
              <strong>${escapeHtml(c.nome_cartao)}</strong>
              <small>Fecha dia ${escapeHtml(c.dia_fechamento)} • vence dia ${escapeHtml(c.dia_vencimento)}</small>
            </div>
            <div style="text-align:right">
              <strong>${money(usadas)}</strong>
              <small>limite ${money(c.limite || 0)}</small>
            </div>
          </div>
        </div>`;
    }));
  }
  if (state.faturas.length) {
    parts.push(...state.faturas.map(f => `
      <div class="list-item">
        <div class="list-item-top">
          <div>
            <strong>Fatura ${escapeHtml(f.nome_cartao)}</strong>
            <small>${escapeHtml(f.competencia)} • fechamento ${formatDateBR(f.data_fechamento)} • vencimento ${formatDateBR(f.data_vencimento)}</small>
          </div>
          <div style="text-align:right">
            <strong>${money(f.valor_total)}</strong>
            <span class="badge ${slugify(f.status)}">${escapeHtml(f.status)}</span>
          </div>
        </div>
      </div>`
    ));
  }

  el.faturasList.innerHTML = parts.join('');
}

function filteredLancamentos() {
  return state.lancamentos.filter(item => {
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
  el.modalLancamento.close();
  await loadBootstrap();
}

async function onSaveFixa(ev) {
  ev.preventDefault();
  const data = Object.fromEntries(new FormData(el.formFixa).entries());
  await postAction('saveFixa', data);
  el.modalFixa.close();
  await loadBootstrap();
}

async function onSaveCartao(ev) {
  ev.preventDefault();
  const data = Object.fromEntries(new FormData(el.formCartao).entries());
  await postAction('saveCartao', data);
  el.modalCartao.close();
  await loadBootstrap();
}

async function payFixa(id) {
  const forma = prompt('Forma de pagamento (Pix, Débito, Crédito, etc.):', 'Pix');
  if (forma === null) return;
  let conta = '';
  if ((forma || '').toLowerCase() === 'crédito' || (forma || '').toLowerCase() === 'credito') {
    conta = prompt('Nome do cartão cadastrado:', state.cartoes[0]?.nome_cartao || '');
    if (conta === null) return;
  } else {
    conta = prompt('Conta usada (opcional):', '');
    if (conta === null) return;
  }
  await postAction('payFixa', { id, data: { data: new Date().toISOString().slice(0,10), forma_pagamento: forma, conta_pagamento: conta, status: 'pago' } }, true);
  await loadBootstrap();
}
window.payFixa = payFixa;

async function postAction(action, data, raw = false) {
  const payload = raw ? data : { action, data };
  if (!raw) payload.action = action;
  const body = new URLSearchParams();
  body.append('payload', JSON.stringify(payload));
  const res = await fetch(API_URL, { method: 'POST', body });
  const json = await res.json();
  if (!json.ok) throw new Error(json.error || 'Falha ao salvar');
  return json;
}

function fillSelect(select, values, placeholder) {
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
  select.value = current;
}

function openDialog(dialog) {
  if (typeof dialog.showModal === 'function') dialog.showModal();
}

function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./service-worker.js').catch(() => {});
  }
}

function money(value) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0));
}

function formatDateBR(value) {
  if (!value) return '-';
  const [y, m, d] = String(value).split('-');
  return `${d}/${m}/${y}`;
}

function unique(arr) {
  return [...new Set(arr.filter(Boolean))];
}

function slugify(v) {
  return String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
