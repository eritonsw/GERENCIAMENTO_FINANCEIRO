let state = {
  categorias: [],
  cartoes: [],
  contas: [],
  lancamentos: [],
  fixas: [],
  faturas: [],
  dashboard: {},
};

let chartCategorias;

const $ = (sel) => document.querySelector(sel);

const el = {
  filterMonth: $('#filtroMes'),
  filterYear: $('#filtroAno'),
  filterCategory: $('#filtroCategoria'),
  filterStatus: $('#filtroStatus'),
  filterForma: $('#filtroForma'),
  filterConta: $('#filtroConta'),

  saldoReal: $('#saldoReal'),
  saldoProjetado: $('#saldoProjetado'),
  receitasRecebidas: $('#receitasRecebidas'),
  despesasPrevistas: $('#despesasPrevistas'),

  proximaFatura: $('#proximaFatura'),
  listaLancamentos: $('#listaLancamentos'),
  listaFixas: $('#listaFixas'),
  listaCartoes: $('#listaCartoes'),

  modalLancamento: $('#modalLancamento'),
  modalFixa: $('#modalFixa'),
  modalCartao: $('#modalCartao'),

  formLancamento: $('#formLancamento'),
  formFixa: $('#formFixa'),
  formCartao: $('#formCartao'),

  lancCategoria: $('#lancCategoria'),
  lancForma: $('#lancForma'),
  lancConta: $('#lancConta'),
  lancCartao: $('#lancCartao'),
  lancParcelado: $('#lancParcelado'),
  lancTotalParcelas: $('#lancTotalParcelas'),

  fieldConta: $('#fieldConta'),
  fieldCartao: $('#fieldCartao'),
  fieldParcelado: $('#fieldParcelado'),
  fieldTotalParcelas: $('#fieldTotalParcelas'),

  fixaCategoria: $('#fixaCategoria'),
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
    opt.value = String(m).padStart(2, '0');
    opt.textContent = String(m).padStart(2, '0');
    if (m === now.getMonth() + 1) opt.selected = true;
    el.filterMonth.appendChild(opt);
  }

  for (let y = now.getFullYear() - 2; y <= now.getFullYear() + 2; y++) {
    const opt = document.createElement('option');
    opt.value = String(y);
    opt.textContent = String(y);
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

  el.lancForma?.addEventListener('change', updatePagamentoFields);
  el.lancParcelado?.addEventListener('change', updatePagamentoFields);
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
  fillSelect(el.filterCategory, state.categorias || [], 'Todas');

  const formas = unique(
    (state.lancamentos || []).map(l => l.forma_pagamento).filter(Boolean)
      .concat(['Pix', 'Débito', 'Crédito', 'Dinheiro', 'Transferência'])
  );
  fillSelect(el.filterForma, formas, 'Todas');

  const contas = unique([
    ...(state.contas || []).map(c => c.nome),
    ...(state.cartoes || []).map(c => c.nome_cartao),
    ...(state.lancamentos || []).map(l => l.conta_pagamento).filter(Boolean),
  ]);
  fillSelect(el.filterConta, contas, 'Todos');
}

function populateModals() {
  fillSelect(el.lancCategoria, state.categorias || [], 'Selecione');
  fillSelect(el.fixaCategoria, state.categorias || [], 'Selecione');

  fillSelect(
    el.lancConta,
    (state.contas || []).filter(c => String(c.ativo).toLowerCase() === 'sim').map(c => c.nome),
    'Selecione'
  );

  fillSelect(
    el.lancCartao,
    (state.cartoes || []).filter(c => String(c.ativo).toLowerCase() === 'sim').map(c => `${c.id_cartao}||${c.nome_cartao}`),
    'Selecione',
    true
  );

  const lancData = document.getElementById('lancData');
  if (lancData) lancData.value = new Date().toISOString().slice(0, 10);

  updatePagamentoFields();
}

