async function load() {
  try {
    const res = await fetch(API_URL, {
      method: 'GET'
    });

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
      '<li>Erro ao carregar lançamentos.</li>';

    document.getElementById('vencimentos').innerHTML =
      '<li>Erro ao carregar vencimentos.</li>';

    alert('Erro ao carregar dados do sistema.');
  }
}

function renderLancamentos(lancamentos) {
  const lista = document.getElementById('lancamentos');
  lista.innerHTML = '';

  if (!lancamentos.length) {
    lista.innerHTML = '<li>Nenhum lançamento encontrado.</li>';
    return;
  }

  lancamentos.forEach((lancamento) => {
    const li = document.createElement('li');
    const descricao = lancamento?.descricao ?? 'Sem descrição';
    const valor = lancamento?.valor ?? 0;
    const tipo = lancamento?.tipo ?? '';
    const data = lancamento?.data ? ` | ${formatDate(lancamento.data)}` : '';

    li.innerText = `${descricao} - R$ ${valor}${tipo ? ` (${tipo})` : ''}${data}`;
    lista.appendChild(li);
  });
}

function renderVencimentos(vencimentos) {
  const lista = document.getElementById('vencimentos');
  lista.innerHTML = '';

  if (!vencimentos.length) {
    lista.innerHTML = '<li>Nenhum vencimento próximo.</li>';
    return;
  }

  vencimentos.forEach((item) => {
    const li = document.createElement('li');
    const descricao = item?.descricao ?? 'Conta';
    const vencimento = item?.vencimento ?? 'Sem data';
    const valor = item?.valor ? ` - R$ ${item.valor}` : '';

    li.innerText = `${descricao} - vence em ${vencimento}${valor}`;
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
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      throw new Error(`Erro HTTP ${res.status}`);
    }

    const data = await res.json();
    console.log('Resposta do servidor:', data);

    limparFormulario();
    closeModal();
    await load();
  } catch (error) {
    console.error('Erro ao salvar lançamento:', error);
    alert('Erro ao salvar lançamento.');
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

load();
