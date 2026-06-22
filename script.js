let player;
let tocandoAnuncio = false;
let videoPrincipalAtual = null;
let tempoPausadoPrograma = 0;

// Coloque aqui seus vídeos principais
const programacao = [
  {
    nome: "Programa da manhã",
    videoId: "ysz5S6PUM-U",
    inicio: "08:00",
    fim: "12:00"
  },
  {
    nome: "Programa da tarde",
    videoId: "WrMJeF7nclA",
    inicio: "12:00",
    fim: "18:00"
  },
  {
    nome: "Programa da noite",
    videoId: "dQw4w9WgXcQ",
    inicio: "18:00",
    fim: "23:59"
  }
];

// Coloque aqui os anúncios com horários definidos
let anuncios =
JSON.parse(localStorage.getItem("anunciosTV")) || [];


let anunciosTocadosHoje = [];

function onYouTubeIframeAPIReady() {
  player = new YT.Player("player", {
    width: "100%",
    height: "500",
    videoId: "ysz5S6PUM-U",
    playerVars: {
      autoplay: 1,
      controls: 1,
      rel: 0
    },
    events: {
      onReady: iniciarSistema,
    }
  });
}

function iniciarSistema() {
  atualizarProgramacao();

  setInterval(() => {
  anuncios = JSON.parse(localStorage.getItem("anunciosTV")) || [];
  atualizarProgramacao();
  verificarAnuncios();
}, 1000);
}

function atualizarProgramacao() {
  if (tocandoAnuncio) return;

  const agora = new Date();
  const minutosAgora = agora.getHours() * 60 + agora.getMinutes();

  const programaAtual = programacao.find(programa => {
    return minutosAgora >= converterHora(programa.inicio) &&
           minutosAgora <= converterHora(programa.fim);
  });

  if (!programaAtual) {
    document.getElementById("status").innerText = "Nenhum programa neste horário.";
    return;
  }

  if (videoPrincipalAtual !== programaAtual.videoId) {
    videoPrincipalAtual = programaAtual.videoId;
    player.loadVideoById(programaAtual.videoId);
  }

  document.getElementById("status").innerText =
    "No ar: " + programaAtual.nome;
}

function verificarAnuncios() {
  if (tocandoAnuncio) return;

  const agora = new Date();
  const horaAtual = formatarHora(agora);

  const anuncio = anuncios.find(ad => {
    return ad.horario === horaAtual && !anunciosTocadosHoje.includes(ad.horario);
  });

  if (anuncio) {
    tocarAnuncio(anuncio);
  }
}

function tocarAnuncio(anuncio) {
  tocandoAnuncio = true;
  anunciosTocadosHoje.push(anuncio.horario);

  // salva o ponto exato do vídeo principal
  tempoPausadoPrograma = player.getCurrentTime();

  document.getElementById("status").innerText =
    "Exibindo anúncio: " + anuncio.nome +
    " por " + anuncio.duracaoSegundos + " segundos";

  player.loadVideoById(anuncio.videoId);

  setTimeout(() => {
    tocandoAnuncio = false;

    // volta para o vídeo principal do mesmo ponto
    player.loadVideoById({
      videoId: videoPrincipalAtual,
      startSeconds: tempoPausadoPrograma
    });

    document.getElementById("status").innerText =
      "Voltando para a programação...";

  }, anuncio.duracaoSegundos * 1000);
}

function verificarEstado(event) {
  // 0 significa que o vídeo terminou
  if (event.data === YT.PlayerState.ENDED && tocandoAnuncio) {
    tocandoAnuncio = false;
    atualizarProgramacao();
  }
}

function converterHora(hora) {
  const partes = hora.split(":");
  return Number(partes[0]) * 60 + Number(partes[1]);
}

function formatarHora(data) {
  const h = String(data.getHours()).padStart(2, "0");
  const m = String(data.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}