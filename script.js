const DB_NAME = "tvLocalDB";
const STORE_NAME = "arquivos";

/* =========================================================
   ESTADO DO SISTEMA
========================================================= */

let player = null;
let youtubePronto = false;
let tvIniciada = false;
let intervaloSistema = null;

let tocandoAnuncio = false;
let timeoutAnuncio = null;

let midiaAtualId = null;
let midiaProgramaAtual = null;
let tempoPausadoPrograma = 0;

let loadingInterval = null;
let urlArquivoAtual = null;

let anunciosTocadosHoje =
  JSON.parse(sessionStorage.getItem("anunciosTocadosHoje")) || [];

let dataControle =
  sessionStorage.getItem("dataControle") ||
  new Date().toDateString();

/* =========================================================
   ELEMENTOS DA PÁGINA
========================================================= */

const youtubeContainer = document.getElementById("youtubeContainer");
const videoLocal = document.getElementById("videoLocal");
const imagemLocal = document.getElementById("imagemLocal");

const loadingBox = document.getElementById("loadingBox");
const progressoLoading = document.getElementById("progressoLoading");
const loadingTexto = document.getElementById("loadingTexto");

const statusTexto = document.getElementById("status");
const proximoTexto = document.getElementById("proximo");

/* =========================================================
   STATUS NA TELA
========================================================= */

function atualizarStatus(texto) {
  console.log(texto);

  if (statusTexto) {
    statusTexto.innerText = texto;
  }
}

function atualizarProximo(texto = "") {
  if (proximoTexto) {
    proximoTexto.innerText = texto;
  }
}

/* =========================================================
   BARRA DE CARREGAMENTO
========================================================= */

function mostrarLoading(texto = "Carregando...") {
  if (!loadingBox || !progressoLoading || !loadingTexto) {
    console.log(texto);
    return;
  }

  clearInterval(loadingInterval);

  loadingTexto.innerText = texto;
  loadingBox.style.display = "block";
  progressoLoading.style.width = "0%";

  let progresso = 0;

  loadingInterval = setInterval(() => {
    progresso += 4;

    if (progresso > 90) {
      progresso = 90;
    }

    progressoLoading.style.width = `${progresso}%`;
  }, 250);
}

function esconderLoading() {
  clearInterval(loadingInterval);

  if (!loadingBox || !progressoLoading) {
    return;
  }

  progressoLoading.style.width = "100%";

  setTimeout(() => {
    loadingBox.style.display = "none";
    progressoLoading.style.width = "0%";
  }, 300);
}

/* =========================================================
   YOUTUBE
========================================================= */

function onYouTubeIframeAPIReady() {
  player = new YT.Player("youtubePlayer", {
    width: "100%",
    height: "100%",

    playerVars: {
      autoplay: 1,
      controls: 1,
      rel: 0,
      enablejsapi: 1,
      origin: window.location.origin
    },

    events: {
      onReady: () => {
        youtubePronto = true;

        console.log("YouTube pronto.");

        atualizarStatus("Player do YouTube pronto.");
        esconderLoading();
      },

      onStateChange: evento => {
        console.log("Estado YouTube:", evento.data);

        if (evento.data === YT.PlayerState.PLAYING) {
          esconderLoading();
          atualizarStatus(nomeMidiaAtual());
        }

        if (evento.data === YT.PlayerState.BUFFERING) {
          mostrarLoading("Carregando vídeo do YouTube...");
          atualizarStatus("Carregando vídeo...");
        }

        if (evento.data === YT.PlayerState.PAUSED) {
          atualizarStatus("Vídeo pausado.");
        }

        if (evento.data === YT.PlayerState.ENDED) {
          esconderLoading();
          atualizarStatus("Vídeo finalizado.");
        }
      },

      onError: evento => {
        tratarErroYouTube(evento.data);
      }
    }
  });
}

function tratarErroYouTube(codigo) {
  console.error("Erro YouTube:", codigo);

  let mensagem = `Erro ao carregar o vídeo. Código: ${codigo}`;

  if (codigo === 2) {
    mensagem = "ID do vídeo do YouTube inválido.";
  }

  if (codigo === 5) {
    mensagem = "O vídeo não pôde ser reproduzido no player HTML5.";
  }

  if (codigo === 100) {
    mensagem = "Vídeo removido, privado ou não encontrado.";
  }

  if (codigo === 101 || codigo === 150) {
    mensagem =
      "Este vídeo não permite reprodução fora do YouTube.";
  }

  atualizarStatus(mensagem);
  mostrarLoading(mensagem);
}

