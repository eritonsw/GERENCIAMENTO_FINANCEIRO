let categoriasCache = [];
let fixasCache = [];
let extratoCache = [];
let lancamentoEditandoId = null;
let fixaEditandoId = null;
let chartCategorias = null;

let formasPagamentoCache = [];
let contasPagamentoCache = [];

let limiteLancamentos = 5;
let limiteVencimentos = 5;
let limiteFixas = 5;
let limiteExtrato = 8;

const LIMITE_INICIAL_LANC = 5;
const LIMITE_INICIAL_VENC = 5;
const LIMITE_INICIAL_FIX = 5;
const LIMITE_INICIAL_EXT = 8;

async function apiGet(params = {}) {
  const url = new URL(API_URL);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, value);
    }
  });

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`Erro HTTP ${res.status}`);
  return await res.json();
}

async function apiPost(payload) {
  const formData = new URLSearchParams();
  formData.append('payload', JSON.stringify(payload));

  const res = await fetch(API_URL, {
    method: 'POST',
    body: formData
  });

  if (!res.ok) throw new Error(`Erro HTTP ${res.status}`);
  return await res.json();
}

async function init() {
  try {
    preencherFiltroMesAno();
    await carregarCategorias();
    await carregarFormasContas();
    await carregarFixas();
    await load();
  } catch (error) {
    console.error(error);
    showToast(`Erro ao iniciar: ${error.message}`, 'error');
  }
}

function preencherFiltroMesAno() {
  const selectMes = document.getElementById('filtroMes');
  const selectAno = document.getElementById('filtroAno');

  if (!selectMes || !selectAno) return;

  selectMes.innerHTML = '<option value="">Todos</option>';
  selectAno.innerHTML = '<option value="">Todos</option>';

  const meses = [
    { v: '01', n: 'Janeiro' },
    { v: '02', n: 'Fevereiro' },
    { v: '03', n: 'Março' },
    { v: '04', n: 'Abril' },
    { v: '05', n: 'Maio' },
    { v: '06', n: 'Junho' },
    { v: '07', n: 'Julho' },
    { v: '08', n: 'Agosto' },
    { v: '09', n: 'Setembro' },
    { v: '10', n: 'Outubro' },
    { v: '11', n: 'Novembro' },
    { v: '12', n: 'Dezembro' }
  ];

  meses.forEach(m => {
    const opt = document.createElement('option');
    opt.value = m.v;
    opt.textContent = m.n;
    selectMes.appendChild(opt);
  });

  const anoAtual = new Date().getFullYear();
  for (let ano = anoAtual + 1; ano >= anoAtual - 5; ano--) {
    const opt = document.createElement('option');
    opt.value = String(ano);
    opt.textContent = String(ano);
    selectAno.appendChild(opt);
  }

  selectMes.value = String(new Date().getMonth() + 1).padStart(2, '0');
  selectAno.value = String(new Date().getFullYear());
}

async function carregarCategorias() {
  const data = await apiGet({ action: 'categorias' });
  if (data?.status === 'erro') throw new Error(data.message || 'Erro ao carregar categorias.');

  categoriasCache = Array.isArray(data?.categorias) ? data.categorias : [];

  preencherSelect('categoria', categoriasCache, false, null);
  preencherSelect('fixaCategoria', categoriasCache, false, null);
  preencherSelect('filtroCategoriaLocal', categoriasCache, true, 'Todas');
}

async function carregarFormasContas() {
  const formasResp = await apiGet({ action: 'formasPagamento' });
  const contasResp = await apiGet({ action: 'contasPagamento' });

  formasPagamentoCache = Array.isArray(formasResp?.formas) ? formasResp.formas : [];
  contasPagamentoCache = Array.isArray(contasResp?.contas) ? contasResp.contas : [];

  preencherSelect('formaPagamento', formasPagamentoCache, false, null);
  preencherSelect('contaPagamento', contasPagamentoCache, false, null);
  preencherSelect('filtroFormaLocal', formasPagamentoCache, true, 'Todas');
  preencherSelect('filtroContaLocal', contasPagamentoCache, true, 'Todas');
}

