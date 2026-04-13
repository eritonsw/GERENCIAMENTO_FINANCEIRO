async function load() {
  try {
    const url = new URL(API_URL);
    const mes = document.getElementById('filtroMes')?.value || '';
    const dataInicio = document.getElementById('filtroInicio')?.value || '';
    const dataFim = document.getElementById('filtroFim')?.value || '';

    if (mes) url.searchParams.set('mes', mes);
    if (dataInicio) url.searchParams.set('dataInicio', dataInicio);
    if (dataFim) url.searchParams.set('dataFim', dataFim);

    const res = await fetch(url.toString());

    if (!res.ok) {
      throw new Error(`Erro HTTP ${res.status}`);
    }

    const data = await res.json();

    document.getElementById('saldo').innerText = data?.saldo ?? 'R$ 0,00';
    document.getElementById('receitas').innerText = data?.receitas ?? 'R$ 0,00';
    document.getElementById('despesas').innerText = data?.despesas ?? 'R$ 0,00';

    renderLancamentos(Array.isArray(data?.lancamentos) ? data.lancamentos : []);
    renderVencimentos(Array.isArray(data?.vencimentos) ? data.vencimentos : []);
  } catch (error) {
    console.error('Erro ao carregar dados:', error);
    showToast('Erro ao carregar dados.', 'error');
  }
}

function renderLancamentos(lancamentos) {
  const lista = document.getElementById('lancamentos');
  lista.innerHTML = '';

  if (!lancamentos.length) {
    lista.innerHTML = '<li class="empty-state">Nenhum lançamento encontrado.</li>';
    return;
  }

  lancamentos.forEach((lancamento) => {
    const li = document.createElement('li');

    const tipo = lancamento?.tipo ?? '';
    const descricao = lancamento?.descricao ?? 'Sem descrição';
    const valor = lancamento?.valor ?? '0,00';
    const data = lancamento?.data ? formatDate(lancamento.data) : '';
    const status = lancamento?.status ?? '';
    const tipoClasse = tipo === 'receita' ? 'receita' : 'despesa';
    const tipoTexto = tipo === 'receita' ? 'Receita' : 'Despesa';

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
          ${tipo === 'despesa' && status !== 'pago'
            ? `<button class="mini-btn" onclick="atualizarStatus('${escapeHtml(lancamento.id)}','pago')">Marcar pago</button>`
            : ''}
          ${tipo === 'receita' && status !== 'recebido'
            ? `<button class="mini-btn" onclick="atualizarStatus('${escapeHtml(lancamento.id)}','recebido')">Marcar recebido</button>`
            : ''}
        </div>
      </div>
    `;

    lista.appendChild(li);
  });
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
  const hoje = new Date().toISOString().slice(0, 10);
  document.getElementById('dataLancamento').value = hoje;
}

function closeModal() {
  document.getElementById('modal').classList.add('hidden');
}

function limparFormulario() {
  document.getElementById('desc').value = '';
  document.getElementById('valor').value = '';
  document.getElementById('tipo').value = 'receita';
  document.getElementById('categoria').value = '';
  document.getElementById('status').value = 'pendente';
  document.getElementById('dataLancamento').value = '';
  document.getElementById('vencimento').value = '';
}

async function salvar() {
  const descricao = document.getElementById('desc').value.trim();
  const valor = document.getElementById('valor').value.trim();
  const tipo = document.getElementById('tipo').value;
  const data = document.getElementById('dataLancamento').value;
  const vencimento = document.getElementById('vencimento').value;
  const categoria = document.getElementById('categoria').value.trim() || 'Outros';
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
    action: 'addLancamento',
    descricao,
    valor: valorNumero,
    tipo,
    data,
    vencimento,
    categoria,
    status
  };

  try {
    const formData = new URLSearchParams();
    formData.append('payload', JSON.stringify(payload));

    const res = await fetch(API_URL, {
      method: 'POST',
      body: formData
    });

    if (!res.ok) {
      throw new Error(`Erro HTTP ${res.status}`);
    }

    const dataResp = await res.json();

    if (dataResp?.status !== 'ok') {
      throw new Error(dataResp.message || 'Falha ao salvar.');
    }

    limparFormulario();
    closeModal();
    showToast('Lançamento salvo com sucesso.', 'success');
    await load();
  } catch (error) {
    console.error('Erro ao salvar:', error);
    showToast(`Erro ao salvar: ${error.message}`, 'error');
  }
}

async function atualizarStatus(id, status) {
  try {
    const payload = {
      action: 'updateStatus',
      id,
      status
    };

    const formData = new URLSearchParams();
    formData.append('payload', JSON.stringify(payload));

    const res = await fetch(API_URL, {
      method: 'POST',
      body: formData
    });

    if (!res.ok) {
      throw new Error(`Erro HTTP ${res.status}`);
    }

    const data = await res.json();

    if (data?.status !== 'ok') {
      throw new Error(data.message || 'Falha ao atualizar status.');
    }

    showToast('Status atualizado.', 'success');
    await load();
  } catch (error) {
    console.error(error);
    showToast(`Erro ao atualizar status: ${error.message}`, 'error');
  }
}

function showToast(message, type = 'success') {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.className = `toast ${type}`;
  toast.classList.remove('hidden');

  setTimeout(() => {
    toast.classList.add('hidden');
  }, 2500);
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
  if (event.target === modal) {
    closeModal();
  }
});

load();