/* =========================================================
   INÍCIO DO SISTEMA
========================================================= */

function iniciarSistema() {
  if (tvIniciada) {
    return;
  }

  tvIniciada = true;

  atualizarStatus("Carregando programação...");
  atualizarSistema();

  intervaloSistema = setInterval(() => {
    atualizarSistema();
  }, 1000);
}

async function atualizarSistema() {
  limparControleDiario();

  try {
    if (!tocandoAnuncio) {
      await atualizarProgramacao();
      await verificarAnuncios();
    }

    mostrarProximoAnuncio();
  } catch (erro) {
    console.error("Erro ao atualizar sistema:", erro);
    atualizarStatus("Erro ao atualizar a programação.");
  }
}

/* =========================================================
   LOCAL STORAGE
========================================================= */

function pegarProgramacao() {
  try {
    return JSON.parse(localStorage.getItem("programacaoTV")) || [];
  } catch (erro) {
    console.error("Erro ao ler programação:", erro);
    return [];
  }
}

function pegarAnuncios() {
  try {
    return JSON.parse(localStorage.getItem("anunciosTV")) || [];
  } catch (erro) {
    console.error("Erro ao ler anúncios:", erro);
    return [];
  }
}

/* =========================================================
   PROGRAMAÇÃO
========================================================= */

async function atualizarProgramacao() {
  const programacao = pegarProgramacao();
  const minutosAgora = minutosAtuais();

  const programaAtual = programacao.find(programa => {
    if (!programa.inicio || !programa.fim) {
      return false;
    }

    const inicio = converterHora(programa.inicio);
    const fim = converterHora(programa.fim);

    // Programação no mesmo dia
    if (inicio < fim) {
      return minutosAgora >= inicio && minutosAgora < fim;
    }

    // Programação que atravessa a meia-noite
    if (inicio > fim) {
      return minutosAgora >= inicio || minutosAgora < fim;
    }

    // Mesmo horário de início e fim = 24 horas
    return true;
  });

  if (!programaAtual) {
    midiaAtualId = null;
    midiaProgramaAtual = null;

    pararTudo(true);
    atualizarStatus("Nenhum programa neste horário.");

    return;
  }

  const idAtual = criarIdMidia(programaAtual);

  if (midiaAtualId === idAtual) {
    return;
  }

  midiaProgramaAtual = programaAtual;
  midiaAtualId = idAtual;
  tempoPausadoPrograma = 0;

  atualizarStatus(
    `No ar: ${programaAtual.nome || "Programação atual"}`
  );

  await tocarMidia(programaAtual);
}

/* =========================================================
   ANÚNCIOS
========================================================= */

async function verificarAnuncios() {
  const anuncios = pegarAnuncios();
  const agora = formatarHora(new Date());

  const anuncio = anuncios.find(item => {
    return (
      item.horario === agora &&
      !anunciosTocadosHoje.includes(item.id)
    );
  });

  if (anuncio) {
    await tocarAnuncio(anuncio);
  }
}

async function tocarAnuncio(anuncio) {
  if (!anuncio || tocandoAnuncio) {
    return;
  }

  tocandoAnuncio = true;

  anunciosTocadosHoje.push(anuncio.id);

  sessionStorage.setItem(
    "anunciosTocadosHoje",
    JSON.stringify(anunciosTocadosHoje)
  );

  tempoPausadoPrograma = obterTempoAtualPrograma();

  atualizarStatus(
    `Exibindo anúncio: ${anuncio.nome || "Anúncio"}`
  );

  await tocarMidia(anuncio);

  const duracao =
    Number(anuncio.duracaoSegundos) > 0
      ? Number(anuncio.duracaoSegundos)
      : 10;

  clearTimeout(timeoutAnuncio);

  timeoutAnuncio = setTimeout(async () => {
    tocandoAnuncio = false;

    atualizarStatus("Voltando para a programação...");

    if (midiaProgramaAtual) {
      await tocarMidia(
        midiaProgramaAtual,
        tempoPausadoPrograma
      );
    } else {
      await atualizarProgramacao();
    }
  }, duracao * 1000);
}