function updatePagamentoFields() {
  const forma = el.lancForma?.value || '';
  const parcelado = el.lancParcelado?.value || 'nao';
  const isCredito = forma === 'Crédito';

  el.fieldConta?.classList.toggle('hidden', isCredito);
  el.fieldCartao?.classList.toggle('hidden', !isCredito);
  el.fieldParcelado?.classList.toggle('hidden', !isCredito);
  el.fieldTotalParcelas?.classList.toggle('hidden', !isCredito || parcelado !== 'sim');

  if (!isCredito) {
    if (el.lancCartao) el.lancCartao.value = '';
    if (el.lancParcelado) el.lancParcelado.value = 'nao';
    if (el.lancTotalParcelas) el.lancTotalParcelas.value = 1;
  }

  if (isCredito && parcelado !== 'sim' && el.lancTotalParcelas) {
    el.lancTotalParcelas.value = 1;
  }
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

  const maior = [...data].sort((a, b) => Number(b.valor || 0) - Number(a.valor || 0))[0];

  chartCategorias = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: data.map(i => i.categoria),
      datasets: [{ data: data.map(i => Number(i.valor || 0)) }],
    },
    options: {
      maintainAspectRatio: false,
      cutout: '62%',
      plugins: {
        legend: {
          position: 'bottom',
          labels: { color: '#dbe7ff' }
        },
        tooltip: {
          callbacks: {
            label(context) {
              return `${context.label}: ${money(context.raw)}`;
            }
          }
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

  const subtitle = document.querySelector('.panel-chart .panel-subtitle');
  if (subtitle) {
    subtitle.textContent = maior
      ? `Maior gasto do mês: ${maior.categoria} (${money(maior.valor)})`
      : 'Visão rápida do peso de cada categoria';
  }
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

  el.listaLancamentos.innerHTML = items.map(item => {
    const sinal = item.tipo === 'receita' ? '+' : '-';
    const origem = item.forma_pagamento === 'Crédito'
      ? (item.nome_cartao || item.conta_pagamento || '')
      : (item.conta_pagamento || '');

    const parcelaTxt = String(item.total_parcelas || '1') !== '1'
      ? ` • ${item.parcela_atual || 1}/${item.total_parcelas}`
      : '';

    return `
      <div class="list-item">
        <div class="list-item-title">${escapeHtml(item.descricao)}</div>
        <div class="list-item-meta">
          ${formatDateBR(item.data)} • ${escapeHtml(item.categoria)} • ${escapeHtml(item.status || '')}
        </div>
        <div class="list-item-meta">
          ${escapeHtml(item.forma_pagamento || '')}${origem ? ' • ' + escapeHtml(origem) : ''}${parcelaTxt}
        </div>
        <div class="list-item-title" style="margin-top:8px;">${sinal} ${money(item.valor)}</div>
      </div>
    `;
  }).join('');
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

  if (!cards.length) {
    el.listaCartoes.innerHTML = `<div class="empty-state">Nenhum cartão cadastrado.</div>`;
    return;
  }

  el.listaCartoes.innerHTML = cards.join('');
}

function filteredLancamentos() {
  return (state.lancamentos || []).filter(item => {
    if (el.filterCategory.value && item.categoria !== el.filterCategory.value) return false;
    if (el.filterStatus.value && item.status !== el.filterStatus.value) return false;
    if (el.filterForma.value && item.forma_pagamento !== el.filterForma.value) return false;

    if (el.filterConta.value) {
      const alvo = item.forma_pagamento === 'Crédito'
        ? (item.nome_cartao || item.conta_pagamento || '')
        : (item.conta_pagamento || '');
      if (alvo !== el.filterConta.value) return false;
    }

    return true;
  });
}

async function onSaveLancamento(ev) {
  ev.preventDefault();

  const data = Object.fromEntries(new FormData(el.formLancamento).entries());

  if (data.forma_pagamento === 'Crédito') {
    if (!data.id_cartao) {
      alert('Selecione um cartão.');
      return;
    }

    const [idCartao, nomeCartao] = String(data.id_cartao).split('||');
    data.id_cartao = idCartao || '';
    data.conta_pagamento = nomeCartao || '';
  } else {
    data.id_cartao = '';
    data.parcelado = 'nao';
    data.total_parcelas = 1;
  }

  if (data.parcelado !== 'sim') {
    data.total_parcelas = 1;
  }

  await postAction('saveLancamento', data);
  el.formLancamento.reset();
  closeModal('modalLancamento');
  await loadDashboard();
}

async function onSaveFixa(ev) {
  ev.preventDefault();

  const data = Object.fromEntries(new FormData(el.formFixa).entries());
  await postAction('saveFixa', data);
  el.formFixa.reset();
  closeModal('modalFixa');
  await loadDashboard();
}

async function onSaveCartao(ev) {
  ev.preventDefault();

  const data = Object.fromEntries(new FormData(el.formCartao).entries());
  await postAction('saveCartao', data);
  el.formCartao.reset();
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

function fillSelect(select, values, placeholder, cartaoComTexto = false) {
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
    if (!value) return;

    const opt = document.createElement('option');

    if (cartaoComTexto) {
      const [id, nome] = String(value).split('||');
      opt.value = value;
      opt.textContent = nome || id || value;
    } else {
      opt.value = value;
      opt.textContent = value;
    }

    select.appendChild(opt);
  });

  if ([...select.options].some(o => o.value === current)) {
    select.value = current;
  }
}

function openLancamentoModal() {
  openModal('modalLancamento');
  updatePagamentoFields();
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
  if (!y || !m || !d) return value;
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