function preencherSelect(id, values, includeEmpty = false, emptyLabel = 'Todos') {
  const select = document.getElementById(id);
  if (!select) return;

  select.innerHTML = '';

  if (includeEmpty) {
    const option = document.createElement('option');
    option.value = '';
    option.textContent = emptyLabel;
    select.appendChild(option);
  }

  values.forEach(v => {
    const option = document.createElement('option');
    option.value = v;
    option.textContent = v;
    select.appendChild(option);
  });
}

async function carregarFixas() {
  const data = await apiGet({ action: 'fixas' });
  if (data?.status === 'erro') throw new Error(data.message || 'Erro ao carregar fixas.');

  fixasCache = Array.isArray(data?.fixas) ? data.fixas : [];
  renderFixas(fixasCache);
}

async function load() {
  try {
    const data = await apiGet({
      action: 'dashboard',
      mes: document.getElementById('filtroMes')?.value || '',
      ano: document.getElementById('filtroAno')?.value || '',
      dataInicio: document.getElementById('filtroInicio')?.value || '',
      dataFim: document.getElementById('filtroFim')?.value || ''
    });

    if (data?.status === 'erro') {
      throw new Error(data.message || 'Erro ao carregar dashboard.');
    }

    document.getElementById('saldoReal').innerText = data?.cards?.saldoReal ?? 'R$ 0,00';
    document.getElementById('saldoProjetado').innerText = data?.cards?.saldoProjetado ?? 'R$ 0,00';
    document.getElementById('receitasReais').innerText = data?.cards?.receitasReais ?? 'R$ 0,00';
    document.getElementById('despesasProjetadas').innerText = data?.cards?.despesasProjetadas ?? 'R$ 0,00';

    extratoCache = Array.isArray(data?.extrato) ? data.extrato : [];

    renderLancamentos(Array.isArray(data?.lancamentos) ? data.lancamentos : []);
    renderVencimentos(Array.isArray(data?.vencimentos) ? data.vencimentos : []);
    renderExtrato(extratoCache);
    renderChartCategorias(Array.isArray(data?.chartCategorias) ? data.chartCategorias : []);
  } catch (error) {
    console.error(error);
    showToast(`Erro ao carregar dados: ${error.message}`, 'error');
  }
}

function renderLancamentos(items) {
  const lista = document.getElementById('lancamentos');
  const footer = document.getElementById('lancamentosFooter');
  lista.innerHTML = '';

  if (!items.length) {
    lista.innerHTML = '<li class="empty-state">Nenhum lançamento encontrado.</li>';
    if (footer) footer.innerHTML = '';
    return;
  }

  const visiveis = items.slice(0, limiteLancamentos);

  visiveis.forEach((item) => {
    const li = document.createElement('li');

    const tipo = item?.tipo ?? '';
    const descricao = item?.descricao ?? 'Sem descrição';
    const valor = item?.valor ?? '0,00';
    const data = item?.data ? formatDate(item.data) : '';
    const status = item?.status ?? '';
    const tipoClasse = tipo === 'receita' ? 'receita' : 'despesa';
    const tipoTexto = tipo === 'receita' ? 'Receita' : 'Despesa';

    let buttons = '';

    if (item.virtualFixa) {
      buttons += `<button class="mini-btn" onclick="editarFixaPorId('${escapeHtml(item.origem_fixa)}')">Editar fixa</button>`;
      buttons += `<button class="mini-btn success" onclick="abrirPagamentoFixa('${escapeHtml(item.origem_fixa)}','${escapeHtml(item.competencia)}')">Marcar pago</button>`;
    } else {
      buttons += `<button class="mini-btn" onclick='editarLancamento(${JSON.stringify(item)})'>Editar</button>`;

      if (tipo === 'despesa' && status !== 'pago') {
        buttons += `<button class="mini-btn success" onclick="atualizarStatus('${escapeHtml(item.id)}','pago')">Marcar pago</button>`;
      }

      if (tipo === 'receita' && status !== 'recebido') {
        buttons += `<button class="mini-btn success" onclick="atualizarStatus('${escapeHtml(item.id)}','recebido')">Marcar recebido</button>`;
      }

      buttons += `<button class="mini-btn danger" onclick="excluirLancamento('${escapeHtml(item.id)}')">Excluir</button>`;
    }

    li.innerHTML = `
      <div class="item-row">
        <div class="item-main">
          <span class="item-title">${escapeHtml(descricao)}</span>
          <span class="item-subtitle">
            ${tipoTexto}${data ? ` • ${escapeHtml(data)}` : ''} • ${escapeHtml(status)}
            ${item.forma_pagamento ? ` • ${escapeHtml(item.forma_pagamento)}` : ''}
            ${item.conta_pagamento ? ` • ${escapeHtml(item.conta_pagamento)}` : ''}
          </span>
        </div>
        <div class="item-actions">
          <span class="item-value ${tipoClasse}">
            ${tipo === 'receita' ? '+' : '-'} R$ ${escapeHtml(String(valor))}
          </span>
          <div class="action-buttons">${buttons}</div>
        </div>
      </div>
    `;

    lista.appendChild(li);
  });

  if (footer) {
    footer.innerHTML = `
      <button class="btn btn-secondary btn-small" type="button" onclick="toggleLancamentos(${items.length})">
        ${limiteLancamentos >= items.length ? '− Ver menos' : '+ Ver mais'}
      </button>
    `;
  }
}

