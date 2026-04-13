async function load() {
  const res = await fetch(API_URL);
  const data = await res.json();

  document.getElementById('saldo').innerText = data.saldo;
  document.getElementById('receitas').innerText = data.receitas;
  document.getElementById('despesas').innerText = data.despesas;

  const lista = document.getElementById('lancamentos');
  lista.innerHTML = '';

  data.lancamentos.forEach(l => {
    const li = document.createElement('li');
    li.innerText = `${l.descricao} - R$ ${l.valor}`;
    lista.appendChild(li);
  });
}

function openModal() {
  document.getElementById('modal').classList.remove('hidden');
}

function closeModal() {
  document.getElementById('modal').classList.add('hidden');
}

async function salvar() {
  const payload = {
    action: 'addLancamento',
    descricao: document.getElementById('desc').value,
    valor: document.getElementById('valor').value,
    tipo: document.getElementById('tipo').value
  };

  await fetch(API_URL, {
    method: 'POST',
    body: JSON.stringify(payload)
  });

  closeModal();
  load();
}

load();