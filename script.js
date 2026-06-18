let player;
let tocandoAnuncio = false;
let videoPrincipalAtual = null;

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
    videoId: "M7lc1UVf-VE",
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
const anuncios = [
 {
    nome: "Anúncio 1",
    videoId: "M7lc1UVf-VE",
    horario: "08:30",
    duracaoSegundos: 30
  },
  {
    nome: "Anúncio 2",
    videoId: "ysz5S6PUM-U",
    horario: "14:00",
    duracaoSegundos: 60
  },
  {
    nome: "Anúncio 3",
    videoId: "dQw4w9WgXcQ",
    horario: "20:15",
    duracaoSegundos: 15
  }
];
];

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
      onStateChange: verificarEstado
    }
  });
}

function iniciarSistema() {
  atualizarProgramacao();

  setInterval(() => {
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

  document.getElementById("status").innerText =
    "Exibindo anúncio: " + anuncio.nome +
    " por " + anuncio.duracaoSegundos + " segundos";

  player.loadVideoById(anuncio.videoId);

  setTimeout(() => {
    tocandoAnuncio = false;
    atualizarProgramacao();
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