function renderVencimentos(items) {
  const lista = document.getElementById('vencimentos');
  const footer = document.getElementById('vencimentosFooter');
  lista.innerHTML = '';

  if (!items.length) {
    lista.innerHTML = '<li class="empty-state">Nenhum vencimento próximo.</li>';
    if (footer) footer.innerHTML = '';
    return;
  }

  const visiveis = items.slice(0, limiteVencimentos);

  visiveis.forEach((item) => {
    const li = document.createElement('li');
    const descricao = item?.descricao ?? 'Conta';
    const vencimento = item?.vencimento ?? 'Sem data';
    const valor = item?.valor ? `R$ ${item.valor}` : 'Valor não informado';
    const nivel = item?.nivel ?? 'normal';

    li.classList.add(
      nivel === 'danger' ? 'vencimento-danger' :
      nivel === 'warning' ? 'vencimento-warning' :
      'vencimento-normal'
    );

    li.innerHTML = `
      <div class="item-row">
        <div class="item-main">
          <span class="item-title">${escapeHtml(descricao)}</span>
          <span class="item-subtitle">Vence em ${escapeHtml(vencimento)}</span>
        </div>
        <span class="item-value despesa">${escapeHtml(valor)}</span>
      </div>
    `;

    lista.appendChild(li);
  });

  if (footer) {
    footer.innerHTML = `
      <button class="btn btn-secondary btn-small" type="button" onclick="toggleVencimentos(${items.length})">
        ${limiteVencimentos >= items.length ? '− Ver menos' : '+ Ver mais'}
      </button>
    `;
  }
}

function renderExtrato(items) {
  const lista = document.getElementById('extrato');
  const footer = document.getElementById('extratoFooter');
  lista.innerHTML = '';

  if (!items.length) {
    lista.innerHTML = '<li class="empty-state">Nenhum item encontrado.</li>';
    if (footer) footer.innerHTML = '';
    return;
  }

  const visiveis = items.slice(0, limiteExtrato);

  visiveis.forEach((item) => {
    const li = document.createElement('li');
    const tipoClasse = item.tipo === 'receita' ? 'receita' : 'despesa';
    const data = item.data ? formatDate(item.data) : '';
    const venc = item.vencimento ? formatDate(item.vencimento) : '-';

    li.innerHTML = `
      <div class="item-row">
        <div class="item-main">
          <span class="item-title">${escapeHtml(item.descricao || '')}</span>
          <span class="item-subtitle">
            ${escapeHtml(item.categoria || '')} • ${escapeHtml(item.status || '')}
            ${data ? ` • ${escapeHtml(data)}` : ''}
            • venc.: ${escapeHtml(venc)}
            ${item.forma_pagamento ? ` • ${escapeHtml(item.forma_pagamento)}` : ''}
            ${item.conta_pagamento ? ` • ${escapeHtml(item.conta_pagamento)}` : ''}
          </span>
        </div>
        <span class="item-value ${tipoClasse}">
          ${item.tipo === 'receita' ? '+' : '-'} R$ ${escapeHtml(String(item.valor || '0,00'))}
        </span>
      </div>
    `;
    lista.appendChild(li);
  });

  if (footer) {
    footer.innerHTML = `
      <button class="btn btn-secondary btn-small" type="button" onclick="toggleExtrato(${items.length})">
        ${limiteExtrato >= items.length ? '− Ver menos' : '+ Ver mais'}
      </button>
    `;
  }
}

