const DB_NAME = "tvLocalDB";
const STORE_NAME = "arquivos";

let player;
let youtubePronto = false;
let tocandoAnuncio = false;
let midiaAtualId = null;
let midiaProgramaAtual = null;
let tempoPausadoPrograma = 0;
let tvIniciada = false;

let anunciosTocadosHoje =
  JSON.parse(sessionStorage.getItem("anunciosTocadosHoje")) || [];

let dataControle =
  sessionStorage.getItem("dataControle") || new Date().toDateString();

const youtubeBox = document.getElementById("youtubePlayer");
const videoLocal = document.getElementById("videoLocal");
const imagemLocal = document.getElementById("imagemLocal");

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

        if (tvIniciada) {
          atualizarSistema();
        }
      }
    }
  });
}

function iniciarSistema() {
  if (tvIniciada) return;

  tvIniciada = true;
  atualizarSistema();
  setInterval(atualizarSistema, 1000);
}

async function atualizarSistema() {
  limparControleDiario();

  if (!tocandoAnuncio) {
    await atualizarProgramacao();
    await verificarAnuncios();
  }

  mostrarProximoAnuncio();
}

function pegarProgramacao() {
  return JSON.parse(localStorage.getItem("programacaoTV")) || [];
}

function pegarAnuncios() {
  return JSON.parse(localStorage.getItem("anunciosTV")) || [];
}

async function atualizarProgramacao() {
  const programacao = pegarProgramacao();
  const minutosAgora = minutosAtuais();

  const programaAtual = programacao.find(programa => {
    const inicio = converterHora(programa.inicio);
    const fim = converterHora(programa.fim);

    return minutosAgora >= inicio && minutosAgora < fim;
  });

  if (!programaAtual) {
    midiaAtualId = null;
    midiaProgramaAtual = null;
    pararTudo(true);
    return;
  }

  const idAtual = criarIdMidia(programaAtual);

  if (midiaAtualId !== idAtual) {
    midiaProgramaAtual = programaAtual;
    midiaAtualId = idAtual;

    await tocarMidia(programaAtual);
  }
}

async function verificarAnuncios() {
  const anuncios = pegarAnuncios();
  const agora = formatarHora(new Date());

  const anuncio = anuncios.find(ad => {
    return ad.horario === agora && !anunciosTocadosHoje.includes(ad.id);
  });

  if (anuncio) {
    await tocarAnuncio(anuncio);
  }
}

async function tocarAnuncio(anuncio) {
  tocandoAnuncio = true;

  anunciosTocadosHoje.push(anuncio.id);
  sessionStorage.setItem("anunciosTocadosHoje", JSON.stringify(anunciosTocadosHoje));

  if (midiaProgramaAtual && midiaProgramaAtual.tipo === "youtube" && player && player.getCurrentTime) {
    tempoPausadoPrograma = player.getCurrentTime();
  } else if (midiaProgramaAtual && midiaProgramaAtual.tipo === "arquivo") {
    tempoPausadoPrograma = videoLocal.currentTime || 0;
  }



  await tocarMidia(anuncio);

  setTimeout(async () => {
    tocandoAnuncio = false;

    if (midiaProgramaAtual) {
      await tocarMidia(midiaProgramaAtual, tempoPausadoPrograma);
    }
  }, anuncio.duracaoSegundos * 1000);
}

async function tocarMidia(item, startSeconds = 0) {

  // Impede erro caso não exista mídia para o horário atual
  if (!item) {
    console.warn("Nenhuma mídia encontrada para este horário.");
    pararTudo(true);
    return;
  }

  pararTudo(false);

 if (item.tipo === "youtube") {
  mostrarYoutube();

  if (!youtubePronto) {
    console.warn("YouTube ainda não está pronto. Tentando novamente...");
    setTimeout(() => tocarMidia(item, startSeconds), 500);
    return;
  }

  player.loadVideoById({
    videoId: item.videoId,
    startSeconds
  });

  player.playVideo();
  return;
}

  const arquivo = await buscarArquivo(item.arquivoId);

  if (!arquivo || !arquivo.blob) {
    console.warn("Arquivo não encontrado no IndexedDB:", item);
    pararTudo(true);
    return;
  }

  const url = URL.createObjectURL(arquivo.blob);

  if (arquivo.tipo.startsWith("image/")) {
    imagemLocal.src = url;
    mostrarImagem();
  } else {
    videoLocal.src = url;
    videoLocal.currentTime = startSeconds || 0;
    mostrarVideo();
    videoLocal.muted = false;
    videoLocal.volume = 1;

    videoLocal.play().catch(() => {
      console.log("Autoplay bloqueado.");
    });

  }
}

function mostrarYoutube() {
  youtubeBox.style.display = "block";
  youtubeBox.style.width = "100vw";
  youtubeBox.style.height = "100vh";

  videoLocal.style.display = "none";
  imagemLocal.style.display = "none";
}

function mostrarVideo() {
  youtubeBox.style.display = "none";
  videoLocal.style.display = "block";
  imagemLocal.style.display = "none";

  try {
    if (player && typeof player.pauseVideo === "function") {
      player.pauseVideo();
    }
  } catch (e) {
    console.warn("YouTube pausado/ignorado.");
  }
}

function mostrarImagem() {
  youtubeBox.style.display = "none";
  videoLocal.style.display = "none";
  imagemLocal.style.display = "block";
}

function pararTudo(limparTela = true) {
  try {
    if (player && typeof player.stopVideo === "function") {
      player.stopVideo();
    }
  } catch (e) {
    console.warn("Aviso do YouTube ignorado:", e);
  }

  videoLocal.pause();

  if (limparTela) {
    youtubeBox.style.display = "none";
    videoLocal.style.display = "none";
    imagemLocal.style.display = "none";
  }
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

async function buscarArquivo(id) {
  const db = await abrirDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const request = tx.objectStore(STORE_NAME).get(id);

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function mostrarProximoAnuncio() {
  const anuncios = pegarAnuncios();
  const agora = minutosAtuais();

  const proximos = anuncios
    .filter(ad => converterHora(ad.horario) >= agora && !anunciosTocadosHoje.includes(ad.id))
    .sort((a, b) => converterHora(a.horario) - converterHora(b.horario));

  // Sem texto na tela. Função mantida apenas para não quebrar o sistema.
}

function limparControleDiario() {
  const hoje = new Date().toDateString();

  if (hoje !== dataControle) {
    anunciosTocadosHoje = [];
    dataControle = hoje;

    sessionStorage.setItem("anunciosTocadosHoje", JSON.stringify(anunciosTocadosHoje));
    sessionStorage.setItem("dataControle", dataControle);
  }
}

function criarIdMidia(item) {
  if (!item) return "";

  return item.tipo + "_" + (item.videoId || item.arquivoId) + "_" + (item.inicio || item.horario || "");
}

function minutosAtuais() {
  const agora = new Date();
  return agora.getHours() * 60 + agora.getMinutes();
}

function converterHora(hora) {
  const [h, m] = hora.split(":").map(Number);
  return h * 60 + m;
}

function formatarHora(data) {
  const h = String(data.getHours()).padStart(2, "0");
  const m = String(data.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}

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
  botao.style.zIndex = "99999";

  document.body.appendChild(botao);

  botao.onclick = async () => {
    try {
      await document.documentElement.requestFullscreen();
    } catch (e) {
      console.log("Fullscreen bloqueado:", e);
    }

    botao.remove();

    if (videoLocal) {
      videoLocal.muted = false;
      videoLocal.volume = 1;
    }

    iniciarSistema();
  };
});