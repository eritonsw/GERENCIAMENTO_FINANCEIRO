async function load() {
  try {
    const res = await fetch(API_URL);

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

    document.getElementById('saldo').innerText = 'Erro';
    document.getElementById('receitas').innerText = 'Erro';
    document.getElementById('despesas').innerText = 'Erro';

    document.getElementById('lancamentos').innerHTML =
      '<li class="empty-state">Erro ao carregar lançamentos.</li>';

    document.getElementById('vencimentos').innerHTML =
      '<li class="empty-state">Erro ao carregar vencimentos.</li>';
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
    const tipoClasse = tipo === 'receita' ? 'receita' : 'despesa';
    const tipoTexto = tipo === 'receita' ? 'Receita' : 'Despesa';

    li.innerHTML = `
      <div class="item-row">
        <div class="item-main">
          <span class="item-title">${escapeHtml(descricao)}</span>
          <span class="item-subtitle">${tipoTexto}${data ? ` • ${escapeHtml(data)}` : ''}</span>
        </div>
        <span class="item-value ${tipoClasse}">
          ${tipo === 'receita' ? '+' : '-'} R$ ${escapeHtml(String(valor))}
        </span>
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

function openModal() {
  document.getElementById('modal').classList.remove('hidden');
}

function closeModal() {
  document.getElementById('modal').classList.add('hidden');
}

function limparFormulario() {
  document.getElementById('desc').value = '';
  document.getElementById('valor').value = '';
  document.getElementById('tipo').value = 'receita';
}

async function salvar() {
  const descricao = document.getElementById('desc').value.trim();
  const valor = document.getElementById('valor').value.trim();
  const tipo = document.getElementById('tipo').value;

  if (!descricao || !valor) {
    alert('Preencha descrição e valor.');
    return;
  }

  const valorNumero = Number(valor);

  if (Number.isNaN(valorNumero) || valorNumero <= 0) {
    alert('Informe um valor válido maior que zero.');
    return;
  }

  const payload = {
    action: 'addLancamento',
    descricao,
    valor: valorNumero,
    tipo
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

    const data = await res.json();

    if (data?.status && data.status !== 'ok') {
      throw new Error(data.message || 'Falha ao salvar lançamento.');
    }

    limparFormulario();
    closeModal();
    await load();
  } catch (error) {
    console.error('Erro ao salvar lançamento:', error);
    alert(`Erro ao salvar lançamento: ${error.message}`);
  }
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