function renderFixas(items) {
  const lista = document.getElementById('fixas');
  const footer = document.getElementById('fixasFooter');
  lista.innerHTML = '';

  if (!items.length) {
    lista.innerHTML = '<li class="empty-state">Nenhuma despesa fixa cadastrada.</li>';
    if (footer) footer.innerHTML = '';
    return;
  }

  const visiveis = items.slice(0, limiteFixas);

  visiveis.forEach((fixa) => {
    const valorNum = Number(fixa.valor_padrao || 0);
    const valorTexto = Number.isNaN(valorNum) ? '0,00' : valorNum.toFixed(2).replace('.', ',');

    const obj = {
      id: fixa.id_fixa || '',
      descricao: fixa.descricao || '',
      categoria: fixa.categoria || 'Outros',
      valor_padrao: fixa.valor_padrao || 0,
      dia_vencimento: fixa.dia_vencimento || '',
      ativo: fixa.ativo || 'sim',
      observacoes: fixa.observacoes || ''
    };

    const li = document.createElement('li');
    li.innerHTML = `
      <div class="item-row">
        <div class="item-main">
          <span class="item-title">${escapeHtml(obj.descricao)}</span>
          <span class="item-subtitle">${escapeHtml(obj.categoria)} • dia ${escapeHtml(String(obj.dia_vencimento))} • ${escapeHtml(obj.ativo)}</span>
        </div>
        <div class="item-actions">
          <span class="item-value despesa">R$ ${valorTexto}</span>
          <div class="action-buttons">
            <button class="mini-btn" onclick='editarFixa(${JSON.stringify(obj)})'>Editar</button>
            <button class="mini-btn danger" onclick="excluirFixa('${escapeHtml(obj.id)}')">Excluir</button>
          </div>
        </div>
      </div>
    `;
    lista.appendChild(li);
  });

  if (footer) {
    footer.innerHTML = `
      <button class="btn btn-secondary btn-small" type="button" onclick="toggleFixas(${items.length})">
        ${limiteFixas >= items.length ? '− Ver menos' : '+ Ver mais'}
      </button>
    `;
  }
}

function renderChartCategorias(data) {
  const canvas = document.getElementById('chartCategorias');
  if (!canvas) return;

  const labels = data.map(item => item.categoria);
  const values = data.map(item => item.valor);
  const total = values.reduce((acc, val) => acc + val, 0);

  const centerTextPlugin = {
    id: 'centerTextPlugin',
    afterDraw(chart) {
      const { ctx } = chart;
      const meta = chart.getDatasetMeta(0);
      if (!meta || !meta.data || !meta.data.length) return;

      const x = meta.data[0].x;
      const y = meta.data[0].y;

      ctx.save();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#e5e7eb';
      ctx.font = '700 14px Segoe UI';
      ctx.fillText('Total', x, y - 10);
      ctx.font = '800 18px Segoe UI';
      ctx.fillText(`R$ ${total.toFixed(2).replace('.', ',')}`, x, y + 12);
      ctx.restore();
    }
  };

  if (chartCategorias) {
    chartCategorias.destroy();
  }

  chartCategorias = new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data: values,
        borderWidth: 2,
        hoverOffset: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '62%',
      plugins: {
        legend: {
          position: 'top',
          labels: {
            color: '#e5e7eb',
            boxWidth: 16,
            padding: 10
          }
        }
      }
    },
    plugins: [centerTextPlugin]
  });
}

function filtrarExtratoLocal() {
  const texto = (document.getElementById('buscaTexto').value || '').trim().toLowerCase();
  const categoria = document.getElementById('filtroCategoriaLocal').value || '';
  const status = document.getElementById('filtroStatusLocal').value || '';
  const forma = document.getElementById('filtroFormaLocal').value || '';
  const conta = document.getElementById('filtroContaLocal').value || '';

  const filtrado = extratoCache.filter(item => {
    const okTexto = !texto || String(item.descricao || '').toLowerCase().includes(texto);
    const okCategoria = !categoria || String(item.categoria || '') === categoria;
    const okStatus = !status || String(item.status || '') === status;
    const okForma = !forma || String(item.forma_pagamento || '') === forma;
    const okConta = !conta || String(item.conta_pagamento || '') === conta;
    return okTexto && okCategoria && okStatus && okForma && okConta;
  });

  limiteExtrato = LIMITE_INICIAL_EXT;
  renderExtrato(filtrado);
}

