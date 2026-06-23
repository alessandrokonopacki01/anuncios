const DB_NAME = "tvLocalDB";
const STORE_NAME = "arquivos";

const formPrograma = document.getElementById("formPrograma");
const formAnuncio = document.getElementById("formAnuncio");
const listaProgramas = document.getElementById("listaProgramas");
const listaAnuncios = document.getElementById("listaAnuncios");

const programaTipo = document.getElementById("programaTipo");
const anuncioTipo = document.getElementById("anuncioTipo");

let programacao = JSON.parse(localStorage.getItem("programacaoTV")) || [];
let anuncios = JSON.parse(localStorage.getItem("anunciosTV")) || [];

programaTipo.addEventListener("change", () => alternarCampos("programa"));
anuncioTipo.addEventListener("change", () => alternarCampos("anuncio"));

function alternarCampos(prefixo) {
  const tipo = document.getElementById(prefixo + "Tipo").value;

  document.getElementById(prefixo + "CampoYoutube").style.display =
    tipo === "youtube" ? "block" : "none";

  document.getElementById(prefixo + "CampoArquivo").style.display =
    tipo === "arquivo" ? "block" : "none";
}

function abrirDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);

    request.onupgradeneeded = () => {
      const db = request.result;

      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function salvarArquivo(id, arquivo) {
  const db = await abrirDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);

    store.put({
      id,
      nome: arquivo.name,
      tipo: arquivo.type,
      blob: arquivo
    });

    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
}

async function apagarArquivo(id) {
  const db = await abrirDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).delete(id);

    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
}

formPrograma.addEventListener("submit", async (e) => {
  e.preventDefault();

  const id = Date.now();
  const tipo = document.getElementById("programaTipo").value;

  const programa = {
    id,
    nome: document.getElementById("programaNome").value,
    inicio: document.getElementById("programaInicio").value,
    fim: document.getElementById("programaFim").value,
    tipo
  };

  if (tipo === "youtube") {
    const url = document.getElementById("programaYoutube").value;
    programa.videoId = extrairIdYoutube(url);
  } else {
    const arquivo = document.getElementById("programaArquivo").files[0];

    if (!arquivo) {
      alert("Escolha um arquivo para o programa.");
      return;
    }

    programa.arquivoId = "programa_" + id;
    programa.arquivoNome = arquivo.name;
    programa.mimeType = arquivo.type;

    await salvarArquivo(programa.arquivoId, arquivo);
  }

  programacao.push(programa);
  salvarProgramacao();

  formPrograma.reset();
  alternarCampos("programa");
  renderizarProgramacao();
});

formAnuncio.addEventListener("submit", async (e) => {
  e.preventDefault();

  const id = Date.now();
  const tipo = document.getElementById("anuncioTipo").value;

  const anuncio = {
    id,
    nome: document.getElementById("anuncioNome").value,
    horario: document.getElementById("anuncioHorario").value,
    duracaoSegundos: Number(document.getElementById("anuncioDuracao").value),
    tipo
  };

  if (tipo === "youtube") {
    const url = document.getElementById("anuncioYoutube").value;
    anuncio.videoId = extrairIdYoutube(url);
  } else {
    const arquivo = document.getElementById("anuncioArquivo").files[0];

    if (!arquivo) {
      alert("Escolha um arquivo para o anúncio.");
      return;
    }

    anuncio.arquivoId = "anuncio_" + id;
    anuncio.arquivoNome = arquivo.name;
    anuncio.mimeType = arquivo.type;

    await salvarArquivo(anuncio.arquivoId, arquivo);
  }

  anuncios.push(anuncio);
  salvarAnuncios();

  formAnuncio.reset();
  alternarCampos("anuncio");
  renderizarAnuncios();
});

function salvarProgramacao() {
  programacao.sort((a, b) => converterHora(a.inicio) - converterHora(b.inicio));
  localStorage.setItem("programacaoTV", JSON.stringify(programacao));
}

function salvarAnuncios() {
  anuncios.sort((a, b) => converterHora(a.horario) - converterHora(b.horario));
  localStorage.setItem("anunciosTV", JSON.stringify(anuncios));
}

function renderizarProgramacao() {
  listaProgramas.innerHTML = "";

  if (programacao.length === 0) {
    listaProgramas.innerHTML = "<p>Nenhum programa cadastrado ainda.</p>";
    return;
  }

  programacao.forEach(programa => {
    const div = document.createElement("div");
    div.className = "card";

    div.innerHTML = `
      <h3>${programa.nome}</h3>
      <p><strong>Horário:</strong> ${programa.inicio} até ${programa.fim}</p>
      <p><strong>Tipo:</strong> ${programa.tipo}</p>
      <p><strong>Mídia:</strong> ${programa.tipo === "youtube" ? programa.videoId : programa.arquivoNome}</p>
      <button onclick="excluirPrograma(${programa.id})">Excluir programa</button>
    `;

    listaProgramas.appendChild(div);
  });
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
      <p><strong>Horário:</strong> ${anuncio.horario}</p>
      <p><strong>Duração:</strong> ${anuncio.duracaoSegundos} segundos</p>
      <p><strong>Tipo:</strong> ${anuncio.tipo}</p>
      <p><strong>Mídia:</strong> ${anuncio.tipo === "youtube" ? anuncio.videoId : anuncio.arquivoNome}</p>
      <button onclick="excluirAnuncio(${anuncio.id})">Excluir anúncio</button>
    `;

    listaAnuncios.appendChild(div);
  });
}

async function excluirPrograma(id) {
  const programa = programacao.find(item => item.id === id);

  if (programa && programa.arquivoId) {
    await apagarArquivo(programa.arquivoId);
  }

  programacao = programacao.filter(item => item.id !== id);
  salvarProgramacao();
  renderizarProgramacao();
}

async function excluirAnuncio(id) {
  const anuncio = anuncios.find(item => item.id === id);

  if (anuncio && anuncio.arquivoId) {
    await apagarArquivo(anuncio.arquivoId);
  }

  anuncios = anuncios.filter(item => item.id !== id);
  salvarAnuncios();
  renderizarAnuncios();
}

function extrairIdYoutube(url) {
  if (!url) return "";

  if (url.includes("watch?v=")) {
    return url.split("watch?v=")[1].split("&")[0];
  }

  if (url.includes("youtu.be/")) {
    return url.split("youtu.be/")[1].split("?")[0];
  }

  if (url.includes("/embed/")) {
    return url.split("/embed/")[1].split("?")[0];
  }

  return url.trim();
}

function converterHora(hora) {
  const [h, m] = hora.split(":").map(Number);
  return h * 60 + m;
}

renderizarProgramacao();
renderizarAnuncios();