function obterTempoAtualPrograma() {
  try {
    if (
      midiaProgramaAtual &&
      midiaProgramaAtual.tipo === "youtube" &&
      player &&
      typeof player.getCurrentTime === "function"
    ) {
      return player.getCurrentTime() || 0;
    }

    if (
      midiaProgramaAtual &&
      midiaProgramaAtual.tipo === "arquivo" &&
      videoLocal
    ) {
      return videoLocal.currentTime || 0;
    }
  } catch (erro) {
    console.warn(
      "Não foi possível obter o tempo atual:",
      erro
    );
  }

  return 0;
}

/* =========================================================
   REPRODUÇÃO DE MÍDIA
========================================================= */

async function tocarMidia(item, startSeconds = 0) {
  if (!item) {
    console.warn("Nenhuma mídia recebida.");
    atualizarStatus("Nenhuma mídia encontrada.");
    pararTudo(true);
    return;
  }

  if (item.tipo === "youtube") {
    await tocarYoutube(item, startSeconds);
    return;
  }

  if (item.arquivoId) {
    await tocarArquivoLocal(item, startSeconds);
    return;
  }

  console.warn("Tipo de mídia desconhecido:", item.tipo);
  atualizarStatus("Tipo de mídia não reconhecido.");
}

async function tocarYoutube(item, startSeconds = 0) {
  mostrarYoutube();
  mostrarLoading("Carregando vídeo do YouTube...");

  if (!item.videoId) {
    atualizarStatus("Vídeo do YouTube sem ID.");
    mostrarLoading("Erro: vídeo do YouTube sem ID.");
    return;
  }

  if (!youtubePronto || !player) {
    atualizarStatus("Aguardando o player do YouTube...");

    setTimeout(() => {
      if (youtubePronto && player) {
        tocarYoutube(item, startSeconds);
      }
    }, 500);

    return;
  }

  if (videoLocal) {
    videoLocal.pause();
  }

  try {
    player.loadVideoById({
      videoId: extrairVideoId(item.videoId),
      startSeconds: Number(startSeconds) || 0
    });

    player.playVideo();
  } catch (erro) {
    console.error("Erro ao carregar YouTube:", erro);

    atualizarStatus(
      "Erro ao enviar o vídeo para o YouTube."
    );

    mostrarLoading(
      "Erro ao carregar o vídeo do YouTube."
    );
  }
}

async function tocarArquivoLocal(item, startSeconds = 0) {
  mostrarLoading("Carregando arquivo local...");

  if (!item.arquivoId) {
    atualizarStatus("Arquivo sem identificação.");
    mostrarLoading("Erro: arquivo sem identificação.");
    return;
  }

  pararYoutube();

  let arquivo;

  try {
    arquivo = await buscarArquivo(item.arquivoId);
  } catch (erro) {
    console.error("Erro ao buscar arquivo:", erro);

    atualizarStatus("Erro ao acessar o arquivo local.");
    mostrarLoading("Erro ao acessar o arquivo local.");

    return;
  }

  if (!arquivo || !arquivo.blob) {
    console.warn(
      "Arquivo não encontrado no IndexedDB:",
      item
    );

    atualizarStatus("Arquivo local não encontrado.");
    mostrarLoading("Arquivo local não encontrado.");

    return;
  }

  liberarUrlArquivoAnterior();

  urlArquivoAtual = URL.createObjectURL(arquivo.blob);

  const tipoArquivo =
    arquivo.tipo ||
    arquivo.blob.type ||
    "";

  if (tipoArquivo.startsWith("image/")) {
    tocarImagemLocal(urlArquivoAtual, item);
    return;
  }

  tocarVideoLocal(
    urlArquivoAtual,
    startSeconds,
    item
  );
}

function tocarImagemLocal(url, item) {
  imagemLocal.onload = () => {
    esconderLoading();

    atualizarStatus(
      `No ar: ${item.nome || "Imagem"}`
    );
  };

  imagemLocal.onerror = () => {
    atualizarStatus("Erro ao carregar a imagem.");
    mostrarLoading("Erro ao carregar a imagem.");
  };

  imagemLocal.src = url;

  mostrarImagem();
}

function tocarVideoLocal(url, startSeconds, item) {
  videoLocal.src = url;
  videoLocal.currentTime = Number(startSeconds) || 0;

  videoLocal.muted = false;
  videoLocal.volume = 1;

  videoLocal.onplaying = () => {
    esconderLoading();

    atualizarStatus(
      `No ar: ${item.nome || "Vídeo local"}`
    );
  };

  videoLocal.onwaiting = () => {
    mostrarLoading("Carregando vídeo local...");
    atualizarStatus("Carregando vídeo local...");
  };

  videoLocal.onerror = () => {
    atualizarStatus("Erro ao carregar vídeo local.");
    mostrarLoading("Erro ao carregar vídeo local.");
  };

  mostrarVideo();

  videoLocal.play().catch(erro => {
    console.warn("Autoplay bloqueado:", erro);

    atualizarStatus(
      "Clique na tela para iniciar o vídeo."
    );

    mostrarLoading(
      "Clique na tela para iniciar o vídeo."
    );
  });
}

