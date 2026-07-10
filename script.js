const DB_NAME = "tvLocalDB";
const STORE_NAME = "arquivos";

let loadingInterval = null;

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

const loadingBox = document.getElementById("loadingBox");
const progressoLoading = document.getElementById("progressoLoading");
const loadingTexto = document.getElementById("loadingTexto");

function mostrarLoading(texto = "Carregando vídeo...") {
  if (!loadingBox || !progressoLoading || !loadingTexto) return;

  loadingTexto.innerText = texto;
  loadingBox.style.display = "block";
  progressoLoading.style.width = "0%";

  let progresso = 0;

  clearInterval(loadingInterval);

  loadingInterval = setInterval(() => {
    progresso += 5;
    if (progresso > 90) progresso = 90;
    progressoLoading.style.width = progresso + "%";
  }, 300);
}

function esconderLoading() {
  if (!loadingBox || !progressoLoading) return;

  clearInterval(loadingInterval);
  progressoLoading.style.width = "100%";

  setTimeout(() => {
    loadingBox.style.display = "none";
    progressoLoading.style.width = "0%";
  }, 300);
}

function onYouTubeIframeAPIReady() {
  player = new YT.Player("youtubePlayer", {
    width: "100%",
    height: "100%",
    videoId: "ysz5S6PUM-U",
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
        esconderLoading();
      },

      onStateChange: (event) => {
        console.log("Estado YouTube:", event.data);

        if (event.data === YT.PlayerState.PLAYING) {
          esconderLoading();
        }

        if (event.data === YT.PlayerState.BUFFERING) {
          mostrarLoading("Carregando/Buferizando vídeo...");
        }
      },

      onError: (event) => {
        console.error("Erro YouTube:", event.data);
        mostrarLoading("Erro ao carregar vídeo. Código: " + event.data);
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
  if (!item) {
    console.warn("Nenhuma mídia encontrada para este horário.");
    pararTudo(true);
    return;
  }

  pararTudo(false);

  if (item.tipo === "youtube") {
    mostrarYoutube();
    mostrarLoading("Carregando vídeo do YouTube...");

    if (!youtubePronto || !player) {
      console.warn("YouTube ainda não está pronto. Tentando novamente...");
      setTimeout(() => tocarMidia(item, startSeconds), 500);
      return;
    }

    if (!item.videoId) {
      console.warn("Vídeo do YouTube sem ID:", item);
      mostrarLoading("Erro: vídeo sem ID.");
      return;
    }

    player.loadVideoById({
      videoId: "M7lc1UVf-VE",
      startSeconds: 0
    });

    player.playVideo();
    
    mostrarLoading("Carregando arquivo local...");

    const arquivo = await buscarArquivo(item.arquivoId);

    if (!arquivo || !arquivo.blob) {
      console.warn("Arquivo não encontrado no IndexedDB:", item);
      mostrarLoading("Arquivo não encontrado.");
      pararTudo(true);
      return;
    }

    const url = URL.createObjectURL(arquivo.blob);

    if (arquivo.tipo.startsWith("image/")) {
      imagemLocal.src = url;
      mostrarImagem();
      esconderLoading();
    } else {
      videoLocal.src = url;
      videoLocal.currentTime = startSeconds || 0;
      mostrarVideo();
      videoLocal.muted = false;
      videoLocal.volume = 1;

      videoLocal.onplaying = () => {
        esconderLoading();
      };

      videoLocal.onwaiting = () => {
        mostrarLoading("Carregando vídeo local...");
      };

      videoLocal.onerror = () => {
        mostrarLoading("Erro ao carregar vídeo local.");
      };

      videoLocal.play().catch(() => {
        console.log("Autoplay bloqueado.");
        mostrarLoading("Clique na tela para iniciar o vídeo.");
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
    esconderLoading();

    try {
      if (player && typeof player.stopVideo === "function") {
        player.stopVideo();
      }
    } catch (e) {
      console.warn("Aviso do YouTube ignorado:", e);
    }

    if (videoLocal) {
      videoLocal.pause();
    }

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

      mostrarLoading("Preparando YouTube...");

      const esperarYoutube = setInterval(() => {
        if (youtubePronto) {
          clearInterval(esperarYoutube);
          esconderLoading();
          iniciarSistema();
        }
      }, 300);
    };
  });