function aplicarFiltros() {
  limiteLancamentos = LIMITE_INICIAL_LANC;
  limiteVencimentos = LIMITE_INICIAL_VENC;
  limiteExtrato = LIMITE_INICIAL_EXT;
  load();
}

function limparFiltros() {
  document.getElementById('filtroMes').value = String(new Date().getMonth() + 1).padStart(2, '0');
  document.getElementById('filtroAno').value = String(new Date().getFullYear());
  document.getElementById('filtroInicio').value = '';
  document.getElementById('filtroFim').value = '';
  limiteLancamentos = LIMITE_INICIAL_LANC;
  limiteVencimentos = LIMITE_INICIAL_VENC;
  limiteExtrato = LIMITE_INICIAL_EXT;
  load();
}

function toggleLancamentos(total) {
  limiteLancamentos = limiteLancamentos >= total ? LIMITE_INICIAL_LANC : total;
  renderLancamentos(extratoCache.slice(0, 10_000));
  load();
}

function toggleVencimentos(total) {
  limiteVencimentos = limiteVencimentos >= total ? LIMITE_INICIAL_VENC : total;
  load();
}

function toggleFixas(total) {
  limiteFixas = limiteFixas >= total ? LIMITE_INICIAL_FIX : total;
  renderFixas(fixasCache);
}

function toggleExtrato(total) {
  limiteExtrato = limiteExtrato >= total ? LIMITE_INICIAL_EXT : total;
  filtrarExtratoLocal();
}

function openModal() {
  document.getElementById('modal').classList.remove('hidden');
  document.getElementById('modalTitle').textContent = 'Novo lançamento';
  document.getElementById('saveButton').textContent = 'Salvar';
  lancamentoEditandoId = null;

  const hoje = new Date().toISOString().slice(0, 10);
  document.getElementById('dataLancamento').value = hoje;
}

function closeModal() {
  document.getElementById('modal').classList.add('hidden');
}

function openFixaModal() {
  document.getElementById('fixaModal').classList.remove('hidden');
  document.getElementById('fixaModalTitle').textContent = 'Nova despesa fixa';
  document.getElementById('saveFixaButton').textContent = 'Salvar';
  fixaEditandoId = null;
}

function closeFixaModal() {
  document.getElementById('fixaModal').classList.add('hidden');
}

function limparFormulario() {
  document.getElementById('desc').value = '';
  document.getElementById('valor').value = '';
  document.getElementById('tipo').value = 'receita';
  document.getElementById('categoria').selectedIndex = 0;
  document.getElementById('status').value = 'pendente';
  document.getElementById('dataLancamento').value = '';
  document.getElementById('vencimento').value = '';
  document.getElementById('observacoes').value = '';
  document.getElementById('formaPagamento').selectedIndex = 0;
  document.getElementById('contaPagamento').selectedIndex = 0;
  lancamentoEditandoId = null;
}

function limparFormularioFixa() {
  document.getElementById('fixaDesc').value = '';
  document.getElementById('fixaCategoria').selectedIndex = 0;
  document.getElementById('fixaValor').value = '';
  document.getElementById('fixaDia').value = '';
  document.getElementById('fixaAtivo').value = 'sim';
  document.getElementById('fixaObs').value = '';
  fixaEditandoId = null;
}

function editarLancamento(item) {
  lancamentoEditandoId = item.id;
  document.getElementById('modal').classList.remove('hidden');
  document.getElementById('modalTitle').textContent = 'Editar lançamento';
  document.getElementById('saveButton').textContent = 'Atualizar';

  document.getElementById('desc').value = item.descricao || '';
  document.getElementById('valor').value = (item.valor || '0,00').replace(',', '.');
  document.getElementById('tipo').value = item.tipo || 'despesa';
  document.getElementById('dataLancamento').value = item.data || '';
  document.getElementById('vencimento').value = item.vencimento || '';
  document.getElementById('categoria').value = item.categoria || 'Outros';
  document.getElementById('status').value = item.status || 'pendente';
  document.getElementById('observacoes').value = item.observacoes || '';
  document.getElementById('formaPagamento').value = item.forma_pagamento || formasPagamentoCache[0] || '';
  document.getElementById('contaPagamento').value = item.conta_pagamento || contasPagamentoCache[0] || '';
}