/* =========================================================
   TELAS DE MÍDIA
========================================================= */

function mostrarYoutube() {
  if (youtubeContainer) {
    youtubeContainer.style.display = "block";
  }

  if (videoLocal) {
    videoLocal.style.display = "none";
    videoLocal.pause();
  }

  if (imagemLocal) {
    imagemLocal.style.display = "none";
  }
}

function mostrarImagem() {
  if (youtubeContainer) {
    youtubeContainer.style.display = "none";
  }

  if (videoLocal) {
    videoLocal.style.display = "none";
  }

  if (imagemLocal) {
    imagemLocal.style.display = "block";
  }
}

function mostrarImagem() {
  if (youtubeContainer) {
    youtubeContainer.style.display = "none";
  }

  if (videoLocal) {
    videoLocal.style.display = "none";
  }

  if (imagemLocal) {
    imagemLocal.style.display = "block";
  }
}

function mostrarYoutube() {
  const youtubeContainer =
    document.getElementById("youtubeContainer");

  if (youtubeContainer) {
    youtubeContainer.style.display = "block";
  }

  if (videoLocal) {
    videoLocal.style.display = "none";
    videoLocal.pause();
  }

  if (imagemLocal) {
    imagemLocal.style.display = "none";
  }
}

function mostrarVideo() {
  const youtubeContainer =
    document.getElementById("youtubeContainer");

  if (youtubeContainer) {
    youtubeContainer.style.display = "none";
  }

  if (videoLocal) {
    videoLocal.style.display = "block";
  }

  if (imagemLocal) {
    imagemLocal.style.display = "none";
  }
}

function mostrarImagem() {
  const youtubeContainer =
    document.getElementById("youtubeContainer");

  if (youtubeContainer) {
    youtubeContainer.style.display = "none";
  }

  if (videoLocal) {
    videoLocal.style.display = "none";
  }

  if (imagemLocal) {
    imagemLocal.style.display = "block";
  }
}

function pararYoutube() {
  try {
    if (
      player &&
      typeof player.stopVideo === "function"
    ) {
      player.stopVideo();
    }
  } catch (erro) {
    console.warn("YouTube não pôde ser parado:", erro);
  }
}

function pararTudo(limparTela = true) {
  esconderLoading();
  pararYoutube();

  if (videoLocal) {
    videoLocal.pause();
  }

  if (limparTela) {
    const youtubeContainer =
      document.getElementById("youtubeContainer");

    if (youtubeContainer) {
      youtubeContainer.style.display = "none";
    }

    if (videoLocal) {
      videoLocal.style.display = "none";
    }

    if (imagemLocal) {
      imagemLocal.style.display = "none";
    }
  }
}

function liberarUrlArquivoAnterior() {
  if (urlArquivoAtual) {
    URL.revokeObjectURL(urlArquivoAtual);
    urlArquivoAtual = null;
  }
}

/* =========================================================
   INDEXED DB
========================================================= */

function abrirDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);

    request.onupgradeneeded = () => {
      const db = request.result;

      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, {
          keyPath: "id"
        });
      }
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}

async function buscarArquivo(id) {
  const db = await abrirDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(
      STORE_NAME,
      "readonly"
    );

    const store =
      transaction.objectStore(STORE_NAME);

    const request = store.get(id);

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      reject(request.error);
    };

    transaction.oncomplete = () => {
      db.close();
    };
  });
}

/* =========================================================
   PRÓXIMO ANÚNCIO
========================================================= */

function mostrarProximoAnuncio() {
  const anuncios = pegarAnuncios();
  const agora = minutosAtuais();

  const proximos = anuncios
    .filter(anuncio => {
      if (!anuncio.horario) {
        return false;
      }

      return (
        converterHora(anuncio.horario) >= agora &&
        !anunciosTocadosHoje.includes(anuncio.id)
      );
    })
    .sort((a, b) => {
      return (
        converterHora(a.horario) -
        converterHora(b.horario)
      );
    });

  if (proximos.length === 0) {
    atualizarProximo("");
    return;
  }

  const proximo = proximos[0];

  atualizarProximo(
    `Próximo anúncio: ${proximo.nome || "Anúncio"
    } às ${proximo.horario}`
  );
}

