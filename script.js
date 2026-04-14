let categoriasCache = [];
let fixasCache = [];
let extratoCache = [];
let lancamentoEditandoId = null;
let fixaEditandoId = null;
let chartCategorias = null;

async function apiGet(params = {}) {
  const url = new URL(API_URL);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
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
    preencherFiltroMes();
    await carregarCategorias();
    await carregarFixas();
    preencherFiltroCategoriaLocal();
    await load();
  } catch (error) {
    console.error(error);
    showToast(`Erro ao iniciar: ${error.message}`, 'error');
  }
}

async function load() {
  try {
    const data = await apiGet({
      action: 'dashboard',
      mes: document.getElementById('filtroMes')?.value || '',
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

    renderLancamentos(Array.isArray(data?.lancamentos) ? data.lancamentos : []);
    renderVencimentos(Array.isArray(data?.vencimentos) ? data.vencimentos : []);
    extratoCache = Array.isArray(data?.extrato) ? data.extrato : [];
    renderExtrato(extratoCache);
    renderChartCategorias(Array.isArray(data?.chartCategorias) ? data.chartCategorias : []);
  } catch (error) {
    console.error(error);
    showToast(`Erro ao carregar dados: ${error.message}`, 'error');
  }
}

async function carregarCategorias() {
  const data = await apiGet({ action: 'categorias' });

  if (data?.status === 'erro') {
    throw new Error(data.message || 'Erro ao carregar categorias.');
  }

  categoriasCache = Array.isArray(data?.categorias) ? data.categorias : [];
  preencherSelectCategorias('categoria', true);
  preencherSelectCategorias('fixaCategoria', false);
}

async function carregarFixas() {
  const data = await apiGet({ action: 'fixas' });

  if (data?.status === 'erro') {
    throw new Error(data.message || 'Erro ao carregar fixas.');
  }

  fixasCache = Array.isArray(data?.fixas) ? data.fixas : [];
  renderFixas(fixasCache);
}
function preencherFiltroCategoriaLocal() {
  const select = document.getElementById('filtroCategoriaLocal');
  if (!select) return;

  select.innerHTML = '';

  const optTodos = document.createElement('option');
  optTodos.value = '';
  optTodos.textContent = 'Todas';
  select.appendChild(optTodos);

  categoriasCache.forEach(cat => {
    const option = document.createElement('option');
    option.value = cat;
    option.textContent = cat;
    select.appendChild(option);
  });
}
function preencherFiltroMes() {
  const select = document.getElementById('filtroMes');
  if (!select) return;

  select.innerHTML = '';

  const optTodos = document.createElement('option');
  optTodos.value = '';
  optTodos.textContent = 'Todos';
  select.appendChild(optTodos);

  const hoje = new Date();

  for (let i = 0; i < 12; i++) {
    const data = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
    const ano = data.getFullYear();
    const mes = String(data.getMonth() + 1).padStart(2, '0');
    const valor = `${ano}-${mes}`;

    const nomeMes = data.toLocaleDateString('pt-BR', {
      month: 'long',
      year: 'numeric'
    });

    const option = document.createElement('option');
    option.value = valor;
    option.textContent = nomeMes.charAt(0).toUpperCase() + nomeMes.slice(1);
    select.appendChild(option);
  }

  const atual = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;
  select.value = atual;
}

function preencherSelectCategorias(id, addAllOption = false) {
  const select = document.getElementById(id);
  if (!select) return;

  select.innerHTML = '';

  if (addAllOption) {
    const option = document.createElement('option');
    option.value = '';
    option.textContent = 'Todas';
    select.appendChild(option);
  }

  categoriasCache.forEach(cat => {
    const option = document.createElement('option');
    option.value = cat;
    option.textContent = cat;
    select.appendChild(option);
  });

  if (id === 'categoria' && !addAllOption && categoriasCache.length) {
    select.value = categoriasCache[0];
  }
}

function renderLancamentos(lancamentos) {
  const lista = document.getElementById('lancamentos');
  lista.innerHTML = '';

  if (!lancamentos.length) {
    lista.innerHTML = '<li class="empty-state">Nenhum lançamento encontrado.</li>';
    return;
  }

  lancamentos.forEach((item) => {
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
      buttons += `<button class="mini-btn success" onclick="marcarFixaComoPaga('${escapeHtml(item.origem_fixa)}','${escapeHtml(item.competencia)}')">Marcar pago</button>`;
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
          <span class="item-subtitle">${tipoTexto}${data ? ` • ${escapeHtml(data)}` : ''} • ${escapeHtml(status)}</span>
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
}

function renderExtrato(items) {
  const lista = document.getElementById('extrato');
  lista.innerHTML = '';

  if (!items.length) {
    lista.innerHTML = '<li class="empty-state">Nenhum item encontrado.</li>';
    return;
  }

  items.forEach((item) => {
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
          </span>
        </div>
        <span class="item-value ${tipoClasse}">
          ${item.tipo === 'receita' ? '+' : '-'} R$ ${escapeHtml(String(item.valor || '0,00'))}
        </span>
      </div>
    `;
    lista.appendChild(li);
  });
}

function filtrarExtratoLocal() {
  const texto = (document.getElementById('buscaTexto').value || '').trim().toLowerCase();
  const categoria = document.getElementById('filtroCategoriaLocal').value || '';
  const status = document.getElementById('filtroStatusLocal').value || '';

  const filtrado = extratoCache.filter(item => {
    const okTexto = !texto || String(item.descricao || '').toLowerCase().includes(texto);
    const okCategoria = !categoria || String(item.categoria || '') === categoria;
    const okStatus = !status || String(item.status || '') === status;
    return okTexto && okCategoria && okStatus;
  });

  renderExtrato(filtrado);
}

function renderVencimentos(vencimentos) {
  const lista = document.getElementById('vencimentos');
  lista.innerHTML = '';

  if (!vencimentos.length) {
    lista.innerHTML = '<li class="empty-state">Nenhum vencimento próximo.</li>';
    return;
  }

  vencimentos.forEach((item) => {
    const li = document.createElement('li');

    const descricao = item?.descricao ?? 'Conta';
    const vencimento = item?.vencimento ?? 'Sem data';
    const valor = item?.valor ? `R$ ${item.valor}` : 'Valor não informado';
    const nivel = item?.nivel ?? 'normal';

    li.classList.add(
      nivel === 'danger'
        ? 'vencimento-danger'
        : nivel === 'warning'
        ? 'vencimento-warning'
        : 'vencimento-normal'
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
}

function renderFixas(fixas) {
  const lista = document.getElementById('fixas');
  lista.innerHTML = '';

  if (!fixas.length) {
    lista.innerHTML = '<li class="empty-state">Nenhuma despesa fixa cadastrada.</li>';
    return;
  }

  fixas.forEach((fixa) => {
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
}

function renderChartCategorias(data) {
  const ctx = document.getElementById('chartCategorias');
  if (!ctx) return;

  const labels = data.map(item => item.categoria);
  const values = data.map(item => item.valor);

  if (chartCategorias) {
    chartCategorias.destroy();
  }

  chartCategorias = new Chart(ctx, {
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
      cutout: '55%',
      plugins: {
        legend: {
          position: 'top',
          labels: {
            color: '#e5e7eb',
            boxWidth: 18,
            padding: 12
          }
        }
      }
    }
  });
}

function aplicarFiltros() {
  load();
}

function limparFiltros() {
  document.getElementById('filtroMes').value = '';
  document.getElementById('filtroInicio').value = '';
  document.getElementById('filtroFim').value = '';
  load();
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
  if (document.getElementById('categoria').options.length) {
    document.getElementById('categoria').selectedIndex = 0;
  }
  document.getElementById('status').value = 'pendente';
  document.getElementById('dataLancamento').value = '';
  document.getElementById('vencimento').value = '';
  document.getElementById('observacoes').value = '';
  lancamentoEditandoId = null;
}

function limparFormularioFixa() {
  document.getElementById('fixaDesc').value = '';
  if (document.getElementById('fixaCategoria').options.length) {
    document.getElementById('fixaCategoria').selectedIndex = 0;
  }
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
    observacoes
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

async function marcarFixaComoPaga(idFixa, competencia) {
  try {
    const resp = await apiPost({
      action: 'materializeFixa',
      id_fixa: idFixa,
      competencia,
      status: 'pago'
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

document.getElementById('buscaTexto')?.addEventListener('input', filtrarExtratoLocal);
document.getElementById('filtroCategoriaLocal')?.addEventListener('change', filtrarExtratoLocal);
document.getElementById('filtroStatusLocal')?.addEventListener('change', filtrarExtratoLocal);

init();