function editarFixa(fixa) {
  fixaEditandoId = fixa.id;
  document.getElementById('fixaModal').classList.remove('hidden');
  document.getElementById('fixaModalTitle').textContent = 'Editar despesa fixa';
  document.getElementById('saveFixaButton').textContent = 'Atualizar';

  document.getElementById('fixaDesc').value = fixa.descricao || '';
  document.getElementById('fixaCategoria').value = fixa.categoria || 'Outros';
  document.getElementById('fixaValor').value = Number(fixa.valor_padrao || 0);
  document.getElementById('fixaDia').value = fixa.dia_vencimento || '';
  document.getElementById('fixaAtivo').value = fixa.ativo || 'sim';
  document.getElementById('fixaObs').value = fixa.observacoes || '';
}

function editarFixaPorId(idFixa) {
  const fixa = fixasCache.find(f => String(f.id_fixa) === String(idFixa));
  if (!fixa) {
    showToast('Despesa fixa não encontrada.', 'error');
    return;
  }

  editarFixa({
    id: fixa.id_fixa,
    descricao: fixa.descricao,
    categoria: fixa.categoria,
    valor_padrao: fixa.valor_padrao,
    dia_vencimento: fixa.dia_vencimento,
    ativo: fixa.ativo,
    observacoes: fixa.observacoes
  });
}

async function salvar() {
  const descricao = document.getElementById('desc').value.trim();
  const valor = document.getElementById('valor').value.trim();
  const tipo = document.getElementById('tipo').value;
  const data = document.getElementById('dataLancamento').value;
  const vencimento = document.getElementById('vencimento').value;
  const categoria = document.getElementById('categoria').value || 'Outros';
  const observacoes = document.getElementById('observacoes').value.trim();
  const formaPagamento = document.getElementById('formaPagamento').value || '';
  const contaPagamento = document.getElementById('contaPagamento').value || '';
  let status = document.getElementById('status').value;

  if (!descricao || !valor || !data) {
    showToast('Preencha descrição, valor e data.', 'error');
    return;
  }

  const valorNumero = Number(valor);
  if (Number.isNaN(valorNumero) || valorNumero <= 0) {
    showToast('Informe um valor válido maior que zero.', 'error');
    return;
  }

  if (tipo === 'receita' && status === 'pago') status = 'recebido';
  if (tipo === 'despesa' && status === 'recebido') status = 'pago';

  const payload = {
    descricao,
    valor: valorNumero,
    tipo,
    data,
    vencimento,
    categoria,
    status,
    observacoes,
    forma_pagamento: formaPagamento,
    conta_pagamento: contaPagamento
  };

  try {
    const isEdit = Boolean(lancamentoEditandoId);
    const resp = isEdit
      ? await apiPost({ action: 'updateLancamento', id: lancamentoEditandoId, ...payload })
      : await apiPost({ action: 'addLancamento', ...payload });

    if (resp?.status !== 'ok') throw new Error(resp.message || 'Falha ao salvar.');

    limparFormulario();
    closeModal();
    showToast(isEdit ? 'Lançamento atualizado.' : 'Lançamento salvo com sucesso.', 'success');
    await load();
  } catch (error) {
    console.error(error);
    showToast(`Erro ao salvar: ${error.message}`, 'error');
  }
}

async function salvarFixa() {
  const descricao = document.getElementById('fixaDesc').value.trim();
  const categoria = document.getElementById('fixaCategoria').value || 'Outros';
  const valor = document.getElementById('fixaValor').value.trim();
  const dia = document.getElementById('fixaDia').value.trim();
  const ativo = document.getElementById('fixaAtivo').value;
  const observacoes = document.getElementById('fixaObs').value.trim();

  if (!descricao || !dia) {
    showToast('Preencha descrição e dia do vencimento.', 'error');
    return;
  }

  const diaNumero = Number(dia);
  if (Number.isNaN(diaNumero) || diaNumero < 1 || diaNumero > 31) {
    showToast('Informe um dia válido entre 1 e 31.', 'error');
    return;
  }

  const payload = {
    descricao,
    categoria,
    valor_padrao: Number(valor || 0),
    dia_vencimento: diaNumero,
    ativo,
    observacoes
  };

  try {
    const isEdit = Boolean(fixaEditandoId);
    const resp = isEdit
      ? await apiPost({ action: 'updateFixa', id: fixaEditandoId, ...payload })
      : await apiPost({ action: 'addFixa', ...payload });

    if (resp?.status !== 'ok') throw new Error(resp.message || 'Falha ao salvar despesa fixa.');

    limparFormularioFixa();
    closeFixaModal();
    showToast(isEdit ? 'Despesa fixa atualizada.' : 'Despesa fixa cadastrada.', 'success');
    await carregarFixas();
    await load();
  } catch (error) {
    console.error(error);
    showToast(`Erro ao salvar fixa: ${error.message}`, 'error');
  }
}