/* =========================================================
   CONTROLE DIÁRIO
========================================================= */

function limparControleDiario() {
  const hoje = new Date().toDateString();

  if (hoje === dataControle) {
    return;
  }

  anunciosTocadosHoje = [];
  dataControle = hoje;

  sessionStorage.setItem(
    "anunciosTocadosHoje",
    JSON.stringify(anunciosTocadosHoje)
  );

  sessionStorage.setItem(
    "dataControle",
    dataControle
  );
}

/* =========================================================
   FUNÇÕES AUXILIARES
========================================================= */

function criarIdMidia(item) {
  if (!item) {
    return "";
  }

  const identificador =
    item.videoId ||
    item.arquivoId ||
    item.id ||
    "";

  const horario =
    item.inicio ||
    item.horario ||
    "";

  return `${item.tipo}_${identificador}_${horario}`;
}

function nomeMidiaAtual() {
  if (tocandoAnuncio) {
    return "Exibindo anúncio.";
  }

  if (midiaProgramaAtual) {
    return `No ar: ${midiaProgramaAtual.nome ||
      "Programação atual"
      }`;
  }

  return "Reproduzindo mídia.";
}

function minutosAtuais() {
  const agora = new Date();

  return (
    agora.getHours() * 60 +
    agora.getMinutes()
  );
}

function converterHora(hora) {
  if (
    typeof hora !== "string" ||
    !hora.includes(":")
  ) {
    return -1;
  }

  const [horas, minutos] =
    hora.split(":").map(Number);

  if (
    Number.isNaN(horas) ||
    Number.isNaN(minutos)
  ) {
    return -1;
  }

  return horas * 60 + minutos;
}

function formatarHora(data) {
  const horas = String(
    data.getHours()
  ).padStart(2, "0");

  const minutos = String(
    data.getMinutes()
  ).padStart(2, "0");

  return `${horas}:${minutos}`;
}

function extrairVideoId(valor) {
  if (!valor) {
    return "";
  }

  const texto = String(valor).trim();

  if (!texto.includes("http")) {
    return texto;
  }

  try {
    const url = new URL(texto);

    if (url.hostname.includes("youtu.be")) {
      return url.pathname.replace("/", "");
    }

    if (url.searchParams.get("v")) {
      return url.searchParams.get("v");
    }

    const partes = url.pathname.split("/");

    const indiceEmbed =
      partes.indexOf("embed");

    if (
      indiceEmbed >= 0 &&
      partes[indiceEmbed + 1]
    ) {
      return partes[indiceEmbed + 1];
    }

    const indiceShorts =
      partes.indexOf("shorts");

    if (
      indiceShorts >= 0 &&
      partes[indiceShorts + 1]
    ) {
      return partes[indiceShorts + 1];
    }
  } catch (erro) {
    console.warn(
      "Não foi possível interpretar a URL:",
      valor
    );
  }

  return texto;
}

/* =========================================================
   BOTÃO INICIAR TV
========================================================= */

document.addEventListener("DOMContentLoaded", () => {
  const botao = document.createElement("button");

  botao.innerText = "INICIAR TV";

  botao.style.position = "fixed";
  botao.style.top = "0";
  botao.style.left = "0";
  botao.style.width = "100vw";
  botao.style.height = "100vh";
  botao.style.fontSize = "40px";
  botao.style.background = "black";
  botao.style.color = "white";
  botao.style.border = "none";
  botao.style.cursor = "pointer";
  botao.style.zIndex = "99999";

  document.body.appendChild(botao);

  botao.onclick = async () => {
    try {
      await document.documentElement.requestFullscreen();
    } catch (erro) {
      console.log(
        "Tela cheia não foi autorizada:",
        erro
      );
    }

    botao.remove();

    if (videoLocal) {
      videoLocal.muted = false;
      videoLocal.volume = 1;
    }

    mostrarLoading("Preparando o sistema...");
    atualizarStatus("Preparando o player...");

    iniciarSistema();
  };
});

/* =========================================================
   LIMPEZA AO FECHAR A PÁGINA
========================================================= */

window.addEventListener("beforeunload", () => {
  clearInterval(intervaloSistema);
  clearInterval(loadingInterval);
  clearTimeout(timeoutAnuncio);

  liberarUrlArquivoAnterior();
});