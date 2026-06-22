const form = document.getElementById("formAnuncio");
const listaAnuncios = document.getElementById("listaAnuncios");

const tipo = document.getElementById("tipo");
const campoYoutube = document.getElementById("campoYoutube");
const campoArquivo = document.getElementById("campoArquivo");

let anuncios = JSON.parse(localStorage.getItem("anunciosTV")) || [];

tipo.addEventListener("change", () => {
  if (tipo.value === "youtube") {
    campoYoutube.style.display = "block";
    campoArquivo.style.display = "none";
  } else {
    campoYoutube.style.display = "none";
    campoArquivo.style.display = "block";
  }
});

form.addEventListener("submit", (e) => {
  e.preventDefault();

  const nome = document.getElementById("nome").value;
  const horario = document.getElementById("horario").value;
  const duracao = Number(document.getElementById("duracao").value);
  const tipoAnuncio = document.getElementById("tipo").value;

  let novoAnuncio = {
    id: Date.now(),
    nome,
    horario,
    duracaoSegundos: duracao,
    tipo: tipoAnuncio
  };

  if (tipoAnuncio === "youtube") {
    const youtubeUrl = document.getElementById("youtubeUrl").value;
    novoAnuncio.videoId = extrairIdYoutube(youtubeUrl);
  } else {
    const arquivo = document.getElementById("arquivo").files[0];

    if (!arquivo) {
      alert("Escolha um arquivo.");
      return;
    }

    novoAnuncio.arquivoNome = arquivo.name;

    // Para teste local, cria um link temporário do arquivo
    novoAnuncio.arquivoUrl = URL.createObjectURL(arquivo);
  }

  anuncios.push(novoAnuncio);
  salvar();
  form.reset();
  renderizarAnuncios();
});

function salvar() {
  localStorage.setItem("anunciosTV", JSON.stringify(anuncios));
}

function renderizarAnuncios() {
  listaAnuncios.innerHTML = "";

  if (anuncios.length === 0) {
    listaAnuncios.innerHTML = "<p>Nenhum anúncio cadastrado ainda.</p>";
    return;
  }

  anuncios.forEach(anuncio => {
    const div = document.createElement("div");
    div.className = "card";

    div.innerHTML = `
      <h3>${anuncio.nome}</h3>

      <label>Horário</label>
      <input 
        type="time" 
        value="${anuncio.horario}" 
        onchange="alterarHorario(${anuncio.id}, this.value)"
      >

      <label>Duração em segundos</label>
      <input 
        type="number" 
        value="${anuncio.duracaoSegundos}" 
        onchange="alterarDuracao(${anuncio.id}, this.value)"
      >

      <p><strong>Tipo:</strong> ${anuncio.tipo}</p>

      ${
        anuncio.tipo === "youtube"
          ? `<p><strong>ID YouTube:</strong> ${anuncio.videoId}</p>`
          : `<p><strong>Arquivo:</strong> ${anuncio.arquivoNome}</p>`
      }

      <button onclick="excluirAnuncio(${anuncio.id})">Excluir</button>
    `;

    listaAnuncios.appendChild(div);
  });
}

function excluirAnuncio(id) {
  anuncios = anuncios.filter(anuncio => anuncio.id !== id);
  salvar();
  renderizarAnuncios();
}

function extrairIdYoutube(url) {
  if (url.includes("watch?v=")) {
    return url.split("watch?v=")[1].split("&")[0];
  }

  if (url.includes("youtu.be/")) {
    return url.split("youtu.be/")[1].split("?")[0];
  }

  return url;
}

function alterarHorario(id, novoHorario) {
  const anuncio = anuncios.find(item => item.id === id);

  if (!anuncio) return;

  anuncio.horario = novoHorario;
  salvar();
  renderizarAnuncios();
}

function alterarDuracao(id, novaDuracao) {
  const anuncio = anuncios.find(item => item.id === id);

  if (!anuncio) return;

  anuncio.duracaoSegundos = Number(novaDuracao);
  salvar();
  renderizarAnuncios();
}

renderizarAnuncios();