async function atualizarStatus(id, status) {
  try {
    const resp = await apiPost({ action: 'updateStatus', id, status });
    if (resp?.status !== 'ok') throw new Error(resp.message || 'Falha ao atualizar status.');

    showToast('Status atualizado.', 'success');
    await load();
  } catch (error) {
    console.error(error);
    showToast(`Erro ao atualizar status: ${error.message}`, 'error');
  }
}

function abrirPagamentoFixa(idFixa, competencia) {
  const conta = prompt('Qual cartão/conta foi usado? Ex: Santander');
  if (conta === null) return;

  const forma = prompt('Forma de pagamento? Ex: Crédito, Débito, Pix', 'Crédito');
  if (forma === null) return;

  marcarFixaComoPaga(idFixa, competencia, forma, conta);
}

async function marcarFixaComoPaga(idFixa, competencia, formaPagamento, contaPagamento) {
  try {
    const resp = await apiPost({
      action: 'materializeFixa',
      id_fixa: idFixa,
      competencia,
      status: 'pago',
      forma_pagamento: formaPagamento || 'Crédito',
      conta_pagamento: contaPagamento || ''
    });

    if (resp?.status !== 'ok') throw new Error(resp.message || 'Falha ao lançar despesa fixa.');

    showToast('Despesa fixa marcada como paga.', 'success');
    await load();
  } catch (error) {
    console.error(error);
    showToast(`Erro ao marcar fixa: ${error.message}`, 'error');
  }
}

async function excluirLancamento(id) {
  if (!confirm('Deseja realmente excluir este lançamento?')) return;

  try {
    const resp = await apiPost({ action: 'deleteLancamento', id });
    if (resp?.status !== 'ok') throw new Error(resp.message || 'Falha ao excluir lançamento.');

    showToast('Lançamento excluído.', 'success');
    await load();
  } catch (error) {
    console.error(error);
    showToast(`Erro ao excluir: ${error.message}`, 'error');
  }
}

async function excluirFixa(id) {
  if (!confirm('Deseja realmente excluir esta despesa fixa?')) return;

  try {
    const resp = await apiPost({ action: 'deleteFixa', id });
    if (resp?.status !== 'ok') throw new Error(resp.message || 'Falha ao excluir despesa fixa.');

    showToast('Despesa fixa excluída.', 'success');
    await carregarFixas();
    await load();
  } catch (error) {
    console.error(error);
    showToast(`Erro ao excluir fixa: ${error.message}`, 'error');
  }
}

function showToast(message, type = 'success') {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.className = `toast ${type}`;
  toast.classList.remove('hidden');

  setTimeout(() => {
    toast.classList.add('hidden');
  }, 3000);
}

function formatDate(value) {
  try {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleDateString('pt-BR');
  } catch {
    return value;
  }
}

function escapeHtml(text) {
  return String(text)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

window.addEventListener('click', function (event) {
  const modal = document.getElementById('modal');
  const fixaModal = document.getElementById('fixaModal');

  if (event.target === modal) closeModal();
  if (event.target === fixaModal) closeFixaModal();
});

document.addEventListener('input', (event) => {
  if (event.target?.id === 'buscaTexto') {
    filtrarExtratoLocal();
  }
});

document.addEventListener('change', (event) => {
  const ids = ['filtroCategoriaLocal', 'filtroStatusLocal', 'filtroFormaLocal', 'filtroContaLocal'];
  if (ids.includes(event.target?.id)) {
    filtrarExtratoLocal();
  }
});

init();
