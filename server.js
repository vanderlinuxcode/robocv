import dns from "dns";
dns.setDefaultResultOrder("ipv4first");
import dotenv from "dotenv";
dotenv.config();

import { jwtVerify, createRemoteJWKSet } from "jose";

import express from "express";
import http from "http";
import { Server as SocketIO } from "socket.io";
import mongoose from "mongoose";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { Telegraf, Markup } from "telegraf";
import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  Browsers,
} from "@whiskeysockets/baileys";
import { Boom } from "@hapi/boom";
import pino from "pino";
import qrcode from "qrcode-terminal";
import qrcodeLib from "qrcode";
import axios from "axios";
import fs from "fs";

import { EventEmitter } from "events";
EventEmitter.defaultMaxListeners = 20;

const TEAM_DOMAIN = "https://robov77.cloudflareaccess.com";
const POLICY_AUD =
  "c8295d329aeb4f3e0e1f4489c1a85f2549f722fdac3bd0d377066f65c607aa95";

const JWKS = createRemoteJWKSet(new URL(`${TEAM_DOMAIN}/cdn-cgi/access/certs`));

const originalConsoleError = console.error;
console.error = (...args) => {
  const msg = args.join(" ");
  if (msg.includes("Bad MAC") || msg.includes("Failed to decrypt")) return;
  originalConsoleError(...args);
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

process.on("unhandledRejection", (reason) =>
  console.error(" Unhandled Rejection:", reason),
);
process.on("uncaughtException", (err) =>
  console.error(" Uncaught Exception:", err),
);

const app = express();
const server = http.createServer(app);
const io = new SocketIO(server, { cors: { origin: "*" } });

const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI;
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN?.trim();
const ADMIN_TELEGRAM_ID = process.env.ADMIN_TELEGRAM_ID?.trim();

const WHATSAPP_DELAY_MIN = parseInt(process.env.WHATSAPP_DELAY_MIN) || 5000;
const WHATSAPP_DELAY_MAX = parseInt(process.env.WHATSAPP_DELAY_MAX) || 15000;

console.log(" Configurações carregadas:");
console.log(`   PORT: ${PORT}`);
console.log(`   MONGODB_URI: ${MONGODB_URI ? "" : ""}`);
console.log(`   TELEGRAM_TOKEN: ${TELEGRAM_TOKEN ? "" : ""}`);
console.log(`   ADMIN_TELEGRAM_ID: ${ADMIN_TELEGRAM_ID || ""}`);
console.log(
  `   ️ Delay campanha: ${WHATSAPP_DELAY_MIN}ms – ${WHATSAPP_DELAY_MAX}ms (random)`,
);
console.log(
  `    Auth: Cloudflare Access (email + PIN) — camada interna removida`,
);

app.use(cors({ origin: "*", methods: ["GET", "POST", "PUT", "DELETE"] }));

app.set("trust proxy", 1);

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));
app.use(express.static(path.join(__dirname, "public")));

const leadSchema = new mongoose.Schema({
  chatId: { type: String, default: "" },
  jid: { type: String, default: "" },
  nome: { type: String, default: "" },
  numeroCadastrado: { type: String, default: "" },
  whatsappTelefone: { type: String, required: true, unique: true },
  lids: { type: [String], default: [] },
  numeroSolicitado: { type: Boolean, default: false },
  etapaAtual: { type: String, default: "menu_principal" },
  telegramChatId: { type: String, default: "" },
  email: { type: String, default: "" },
  rg: { type: String, default: "" },
  status: {
    type: String,
    enum: [
      "novo",
      "aguardando_nome",
      "cadastrado",
      "transferido",
      "em_atendimento",
    ],
    default: "novo",
  },
  tipoServico: { type: String, default: "" },
  endereco: {
    cep: String,
    logradouro: String,
    numero: String,
    complemento: String,
    bairro: String,
    cidade: String,
    estado: String,
  },
  rating: { type: Number, default: 0 },
  agendamento: {
    data: Date,
    servico: String,
    chamada: String,
    status: { type: String, default: "pendente" },
    confirmado: { type: Boolean, default: false },
  },
  evidencias: [String],
  interacoes: [
    {
      mensagem: String,
      origem: {
        type: String,
        enum: ["cliente_whatsapp", "bot", "admin_telegram", "atendente"],
        default: "cliente_whatsapp",
      },
      criadoEm: { type: Date, default: Date.now },
    },
  ],
  ultimaInteracao: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now },
});

const chamadaSchema = new mongoose.Schema({
  leadId: { type: mongoose.Schema.Types.ObjectId, ref: "Lead", required: true },
  telefone: { type: String, required: true },
  jid: { type: String, default: "" },
  nome: { type: String, default: "" },
  tenant: { type: String, default: "realizedb" },
  status: {
    type: String,
    enum: ["pendente", "em_andamento", "atendida", "perdida"],
    default: "pendente",
  },
  data: { type: Date, default: Date.now },
  atendidaEm: { type: Date },
  duracao: { type: Number, default: 0 },
  finalizadaPor: {
    type: String,
    enum: ["atendente", "cliente", "sistema", "timeout", ""],
    default: "",
  },
  mensagens: [
    {
      texto: String,
      origem: {
        type: String,
        enum: ["atendente", "cliente", "sistema", "bot"],
      },
      criadoEm: { type: Date, default: Date.now },
    },
  ],
});

const imagemTelaSchema = new mongoose.Schema({
  tela: { type: String, required: true, unique: true },
  legenda: { type: String, default: "" },
  imagemUrl: { type: String, default: "" },
  imagemId: { type: mongoose.Schema.Types.ObjectId, default: null },
  updatedAt: { type: Date, default: Date.now },
});

const Lead = mongoose.models.Lead || mongoose.model("Lead", leadSchema);
const Chamada =
  mongoose.models.Chamada || mongoose.model("Chamada", chamadaSchema);
const ImagemTela =
  mongoose.models.ImagemTela || mongoose.model("ImagemTela", imagemTelaSchema);

let mongoConnected = false;
let gridFSBucket = null;

mongoose
  .connect(MONGODB_URI)
  .then(() => {
    mongoConnected = true;
    console.log(` MongoDB conectado: ${mongoose.connection.db.databaseName}`);
    try {
      gridFSBucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
        bucketName: "imagens",
      });
      console.log(" GridFS pronto");
    } catch (e) {
      console.warn("️ GridFS:", e.message);
    }
  })
  .catch((err) => {
    mongoConnected = false;
    console.error(" MongoDB:", err);
  });

mongoose.connection.on("disconnected", () => {
  mongoConnected = false;
  console.warn("️ MongoDB desconectado.");
});
mongoose.connection.on("reconnected", () => {
  mongoConnected = true;
  console.log(" MongoDB reconectado.");
});

let sock = null;
let waStatus = "desconectado";
let waReady = false;
let qrCodeData = null;
let qrCodeBase64 = null;
let telegramBot = null;
let botStatus = "desconectado";
let telegramError = false;
let telegramReady = false;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 3;
const logger = pino({ level: "silent" });

const LIDS_BLOQUEADOS = new Set([]);

function soDigitos(valor) {
  if (!valor) return "";
  return String(valor).replace(/\D/g, "");
}

function formatarTelefone(numero) {
  if (!numero) return "";
  if (String(numero).includes("@lid")) return "";
  let raw = soDigitos(numero);
  if (!raw) return "";
  if (raw.length > 13) return "";
  if (raw.length < 10) return "";
  if (raw.startsWith("55") && raw.length >= 12) raw = raw.substring(2);
  if (raw.length === 11)
    return `(${raw.substring(0, 2)}) ${raw.substring(2, 7)}-${raw.substring(7, 11)}`;
  if (raw.length === 10)
    return `(${raw.substring(0, 2)}) ${raw.substring(2, 6)}-${raw.substring(6, 10)}`;
  return "";
}

function telefoneRealLead(lead) {
  if (!lead) return "";
  const num = soDigitos(lead.numeroCadastrado);
  if (num && num.length >= 10 && num.length <= 13) return num;
  if (
    lead.whatsappTelefone &&
    !String(lead.whatsappTelefone).includes("@lid")
  ) {
    const w = soDigitos(lead.whatsappTelefone);
    if (w && w.length >= 10 && w.length <= 13) return w;
  }
  if (lead.jid && !String(lead.jid).includes("@lid")) {
    const j = soDigitos(lead.jid);
    if (j && j.length >= 10 && j.length <= 13) return j;
  }
  return "";
}

function enriquecerLead(lead) {
  if (!lead) return lead;
  const obj = lead.toObject ? lead.toObject() : { ...lead };
  const real = telefoneRealLead(obj);
  obj.telefoneReal = real;
  if (real) {
    const formatado = formatarTelefone(real);
    obj.telefoneFormatado = formatado || "Número não informado";
  } else {
    obj.telefoneFormatado = "Número não informado";
  }
  return obj;
}

function chatIdParaJid(chatId) {
  if (!chatId) return null;
  if (
    chatId.includes("@s.whatsapp.net") ||
    chatId.includes("@g.us") ||
    chatId.includes("@lid")
  )
    return chatId;
  const numero = chatId.split("@")[0];
  return `${numero}@s.whatsapp.net`;
}

function extrairIdentificadores(jid, altJid) {
  if (altJid && altJid.includes("@s.whatsapp.net")) {
    const numeroReal = altJid.split("@")[0].split(":")[0];
    return {
      chatId: `${numeroReal}@c.us`,
      numeroCadastrado: numeroReal,
      jid: `${numeroReal}@s.whatsapp.net`,
    };
  }
  if (jid) {
    const numero = jid.split("@")[0].split(":")[0];
    const isLid = jid.includes("@lid");
    return {
      chatId: jid.includes("@g.us") ? jid : `${numero}@c.us`,
      numeroCadastrado: isLid ? "" : numero,
      jid: jid,
    };
  }
  return { chatId: null, numeroCadastrado: "", jid: null };
}

function validarTelefoneBrasileiro(texto) {
  if (!texto) return null;
  const raw = soDigitos(texto);
  if (!raw) return null;
  if (raw.length === 10 || raw.length === 11) {
    const ddd = parseInt(raw.substring(0, 2));
    if (ddd < 11 || ddd > 99) return null;
    return `55${raw}`;
  }
  if (raw.length === 12 || raw.length === 13) {
    if (raw.startsWith("55")) {
      const ddd = parseInt(raw.substring(2, 4));
      if (ddd < 11 || ddd > 99) return null;
      return raw;
    }
  }
  return null;
}

async function buscarLeadPorIdentificadores({ chatId, jid, numeroCadastrado }) {
  const filtros = [];
  if (chatId) {
    filtros.push({ whatsappTelefone: chatId });
    filtros.push({ chatId });
  }
  if (jid) {
    filtros.push({ jid });
    if (jid.includes("@lid")) filtros.push({ lids: jid });
  }
  if (numeroCadastrado) {
    const raw = soDigitos(numeroCadastrado);
    if (raw && raw.length >= 10) {
      const canon = raw.startsWith("55") ? raw : `55${raw}`;
      filtros.push({ numeroCadastrado: canon });
      filtros.push({ numeroCadastrado: raw });
      filtros.push({ whatsappTelefone: `${canon}@c.us` });
    }
  }
  if (filtros.length === 0) return null;
  return await Lead.findOne({ $or: filtros });
}

async function registrarLidNoLead(lead, jidReal) {
  if (!jidReal || !jidReal.includes("@lid")) return false;
  if (!Array.isArray(lead.lids)) lead.lids = [];
  if (!lead.lids.includes(jidReal)) {
    lead.lids.push(jidReal);
    return true;
  }
  return false;
}

async function registrarMensagemNaChamada(chatId, texto, origem = "bot") {
  try {
    const chamada = await Chamada.findOne({
      telefone: chatId,
      status: { $in: ["pendente", "em_andamento"] },
    });
    if (chamada) {
      chamada.mensagens.push({ texto, origem, criadoEm: new Date() });
      await chamada.save();
      io.emit(`chamada-mensagem-${chamada._id}`, {
        texto,
        origem,
        criadoEm: new Date(),
      });
    }
  } catch (e) {
    console.error("️ Erro ao registrar msg na chamada:", e.message);
  }
}

async function enviarMensagemWhatsApp(
  destinatario,
  mensagem,
  jidForcado = null,
  registrarComo = null,
) {
  if (!sock || waStatus !== "pronto" || !waReady) {
    throw new Error("WhatsApp não conectado");
  }
  const jid = jidForcado || chatIdParaJid(destinatario);
  const resultado = await sock.sendMessage(jid, { text: mensagem });
  if (registrarComo) {
    await registrarMensagemNaChamada(destinatario, mensagem, registrarComo);
  }
  return resultado;
}

async function obterMediaDaTela(tela) {
  try {
    const cfg = await ImagemTela.findOne({ tela });
    if (cfg && cfg.imagemUrl) {
      try {
        const response = await axios.get(cfg.imagemUrl, {
          responseType: "arraybuffer",
          timeout: 15000,
        });
        return { mimetype: "image/jpeg", buffer: Buffer.from(response.data) };
      } catch (e) {
        console.warn(`️ URL tela "${tela}":`, e.message);
      }
    }
    if (cfg && cfg.imagemId && gridFSBucket) {
      try {
        const chunks = [];
        const stream = gridFSBucket.openDownloadStream(cfg.imagemId);
        await new Promise((resolve, reject) => {
          stream.on("data", (c) => chunks.push(c));
          stream.on("end", resolve);
          stream.on("error", reject);
        });
        return { mimetype: "image/jpeg", buffer: Buffer.concat(chunks) };
      } catch (e) {
        console.warn(`️ GridFS tela "${tela}":`, e.message);
      }
    }
    const mapaLocal = {
      boasvindas: "./public/images/boasvindas.jpg",
      menu: "./public/images/menu.jpg",
      imoveis: "./public/images/imoveis.jpg",
      atendente: "./public/images/atendente.jpg",
      menu_entenda: "./public/images/menu_entenda.jpg",
    };
    const caminho = mapaLocal[tela];
    if (caminho && fs.existsSync(caminho)) {
      return { mimetype: "image/jpeg", buffer: fs.readFileSync(caminho) };
    }
    return null;
  } catch (e) {
    console.warn(`️ Erro imagem "${tela}":`, e.message);
    return null;
  }
}

async function enviarMensagemComImagem(
  destinatario,
  legenda,
  tela,
  jidForcado = null,
  registrarComo = null,
) {
  try {
    const media = await obterMediaDaTela(tela);
    const jid = jidForcado || chatIdParaJid(destinatario);

    let resultado;
    if (media) {
      const legendaCaption =
        legenda.length > 1000 ? legenda.slice(0, 1000) + "…" : legenda;
      resultado = await sock.sendMessage(jid, {
        image: media.buffer,
        caption: legendaCaption,
        mimetype: media.mimetype,
      });

      if (legenda.length > 500) {
        await new Promise((r) => setTimeout(r, 800));
        try {
          await sock.sendMessage(jid, { text: legenda });
        } catch (e) {
          console.warn("️ Falha ao enviar texto separado:", e.message);
        }
      }
    } else {
      resultado = await enviarMensagemWhatsApp(
        destinatario,
        legenda,
        jidForcado,
      );
    }
    if (registrarComo) {
      await registrarMensagemNaChamada(destinatario, legenda, registrarComo);
    }
    return resultado;
  } catch (error) {
    console.error(" Erro imagem:", error);
    return await enviarMensagemWhatsApp(destinatario, legenda, jidForcado);
  }
}

const TEXTO_MENU_PRINCIPAL = ` *CENTRONIC TECNOLOGIA*
Obs.: Aluno término Curso SENAC 25/26

Olá {nome}! Que bom ter você por aqui. 

Como podemos te ajudar hoje?

1️ Temos sites para o que procura
2️ Falar com um atendente humano
3️ Entenda o menu
4️  Ver vídeo de apresentação
0️ Desejo não ser mais incomodado(a)

 Responda com o *número* da opção desejada.`;

const TEXTO_CATALOGO = ` *Acesso ao site Disponível + Chat*

{nome}, separei algumas opções que podem te interessar:

1️  Elétrica de autos America
2️  Telemedicina Cães
3️  Faixas de propaganda / publicidade
4️  Saboreie uma bela pizza
6️  Voltar ao menu principal
0️ Desejo não ser mais incomodado(a)

 Responda com o *número* para ver a foto do serviço.`;

const TEXTO_MENU_ENTENDA = ` *ENTENDA O MENU*

1️ *Temos sites para o que procura*
   Acesso às landingpages com chat direto no hub.

2️ *Falar com um atendente humano*
   Um Analista falará com você pelo WhatsApp.

3️ *Entenda o menu*
   É esta tela que você está vendo agora. 

4️ *Ver vídeo de apresentação*
   Um resumo rápido do que fazemos.

0️*Desejo não ser mais incomodado(a)*
   Você sai da lista e não recebe mais mensagens.

Digite *menu* a qualquer momento para voltar.`;

const TEXTO_ATENDENTE = `‍ *ATENDIMENTO HUMANO*

{nome}, já avisei nossa equipe.
Um atendente vai falar com você em instantes. ⏳

 Se preferir, já pode ir digitando o que procura:
Elétrica de autos, Telemedicina, Faixas ou Pizza.`;

const TEXTO_OPT_OUT = ` *Entendido.*

Você não receberá mais mensagens automáticas deste número.

Se precisar, digite *MENU* para voltar.`;

const TEXTO_PERGUNTA_DDD = ` Para agilizarmos seu atendimento, pode me confirmar seu número com DDD?

Ex.: *61999998888*

_(Se preferir, pode digitar "menu" para pular)_`;

const TEXTO_DDD_CONFIRMADO = ` Anotado! Obrigado. 

Vou te mostrar o menu agora...`;

const TEXTO_RETORNO_BOT = ` *Voltando ao atendimento automático*

Olá {nome}! O atendimento humano foi encerrado.
Estou aqui novamente para te ajudar. `;

const MIDIA_BASE = path.join(__dirname, "public");

const MIDIAS_SERVICOS = {
  pizza: {
    foto: path.join(MIDIA_BASE, "images", "servicos", "pizza.jpg"),
    legenda: " *Saboreie uma bela pizza* — massa artesanal, forno a lenha.",
  },
  eletrica_autos: {
    foto: path.join(MIDIA_BASE, "images", "servicos", "eletrica-autos.jpg"),
    legenda:
      " *Elétrica de autos America* — especialistas em toda parte elétrica.",
  },
  faixas_propaganda: {
    foto: path.join(MIDIA_BASE, "images", "servicos", "faixas-propaganda.jpg"),
    legenda:
      " *Faixas de propaganda / publicidade* — criação de faixas, banners e material publicitário.",
  },
  manutencao_pc: {
    foto: path.join(MIDIA_BASE, "images", "servicos", "manutencao-pc.jpg"),
    legenda:
      " *Manutenção de computadores / Mac* — sistemas, formatação, upgrade.",
  },
};

const VIDEO_APRESENTACAO = {
  path: path.join(MIDIA_BASE, "videos", "apresentacao.mp4"),
  legenda: " *CENTRONIC TEC* — veja um resumo rápido do que fazemos.",
};

async function enviarFotoServico(
  destinatario,
  chave,
  jidForcado = null,
  legendaExtra = "",
) {
  try {
    const item = MIDIAS_SERVICOS[chave];
    if (!item) return false;
    if (!fs.existsSync(item.foto)) {
      console.warn(`️ Foto ausente: ${item.foto}`);
      return false;
    }
    const jid = jidForcado || chatIdParaJid(destinatario);
    const buffer = fs.readFileSync(item.foto);
    const caption = legendaExtra
      ? `${item.legenda}\n\n${legendaExtra}`
      : item.legenda;
    await sock.sendMessage(jid, {
      image: buffer,
      caption,
      mimetype: "image/jpeg",
    });
    return true;
  } catch (e) {
    console.error(" enviarFotoServico:", e.message);
    return false;
  }
}

async function enviarVideoApresentacao(
  destinatario,
  jidForcado = null,
  comLegenda = true,
) {
  try {
    if (!fs.existsSync(VIDEO_APRESENTACAO.path)) {
      console.warn(`️ Vídeo ausente: ${VIDEO_APRESENTACAO.path}`);
      return false;
    }
    const jid = jidForcado || chatIdParaJid(destinatario);
    const buffer = fs.readFileSync(VIDEO_APRESENTACAO.path);
    await sock.sendMessage(jid, {
      video: buffer,
      caption: comLegenda ? VIDEO_APRESENTACAO.legenda : "",
      mimetype: "video/mp4",
      gifPlayback: false,
    });
    return true;
  } catch (e) {
    console.error(" enviarVideoApresentacao:", e.message);
    return false;
  }
}

async function mostrarMenuPrincipal(lead) {
  try {
    if (!sock || waStatus !== "pronto" || !waReady) return;

    const destino = lead.chatId || lead.whatsappTelefone;
    const jid = lead.jid || null;

    try {
      await enviarVideoApresentacao(destino, jid, false);
      lead.interacoes.push({
        mensagem: "Bot: Vídeo de apresentação exibido (antes do menu)",
        origem: "bot",
      });
    } catch (e) {
      console.warn("️ Falha vídeo antes do menu:", e.message);
    }

    await new Promise((r) => setTimeout(r, 800));
    const texto = TEXTO_MENU_PRINCIPAL.replace(
      "{nome}",
      lead.nome || "cliente",
    );
    await enviarMensagemComImagem(destino, texto, "menu", jid);
    await registrarMensagemNaChamada(destino, texto, "bot");

    lead.interacoes.push({
      mensagem: "Bot: Menu principal exibido",
      origem: "bot",
    });
    lead.etapaAtual = "menu_principal";
    await lead.save();
  } catch (error) {
    console.error(" Erro menu:", error);
  }
}

async function retornarAoRobo(chamada, motivo = "encerrado") {
  try {
    const lead = await Lead.findById(chamada.leadId);
    if (!lead) return;

    const texto = TEXTO_RETORNO_BOT.replace("{nome}", lead.nome || "cliente");
    const destino = chamada.telefone;
    const jid = chamada.jid || lead.jid || null;

    try {
      await enviarMensagemWhatsApp(destino, texto, jid);
      chamada.mensagens.push({ texto, origem: "bot", criadoEm: new Date() });
      await chamada.save();
      io.emit(`chamada-mensagem-${chamada._id}`, {
        texto,
        origem: "bot",
        criadoEm: new Date(),
      });
    } catch (e) {
      console.warn("️ Falha msg retorno:", e.message);
    }

    await new Promise((r) => setTimeout(r, 800));
    await mostrarMenuPrincipal(lead);

    console.log(
      ` Robô reassumiu conversa de ${lead.nome || lead.chatId} (motivo: ${motivo})`,
    );
  } catch (e) {
    console.error(" retornarAoRobo:", e.message);
  }
}

async function notificarTelegram(tipo, dados) {
  if (!TELEGRAM_TOKEN || !ADMIN_TELEGRAM_ID) {
    console.log(" [Sem token]", tipo, dados);
    return;
  }
  try {
    let assunto = "",
      mensagem = "";
    switch (tipo) {
      case "nova_chamada":
        assunto = " NOVA CHAMADA";
        mensagem =
          ` *${assunto}*\n\n` +
          ` *Cliente:* ${dados.nome || "Cliente"}\n` +
          ` *Telefone:* ${dados.telefone || "N/A"}\n` +
          `️ *Comércio:* ${dados.tenant || "Direct (WhatsApp)"}\n` +
          ` *Objetivo:* ${dados.objetivo || "Atendimento humano"}\n` +
          ` *ID:* ${String(dados.chamadaId || dados.id || "N/A").slice(-8)}\n` +
          ` *Data:* ${new Date().toLocaleString()}\n\n` +
          ` Aguardando atendimento...`;
        break;
      case "interacao_menu":
        assunto = " INTERAÇÃO NO MENU";
        mensagem = ` *${assunto}*\n\n *Cliente:* ${dados.nome || "Cliente"}\n *Telefone:* ${dados.telefone || "N/A"}\n *Opção:* ${dados.opcao || "N/A"}\n *Data:* ${new Date().toLocaleString()}`;
        break;
      case "mensagem_chamada":
        assunto = " MENSAGEM EM CHAMADA";
        mensagem = ` *${assunto}*\n\n *Cliente:* ${dados.nome || "Cliente"}\n *Telefone:* ${dados.telefone || "N/A"}\n *Mensagem:* ${dados.mensagem || "N/A"}\n *Data:* ${new Date().toLocaleString()}`;
        break;
      case "lead_cadastrado":
        assunto = " RoboCentronic Inicializado, \n\nOnLine";
        mensagem = ` *${assunto}*\n\n *Nome:* ${dados.nome || "Cliente"}\n *Telefone:* ${dados.telefone || "N/A"}\n *Data:* ${new Date().toLocaleString()}`;
        break;
      case "mensagem_cliente":
        assunto = " NOVA MENSAGEM DO CLIENTE";
        mensagem = ` *${assunto}*\n\n *Cliente:* ${dados.nome || "Cliente"}\n *Telefone:* ${dados.telefone || "N/A"}\n *Mensagem:* ${dados.mensagem || "N/A"}\n *Data:* ${new Date().toLocaleString()}`;
        break;
      default:
        assunto = " NOTIFICAÇÃO";
        mensagem = ` *${assunto}*\n\n${JSON.stringify(dados)}`;
    }
    const url = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`;
    const response = await axios.post(
      url,
      {
        chat_id: ADMIN_TELEGRAM_ID,
        text: mensagem,
        parse_mode: "Markdown",
      },
      {
        timeout: 15000,
        family: 4,
        httpAgent: new (await import("http")).Agent({ keepAlive: true }),
        httpsAgent: new (await import("https")).Agent({ keepAlive: true }),
      },
    );
    if (response.data && response.data.ok) {
      console.log(` Telegram: ${assunto}`);
      telegramReady = true;
    } else console.error(` Telegram:`, response.data?.description);
  } catch (error) {
    console.error(" Telegram:", error.message);
    telegramError = true;
  }
}

async function processarMensagemWhatsAppCliente(msg) {
  try {
    if (!sock || waStatus !== "pronto" || !waReady) return;
    if (msg.key.fromMe) return;

    const jidRaw = msg.key.remoteJid || "";
    const altRaw = msg.key.remoteJidAlt || "";
    if (LIDS_BLOQUEADOS.has(jidRaw) || LIDS_BLOQUEADOS.has(altRaw)) {
      console.log(` LID bloqueado, ignorando: ${jidRaw}`);
      return;
    }

    const idents = extrairIdentificadores(
      msg.key.remoteJid,
      msg.key.remoteJidAlt,
    );
    const chatId = idents.chatId;
    const jidReal = idents.jid;
    const numeroCadastrado = idents.numeroCadastrado;

    const textoOriginal = (
      msg.message?.conversation ||
      msg.message?.extendedTextMessage?.text ||
      ""
    ).trim();
    const texto = textoOriginal.toLowerCase();
    const pushName = msg.pushName || "Cliente WhatsApp";

    if (!textoOriginal) return;

    console.log(
      ` Mensagem de ${chatId} (jid=${jidReal}, num=${numeroCadastrado || "LID"})`,
    );

    let lead = await buscarLeadPorIdentificadores({
      chatId,
      jid: jidReal,
      numeroCadastrado,
    });

    if (!lead) {
      lead = new Lead({
        whatsappTelefone: chatId,
        chatId: chatId,
        jid: jidReal || "",
        numeroCadastrado: numeroCadastrado || "",
        lids: jidReal && jidReal.includes("@lid") ? [jidReal] : [],
        nome: pushName,
        status: "novo",
      });
      await lead.save();
      console.log(
        ` Novo lead: ${lead.nome} (num=${numeroCadastrado || "LID"})`,
      );

      const numeroExibir = telefoneRealLead(lead);
      await notificarTelegram("lead_cadastrado", {
        nome: lead.nome,
        telefone:
          formatarTelefone(numeroExibir) ||
          "Número não informado (aguardando realizedb)",
      });

      if (!numeroExibir && jidReal && jidReal.includes("@lid")) {
        try {
          await enviarMensagemWhatsApp(chatId, TEXTO_PERGUNTA_DDD, jidReal);
          lead.numeroSolicitado = true;
          lead.interacoes.push({
            mensagem: "Bot: Perguntou DDD (lead só-LID)",
            origem: "bot",
          });
          await lead.save();
        } catch (e) {
          console.error(" Pergunta DDD:", e.message);
        }
        return;
      }

      try {
        const boasVindas = ` *Olá, ${lead.nome || "cliente"}!*\n\nSeja bem-vindo(a) à *CENTRONIC TECNOLOGIA* \nEstamos aqui para te ajudar a encontrar o que procura.\n\nVou te mostrar o menu agora mesmo... `;
        await enviarMensagemComImagem(
          chatId,
          boasVindas,
          "boasvindas",
          jidReal,
          "bot",
        );
        await new Promise((r) => setTimeout(r, 800));
        await mostrarMenuPrincipal(lead);
      } catch (e) {
        console.error(" Boas-vindas:", e.message);
      }
      return;
    } else {
      if (jidReal && lead.jid !== jidReal) lead.jid = jidReal;
      if (chatId && lead.chatId !== chatId) lead.chatId = chatId;

      if (numeroCadastrado && !lead.numeroCadastrado) {
        lead.numeroCadastrado = numeroCadastrado;
      }

      await registrarLidNoLead(lead, jidReal);

      await lead.save();
    }

    if (lead.etapaAtual === "atendente") {
      const chamadaAtiva = await Chamada.findOne({
        leadId: lead._id,
        status: { $in: ["pendente", "em_andamento"] },
      });
      if (chamadaAtiva) {
        chamadaAtiva.mensagens.push({
          texto: textoOriginal,
          origem: "cliente",
          criadoEm: new Date(),
        });
        if (jidReal && chamadaAtiva.jid !== jidReal) chamadaAtiva.jid = jidReal;
        await chamadaAtiva.save();

        io.emit(`chamada-mensagem-${chamadaAtiva._id}`, {
          texto: textoOriginal,
          origem: "cliente",
          criadoEm: new Date(),
        });

        await notificarTelegram("mensagem_chamada", {
          nome: lead.nome,
          telefone: formatarTelefone(telefoneRealLead(lead)) || "N/A",
          mensagem: textoOriginal,
          chamadaId: chamadaAtiva._id,
        });

        return; 
      }
    }

    if (lead.numeroSolicitado && !lead.numeroCadastrado) {
      const telValido = validarTelefoneBrasileiro(textoOriginal);
      if (telValido) {
        lead.numeroCadastrado = telValido;
        lead.interacoes.push({
          mensagem: `Cliente informou DDD: ${telValido}`,
          origem: "cliente_whatsapp",
        });
        await lead.save();
        console.log(` Lead ${lead._id} agora tem número: ${telValido}`);

        try {
          await enviarMensagemWhatsApp(chatId, TEXTO_DDD_CONFIRMADO, jidReal);
          await new Promise((r) => setTimeout(r, 800));
        } catch (e) {
          console.warn("️ Confirmação DDD:", e.message);
        }

        await mostrarMenuPrincipal(lead);
        return;
      }
    }

    lead.ultimaInteracao = new Date();
    lead.interacoes.push({
      mensagem: textoOriginal,
      origem: "cliente_whatsapp",
    });
    await lead.save();

    const numeroExibir = telefoneRealLead(lead);
    await notificarTelegram("mensagem_cliente", {
      nome: lead.nome,
      telefone: numeroExibir
        ? formatarTelefone(numeroExibir)
        : "Número não informado (aguardando realizedb)",
      mensagem: textoOriginal,
    });

    const chamadaAtiva = await Chamada.findOne({
      telefone: chatId,
      status: { $in: ["em_andamento", "pendente"] },
    });

    if (chamadaAtiva && chamadaAtiva.status === "em_andamento") {
      chamadaAtiva.mensagens.push({
        texto: textoOriginal,
        origem: "cliente",
        criadoEm: new Date(),
      });
      if (jidReal && chamadaAtiva.jid !== jidReal) chamadaAtiva.jid = jidReal;
      await chamadaAtiva.save();
      await notificarTelegram("mensagem_chamada", {
        nome: lead.nome,
        telefone:
          formatarTelefone(numeroExibir) ||
          "Número não informado (aguardando realizedb)",
        mensagem: textoOriginal,
        chamadaId: chamadaAtiva._id,
      });
      io.emit(`chamada-mensagem-${chamadaAtiva._id}`, {
        texto: textoOriginal,
        origem: "cliente",
        criadoEm: new Date(),
      });
      return;
    }

    const opcao = parseInt(texto);
    const emCatalogo = lead.etapaAtual === "catalogo";

    if (
      lead.status === "transferido" &&
      !["menu", "voltar", "inicio"].includes(texto)
    ) {
      return;
    }

    if (!emCatalogo) {
      if (opcao === 1) {
        await notificarTelegram("interacao_menu", {
          nome: lead.nome,
          telefone: formatarTelefone(numeroExibir) || "N/A",
          opcao: " Submenu de serviços exibido",
        });
        const textoCatalogo = TEXTO_CATALOGO.replace(
          "{nome}",
          lead.nome || "cliente",
        );
        await enviarMensagemComImagem(
          chatId,
          textoCatalogo,
          "imoveis",
          jidReal,
        );
        lead.interacoes.push({
          mensagem: "Bot: Submenu de serviços exibido",
          origem: "bot",
        });
        lead.etapaAtual = "catalogo";
        await lead.save();
        return;
      }

      if (opcao === 2) {
        await notificarTelegram("interacao_menu", {
          nome: lead.nome,
          telefone: formatarTelefone(numeroExibir) || "N/A",
          opcao: "‍ Atendente humano",
        });
        let chamada = await Chamada.findOne({
          leadId: lead._id,
          status: { $in: ["pendente", "em_andamento"] },
        });
        if (!chamada) {
          chamada = new Chamada({
            leadId: lead._id,
            telefone: chatId,
            jid: jidReal || lead.jid || "",
            nome: lead.nome,
            status: "pendente",
          });
          await chamada.save();
        } else if (jidReal && chamada.jid !== jidReal) {
          chamada.jid = jidReal;
          await chamada.save();
        }
        const textoAtendente = TEXTO_ATENDENTE.replace(
          "{nome}",
          lead.nome || "cliente",
        );
        await enviarMensagemComImagem(
          chatId,
          textoAtendente,
          "atendente",
          jidReal,
        );
        await notificarTelegram("nova_chamada", {
          nome: chamada.nome,
          telefone: formatarTelefone(numeroExibir) || "N/A",
          chamadaId: chamada._id,
          tenant: chamada.tenant || "Direct (WhatsApp)",
          objetivo: "Atendimento humano via menu",
        });
        io.emit("nova-chamada", {
          leadId: lead._id,
          nome: chamada.nome,
          telefone: numeroExibir,
          chamadaId: chamada._id,
        });
        lead.interacoes.push({
          mensagem: "Bot: Atendimento humano solicitado",
          origem: "bot",
        });
        lead.etapaAtual = "atendente";
        await lead.save();
        return;
      }

      if (opcao === 3) {
        await notificarTelegram("interacao_menu", {
          nome: lead.nome,
          telefone: formatarTelefone(numeroExibir) || "N/A",
          opcao: " Entenda o menu",
        });
        await enviarMensagemComImagem(
          chatId,
          TEXTO_MENU_ENTENDA,
          "menu_entenda",
          jidReal,
        );
        await new Promise((r) => setTimeout(r, 1500));
        await mostrarMenuPrincipal(lead);
        return;
      }

      if (opcao === 4) {
        await enviarVideoApresentacao(chatId, jidReal);
        lead.interacoes.push({
          mensagem: "Bot: Vídeo de apresentação exibido (menu)",
          origem: "bot",
        });
        await lead.save();
        await new Promise((r) => setTimeout(r, 1500));
        await mostrarMenuPrincipal(lead);
        return;
      }

      if (opcao === 0) {
        lead.status = "transferido";
        lead.interacoes.push({
          mensagem: "Cliente solicitou não ser mais incomodado",
          origem: "cliente_whatsapp",
        });
        await lead.save();
        await enviarMensagemWhatsApp(chatId, TEXTO_OPT_OUT, jidReal, "bot");
        return;
      }
    }

    if (emCatalogo) {
      if (opcao === 1) {
        lead.tipoServico = "Elétrica de autos America";
        await enviarFotoServico(
          chatId,
          "eletrica_autos",
          jidReal,
          "1️⃣ Digite *2* Telemedicina, *3* Faixas, *4* Pizza, *6* voltar, *0* sair.",
        );
        lead.interacoes.push({
          mensagem: "Bot: Foto elétrica autos exibida",
          origem: "bot",
        });
        await lead.save();
        return;
      }

      if (opcao === 2) {
        lead.tipoServico = "Telemedicina Cães";
        await enviarFotoServico(
          chatId,
          "manutencao_pc",
          jidReal,
          "2️⃣ Digite *3* Faixas, *4* Pizza, *6* voltar, *0* sair.",
        );
        lead.interacoes.push({
          mensagem: "Bot: Foto Telemedicina Cães exibida",
          origem: "bot",
        });
        await lead.save();
        return;
      }

      if (opcao === 3) {
        lead.tipoServico = "Faixas de propaganda";
        await enviarFotoServico(
          chatId,
          "faixas_propaganda",
          jidReal,
          "3️⃣ Digite *4* Pizza, *6* voltar, *0* sair.",
        );
        lead.interacoes.push({
          mensagem: "Bot: Foto faixas de propaganda exibida",
          origem: "bot",
        });
        await lead.save();
        return;
      }

      if (opcao === 4) {
        lead.tipoServico = "Pizza";
        await enviarFotoServico(
          chatId,
          "pizza",
          jidReal,
          "4️ Digite *6* voltar, *0* sair.",
        );
        lead.interacoes.push({
          mensagem: "Bot: Foto pizza exibida",
          origem: "bot",
        });
        await lead.save();
        return;
      }

      if (opcao === 6) {
        lead.interacoes.push({
          mensagem: "Bot: Voltou ao menu principal (opção 6)",
          origem: "bot",
        });
        await lead.save();
        await mostrarMenuPrincipal(lead);
        return;
      }

      if (opcao === 0) {
        lead.status = "transferido";
        lead.interacoes.push({
          mensagem: "Cliente solicitou não ser mais incomodado",
          origem: "cliente_whatsapp",
        });
        await lead.save();
        await enviarMensagemWhatsApp(chatId, TEXTO_OPT_OUT, jidReal, "bot");
        return;
      }
    }

    if (["menu", "voltar", "inicio"].includes(texto)) {
      await mostrarMenuPrincipal(lead);
      return;
    }

    if (["sair", "cancelar"].includes(texto)) {
      await enviarMensagemWhatsApp(
        chatId,
        " *Atendimento encerrado.*\n\nDigite *MENU* para voltar ao início.",
        jidReal,
      );
      return;
    }

    await enviarMensagemWhatsApp(
      chatId,
      "Seja bem vindo,\n\nDigite o *número* correspondente à opção desejada.",
      jidReal,
      "bot",
    );
    await mostrarMenuPrincipal(lead);
  } catch (error) {
    console.error("Erro processar mensagem:", error);
  }
}

async function gerarESalvarQRCode(qr) {
  try {
    console.log("\n════════════════════════════════════════════════");
    console.log(" QR CODE WHATSAPP — ESCANEIE COM O CELULAR");
    console.log("════════════════════════════════════════════════\n");
    qrcode.generate(qr, { small: true });
    console.log("\n════════════════════════════════════════════════");
    console.log("️  QR expira em ~20 segundos.");
    console.log("════════════════════════════════════════════════\n");
    const qrTxtPath = path.join(__dirname, "qrcode-atual.txt");
    fs.writeFileSync(qrTxtPath, qr, "utf-8");
    const qrPngPath = path.join(__dirname, "qrcode-atual.png");
    await qrcodeLib.toFile(qrPngPath, qr, {
      width: 400,
      margin: 2,
      color: { dark: "#000000", light: "#FFFFFF" },
    });
    qrCodeBase64 = await qrcodeLib.toDataURL(qr, { width: 400, margin: 2 });
    return { qrTxtPath, qrPngPath, qrCodeBase64 };
  } catch (e) {
    console.error("️ QR:", e.message);
    return null;
  }
}

async function iniciarWhatsApp() {
  try {
    console.log(" Iniciando WhatsApp com Baileys...");
    const sessionPath = path.join(__dirname, "session");
    if (!fs.existsSync(sessionPath))
      fs.mkdirSync(sessionPath, { recursive: true });

    const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
    const { version } = await fetchLatestBaileysVersion();
    console.log(` Baileys WA versão: ${version.join(".")}`);

    sock = makeWASocket({
      version,
      logger,
      printQRInTerminal: false,
      auth: state,
      browser: Browsers.ubuntu("Chrome"),
      generateHighQualityLinkPreview: false,
      syncFullHistory: false,
      markOnlineOnConnect: false,
      connectTimeoutMs: 60000,
      defaultQueryTimeoutMs: 60000,
      keepAliveIntervalMs: 30000,
      retryRequestDelayMs: 2000,
    });

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("connection.update", async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        qrCodeData = qr;
        waStatus = "aguardando_qr";
        waReady = false;
        console.log(" QR Code gerado!");
        await gerarESalvarQRCode(qr);
        io.emit("whatsapp-qr", {
          qr,
          qrImage: qrCodeBase64,
          qrUrl: `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qr)}`,
        });
        io.emit("whatsapp-status", {
          status: "aguardando_qr",
          qrImage: qrCodeBase64,
        });
      }

      if (connection === "open") {
        reconnectAttempts = 0;
        waStatus = "pronto";
        waReady = true;
        qrCodeData = null;
        qrCodeBase64 = null;
        try {
          const t = path.join(__dirname, "qrcode-atual.txt");
          const p = path.join(__dirname, "qrcode-atual.png");
          if (fs.existsSync(t)) fs.unlinkSync(t);
          if (fs.existsSync(p)) fs.unlinkSync(p);
        } catch (e) {}
        console.log(" WhatsApp Conectado!");
        io.emit("whatsapp-status", { status: "pronto" });
        notificarTelegram("lead_cadastrado", {
          nome: "Sistema Centronic",
          telefone: " WhatsApp Conectado!",
        }).catch(() => {});
      }

      if (connection === "close") {
        const statusCode = new Boom(lastDisconnect?.error)?.output?.statusCode;
        console.log(`️ WhatsApp desconectado. Código: ${statusCode}`);
        waStatus = "desconectado";
        waReady = false;
        qrCodeData = null;
        qrCodeBase64 = null;
        io.emit("whatsapp-status", {
          status: "desconectado",
          reason: String(statusCode),
        });

        const deveReconectar = statusCode !== DisconnectReason.loggedOut;
        if (!deveReconectar) {
          console.log(" Sessão deslogada.");
          return;
        }
        if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
          console.error(` Limite atingido.`);
          return;
        }
        reconnectAttempts++;
        console.log(
          ` Reconexão ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS} em 10s...`,
        );
        setTimeout(() => {
          if (waStatus === "desconectado") iniciarWhatsApp();
        }, 10000);
      }
    });

    sock.ev.on("messages.upsert", async ({ messages, type }) => {
      if (type !== "notify") return;
      for (const msg of messages) {
        if (msg.key.fromMe) continue;
        if (msg.key.remoteJid?.includes("@g.us")) continue;
        await processarMensagemWhatsAppCliente(msg);
      }
    });

    console.log(" Baileys inicializado.");
  } catch (error) {
    console.error(" ERRO WHATSAPP:", error);
    waReady = false;
    if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) return;
    reconnectAttempts++;
    setTimeout(() => iniciarWhatsApp(), 10000);
  }
}

function iniciarTelegramBot() {
  console.log(" Iniciando Telegram Bot...");
  if (!TELEGRAM_TOKEN) {
    console.error(" TELEGRAM_TOKEN não configurado");
    return;
  }
  if (!ADMIN_TELEGRAM_ID || isNaN(parseInt(ADMIN_TELEGRAM_ID))) {
    console.error(" ADMIN_TELEGRAM_ID inválido!");
    return;
  }

  (async () => {
    try {
      const bot = new Telegraf(TELEGRAM_TOKEN, {
        telegram: { timeout: 30000, agent: null },
      });
      const menuPrincipal = () =>
        Markup.inlineKeyboard([
          [Markup.button.callback(" Dashboard", "dashboard")],
          [Markup.button.callback(" Chamadas", "chamadas")],
          [Markup.button.callback(" Clientes", "clientes")],
          [Markup.button.callback(" Estatísticas", "estatisticas")],
          [Markup.button.callback(" Buscar", "buscar")],
          [Markup.button.callback(" Campanha", "campanha")],
          [Markup.button.callback("ℹ️ Ajuda", "ajuda")],
        ]);

      async function safeEditMessage(ctx, texto, teclado = null) {
        try {
          const opts = { parse_mode: "Markdown" };
          if (teclado) Object.assign(opts, teclado);
          await ctx.editMessageText(texto, opts);
        } catch (err) {
          const desc = err?.response?.description || err?.description || "";
          if (desc.includes("message is not modified")) return;
          console.error("️ Telegram edit:", desc || err.message);
        }
      }

      bot.command("start", async (ctx) => {
        if (ctx.chat.id.toString() !== ADMIN_TELEGRAM_ID) return;
        try {
          const totalLeads = await Lead.countDocuments();
          const cp = await Chamada.countDocuments({ status: "pendente" });
          const ca = await Chamada.countDocuments({ status: "em_andamento" });
          await ctx.replyWithMarkdown(
            ` *CENTRONIC - Atendente Virtual*\n\n WhatsApp: ${waStatus === "pronto" ? " Conectado" : " Desconectado"}\n Chamadas pendentes: ${cp}\n Em andamento: ${ca}\n Total clientes: ${totalLeads}\n Uptime: ${Math.floor(process.uptime() / 60)} minutos\n\n*Selecione uma opção:*`,
            menuPrincipal(),
          );
        } catch (error) {
          console.error("Erro /start:", error.message);
          await ctx.reply(" Erro.");
        }
      });

      bot.action("dashboard", async (ctx) => {
        await ctx.answerCbQuery();
        const totalLeads = await Lead.countDocuments();
        const cp = await Chamada.countDocuments({ status: "pendente" });
        const ca = await Chamada.countDocuments({ status: "em_andamento" });
        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);
        const novosHoje = await Lead.countDocuments({
          createdAt: { $gte: hoje },
        });
        await safeEditMessage(
          ctx,
          ` *DASHBOARD*\n\n WhatsApp: ${waStatus === "pronto" ? " Conectado" : " Desconectado"}\n Pendentes: ${cp}\n Em andamento: ${ca}\n Total clientes: ${totalLeads}\n Novos hoje: ${novosHoje}\n Uptime: ${Math.floor(process.uptime() / 60)} min`,
          menuPrincipal(),
        );
      });

      bot.action("voltar", async (ctx) => {
        await ctx.answerCbQuery();
        const totalLeads = await Lead.countDocuments();
        const cp = await Chamada.countDocuments({ status: "pendente" });
        await safeEditMessage(
          ctx,
          ` *CENTRONIC - Atendente Virtual*\n\n WhatsApp: ${waStatus === "pronto" ? " Conectado" : " Desconectado"}\n Pendentes: ${cp}\n Total clientes: ${totalLeads}\n Uptime: ${Math.floor(process.uptime() / 60)} min\n\n*Selecione uma opção:*`,
          menuPrincipal(),
        );
      });

      bot.action("chamadas", async (ctx) => {
        await ctx.answerCbQuery();
        try {
          const chamadas = await Chamada.find({ status: "pendente" })
            .sort({ data: -1 })
            .populate("leadId", "nome whatsappTelefone numeroCadastrado jid");
          if (chamadas.length === 0) {
            await safeEditMessage(
              ctx,
              " *Nenhuma chamada pendente.*",
              menuPrincipal(),
            );
            return;
          }
          let lista = ` *CHAMADAS PENDENTES* (${chamadas.length})\n\n`;
          chamadas.slice(0, 5).forEach((c, i) => {
            const telReal = c.leadId ? telefoneRealLead(c.leadId) : c.telefone;
            lista += `${i + 1}.  ${c.nome || "Cliente"}\n    ${formatarTelefone(telReal) || "N/A"}\n    ${c._id.toString().slice(-8)}\n    ${new Date(c.data).toLocaleString()}\n\n`;
          });
          const botoes = chamadas
            .slice(0, 5)
            .map((c) => [
              Markup.button.callback(
                ` ${c.nome || "Cliente"}`,
                `atender_${c._id}`,
              ),
            ]);
          botoes.push([Markup.button.callback(" Voltar", "voltar")]);
          await safeEditMessage(ctx, lista, Markup.inlineKeyboard(botoes));
        } catch (error) {
          console.error("Erro:", error);
          await ctx.reply(" Erro.");
        }
      });

      bot.action(/atender_(.+)/, async (ctx) => {
        await ctx.answerCbQuery();
        const chamadaId = ctx.match[1];
        try {
          const chamada = await Chamada.findById(chamadaId).populate("leadId");
          if (!chamada) {
            await ctx.reply(" Chamada não encontrada.");
            return;
          }
          chamada.status = "em_andamento";
          chamada.atendidaEm = new Date();
          await chamada.save();
          if (sock && waStatus === "pronto" && waReady) {
            await enviarMensagemWhatsApp(
              chamada.telefone,
              `‍ *Atendimento iniciado!*\n\n Um atendente já está conversando com você.\n Digite sua mensagem para continuar.`,
              chamada.jid || null,
            );
          }
          io.emit("chamada-iniciada", {
            chamadaId,
            leadId: chamada.leadId._id,
          });
          const telReal = telefoneRealLead(chamada.leadId);
          await ctx.reply(
            ` *Chamada atendida!*\n\n Cliente: ${chamada.nome}\n Telefone: ${formatarTelefone(telReal) || "N/A"}\n A conversa está ativa no WhatsApp.`,
            Markup.inlineKeyboard([
              [Markup.button.callback(" Voltar", "voltar")],
            ]),
          );
        } catch (error) {
          console.error("Erro atender:", error);
          await ctx.reply(" Erro.");
        }
      });

      bot.action("clientes", async (ctx) => {
        await ctx.answerCbQuery();
        const botoes = [
          [Markup.button.callback(" Todos", "clientes_todos")],
          [Markup.button.callback(" Novos Hoje", "clientes_novos")],
          [Markup.button.callback(" Mais Avaliados", "clientes_top")],
          [Markup.button.callback(" Voltar", "voltar")],
        ];
        await safeEditMessage(
          ctx,
          ` *CLIENTES*\n\nSelecione o filtro desejado:`,
          Markup.inlineKeyboard(botoes),
        );
      });

      bot.action("clientes_todos", async (ctx) => {
        await ctx.answerCbQuery();
        try {
          const leads = await Lead.find()
            .sort({ ultimaInteracao: -1 })
            .limit(20);
          if (leads.length === 0) {
            await safeEditMessage(ctx, " Nenhum cliente.", menuPrincipal());
            return;
          }
          let lista = ` *TODOS OS CLIENTES* (${leads.length})\n\n`;
          leads.forEach((l) => {
            const telReal = telefoneRealLead(l);
            lista += ` ${l.nome || "Sem nome"}\n    ${formatarTelefone(telReal) || "Número não informado"}\n    ${new Date(l.ultimaInteracao).toLocaleString()}\n\n`;
          });
          await safeEditMessage(
            ctx,
            lista,
            Markup.inlineKeyboard([
              [Markup.button.callback(" Voltar", "clientes")],
            ]),
          );
        } catch (error) {
          await ctx.reply(" Erro.");
        }
      });

      bot.action("clientes_novos", async (ctx) => {
        await ctx.answerCbQuery();
        try {
          const hoje = new Date();
          hoje.setHours(0, 0, 0, 0);
          const leads = await Lead.find({ createdAt: { $gte: hoje } })
            .sort({ createdAt: -1 })
            .limit(20);
          if (leads.length === 0) {
            await safeEditMessage(
              ctx,
              " Nenhum cliente novo hoje.",
              menuPrincipal(),
            );
            return;
          }
          let lista = ` *NOVOS HOJE* (${leads.length})\n\n`;
          leads.forEach((l) => {
            const telReal = telefoneRealLead(l);
            lista += ` ${l.nome || "Sem nome"}\n    ${formatarTelefone(telReal) || "Número não informado"}\n    ${new Date(l.createdAt).toLocaleTimeString()}\n\n`;
          });
          await safeEditMessage(
            ctx,
            lista,
            Markup.inlineKeyboard([
              [Markup.button.callback(" Voltar", "clientes")],
            ]),
          );
        } catch (error) {
          await ctx.reply(" Erro.");
        }
      });

      bot.action("clientes_top", async (ctx) => {
        await ctx.answerCbQuery();
        try {
          const leads = await Lead.find({ rating: { $gt: 0 } })
            .sort({ rating: -1 })
            .limit(20);
          if (leads.length === 0) {
            await safeEditMessage(ctx, " Nenhum avaliado.", menuPrincipal());
            return;
          }
          let lista = ` *MAIS AVALIADOS*\n\n`;
          leads.forEach((l) => {
            const telReal = telefoneRealLead(l);
            lista += ` ${l.nome || "Sem nome"}\n    ${formatarTelefone(telReal) || "Número não informado"}\n    ${"".repeat(l.rating)}${"".repeat(5 - l.rating)}\n\n`;
          });
          await safeEditMessage(
            ctx,
            lista,
            Markup.inlineKeyboard([
              [Markup.button.callback(" Voltar", "clientes")],
            ]),
          );
        } catch (error) {
          await ctx.reply(" Erro.");
        }
      });

      bot.action("estatisticas", async (ctx) => {
        await ctx.answerCbQuery();
        try {
          const totalLeads = await Lead.countDocuments();
          const hoje = new Date();
          hoje.setHours(0, 0, 0, 0);
          const novosHoje = await Lead.countDocuments({
            createdAt: { $gte: hoje },
          });
          const cp = await Chamada.countDocuments({ status: "pendente" });
          const ca = await Chamada.countDocuments({ status: "em_andamento" });
          const cat = await Chamada.countDocuments({ status: "atendida" });
          await safeEditMessage(
            ctx,
            ` *ESTATÍSTICAS*\n\n *Clientes*\n   Total: ${totalLeads}\n   Novos hoje: ${novosHoje}\n\n *Chamadas*\n   Pendentes: ${cp}\n   Em andamento: ${ca}\n   Atendidas: ${cat}`,
            Markup.inlineKeyboard([
              [Markup.button.callback(" Atualizar", "estatisticas")],
              [Markup.button.callback(" Voltar", "voltar")],
            ]),
          );
        } catch (error) {
          await ctx.reply(" Erro.");
        }
      });

      bot.action("buscar", async (ctx) => {
        await ctx.answerCbQuery();
        await ctx.reply(
          ` *Buscar Cliente*\n\nDigite o nome ou telefone:\n/buscar [termo]`,
          Markup.inlineKeyboard([
            [Markup.button.callback(" Voltar", "voltar")],
          ]),
        );
      });

      bot.command("buscar", async (ctx) => {
        if (ctx.chat.id.toString() !== ADMIN_TELEGRAM_ID) return;
        const args = ctx.message.text.split(" ");
        if (args.length < 2) {
          await ctx.reply(" Use: /buscar [nome ou telefone]");
          return;
        }
        const termo = args.slice(1).join(" ");
        try {
          const leads = await Lead.find({
            $or: [
              { nome: { $regex: termo, $options: "i" } },
              { whatsappTelefone: { $regex: termo } },
              { numeroCadastrado: { $regex: termo } },
            ],
          }).limit(10);
          if (leads.length === 0) {
            await ctx.reply(` Nenhum cliente encontrado: "${termo}"`);
            return;
          }
          let lista = ` *RESULTADOS* (${leads.length})\n\n`;
          leads.forEach((l, i) => {
            const telReal = telefoneRealLead(l);
            lista += `${i + 1}.  ${l.nome || "Sem nome"}\n    ${formatarTelefone(telReal) || "Número não informado"}\n    ${new Date(l.ultimaInteracao).toLocaleString()}\n\n`;
          });
          await ctx.reply(lista, { parse_mode: "Markdown" });
        } catch (error) {
          await ctx.reply(" Erro.");
        }
      });

      bot.action("campanha", async (ctx) => {
        await ctx.answerCbQuery();
        await ctx.reply(
          ` *CAMPANHA*\n\nDigite:\n/campanha [mensagem]\n\n*Placeholders:*\n{nome}, {telefone}, {servico}, {rating}\n\n️ Envio para TODOS os leads (sem limite).`,
          Markup.inlineKeyboard([
            [Markup.button.callback(" Voltar", "voltar")],
          ]),
        );
      });

      bot.command("campanha", async (ctx) => {
        if (ctx.chat.id.toString() !== ADMIN_TELEGRAM_ID) return;
        const args = ctx.message.text.split(" ");
        if (args.length < 2) {
          await ctx.reply(" Use: /campanha [mensagem]");
          return;
        }
        const mensagem = args.slice(1).join(" ");

        const total = await Lead.countDocuments();
        if (total === 0) {
          await ctx.reply(" Nenhum cliente.");
          return;
        }

        await ctx.reply(
          ` *Iniciando campanha GLOBAL*\n\n Total: ${total} leads\n️ Delay: ${WHATSAPP_DELAY_MIN}–${WHATSAPP_DELAY_MAX}ms (random)\n\n_Vou te avisar a cada 10 envios._`,
        );

        (async () => {
          const leads = await Lead.find().lean();
          let enviadas = 0,
            falhas = 0;

          for (let i = 0; i < leads.length; i++) {
            const lead = leads[i];
            try {
              if (!sock || waStatus !== "pronto" || !waReady) {
                falhas++;
                continue;
              }

              const numeroReal = telefoneRealLead(lead);
              const destino = numeroReal
                ? `${numeroReal}@c.us`
                : lead.whatsappTelefone || lead.chatId;

              if (
                !destino ||
                (String(destino).includes("@lid") && !numeroReal)
              ) {
                falhas++;
                continue;
              }

              let msg = mensagem
                .replace(/{nome}/g, lead.nome || "Cliente")
                .replace(/{telefone}/g, formatarTelefone(numeroReal) || "N/A")
                .replace(/{servico}/g, lead.tipoServico || "não informado")
                .replace(/{rating}/g, lead.rating || 0);

              await enviarMensagemWhatsApp(destino, msg, lead.jid || null);
              enviadas++;

              if ((i + 1) % 10 === 0) {
                try {
                  await ctx.telegram.sendMessage(
                    ADMIN_TELEGRAM_ID,
                    ` *Progresso:* ${i + 1}/${leads.length}\n Enviadas: ${enviadas}\n Falhas: ${falhas}`,
                  );
                } catch (e) {}
              }

              const delay =
                Math.floor(
                  Math.random() * (WHATSAPP_DELAY_MAX - WHATSAPP_DELAY_MIN + 1),
                ) + WHATSAPP_DELAY_MIN;
              await new Promise((r) => setTimeout(r, delay));
            } catch (e) {
              console.error(` Campanha lead ${lead._id}:`, e.message);
              falhas++;
            }
          }

          try {
            await ctx.telegram.sendMessage(
              ADMIN_TELEGRAM_ID,
              ` *Campanha finalizada!*\n\n Enviadas: ${enviadas}\n Falhas: ${falhas}\n Total: ${leads.length}`,
            );
          } catch (e) {}
        })();

        await ctx.reply(
          `️ _Processando em background. Acompanhe as notificações de progresso._`,
        );
      });

      bot.action("ajuda", async (ctx) => {
        await ctx.answerCbQuery();
        await safeEditMessage(
          ctx,
          ` *AJUDA*\n\n *Comandos:*\n/start - Menu\n/buscar [termo]\n/campanha [msg]\n/status\n\n *WhatsApp:* ${waStatus === "pronto" ? " Conectado" : " Desconectado"}\n *MongoDB:* ${mongoConnected ? " Conectado" : " Desconectado"}`,
          menuPrincipal(),
        );
      });

      bot.command("status", async (ctx) => {
        if (ctx.chat.id.toString() !== ADMIN_TELEGRAM_ID) return;
        try {
          const totalLeads = await Lead.countDocuments();
          const hoje = new Date();
          hoje.setHours(0, 0, 0, 0);
          const novosHoje = await Lead.countDocuments({
            createdAt: { $gte: hoje },
          });
          const cp = await Chamada.countDocuments({ status: "pendente" });
          const ca = await Chamada.countDocuments({ status: "em_andamento" });
          await ctx.replyWithMarkdown(
            ` *Status*\n\n WhatsApp: ${waStatus === "pronto" ? "" : ""}\n MongoDB: ${mongoConnected ? "" : ""}\n Pendentes: ${cp}\n Em andamento: ${ca}\n Total clientes: ${totalLeads}\n Novos hoje: ${novosHoje}\n Uptime: ${Math.floor(process.uptime() / 60)} min`,
          );
        } catch (error) {
          await ctx.reply(" Erro.");
        }
      });

      bot.catch((err) => {
        const desc =
          err?.response?.description || err?.description || err?.message || "";
        if (desc.includes("message is not modified")) return;
        console.error(" Telegraf:", err);
      });

      await bot.launch({ allowedUpdates: ["message", "callback_query"] });
      telegramBot = bot;
      botStatus = "pronto";
      telegramReady = true;
      telegramError = false;
      console.log(" Telegram Bot conectado!");
      console.log(` Seu ID: ${ADMIN_TELEGRAM_ID}`);
      try {
        await bot.telegram.sendMessage(
          ADMIN_TELEGRAM_ID,
          " *Centronic Online!*\n\n WhatsApp:  Conectado\n Bot: @centronictecbot\n\nDigite /start para ver o menu!",
          { parse_mode: "Markdown" },
        );
        console.log(" Boas-vindas Telegram!");
      } catch (error) {
        console.log("️ Boas-vindas:", error.message);
      }
    } catch (error) {
      console.error(" Erro Telegram Bot:", error.message);
      telegramError = true;
      telegramReady = false;
    }
  })();
}

io.on("connection", (socket) => {
  console.log(" Dashboard conectado");
  socket.emit("whatsapp-status", {
    status: waStatus,
    qr: qrCodeData,
    qrImage: qrCodeBase64,
  });
  if (waStatus === "aguardando_qr" && qrCodeData) {
    socket.emit("whatsapp-qr", {
      qr: qrCodeData,
      qrImage: qrCodeBase64,
      qrUrl: `https://api.qrserver.com/v1/create-qr-code/?size=250x2500&data=${encodeURIComponent(qrCodeData)}`,
    });
  }

  socket.on("enviar-mensagem-atendente", async (data) => {
    try {
      const { id, texto } = data;
      if (!sock || waStatus !== "pronto" || !waReady) {
        socket.emit("erro-envio", { mensagem: "WhatsApp não conectado" });
        return;
      }
      const chamada = await Chamada.findById(id);
      if (chamada) {
        await enviarMensagemWhatsApp(
          chamada.telefone,
          texto,
          chamada.jid || null,
        );
        chamada.mensagens.push({
          texto,
          origem: "atendente",
          criadoEm: new Date(),
        });
        await chamada.save();
        io.emit("nova-mensagem-dashboard", {
          id: chamada._id,
          texto,
          origem: "atendente",
        });
        const lead = await Lead.findById(chamada.leadId);
        await notificarTelegram("mensagem_chamada", {
          nome: lead?.nome || "Cliente",
          telefone: lead
            ? formatarTelefone(telefoneRealLead(lead)) || "N/A"
            : "N/A",
          mensagem: texto,
          chamadaId: chamada._id,
        });
        console.log(` CHAT: mensagem enviada.`);
      }
    } catch (error) {
      console.error(" Erro socket atendente:", error);
      socket.emit("erro-envio", { mensagem: error.message });
    }
  });
});

app.get("/status", (req, res) => {
  res.json({
    success: true,
    connection: { online: mongoConnected },
    uptime: process.uptime(),
    whatsapp: { status: waStatus, ready: waReady },
    telegram: { status: botStatus, ready: telegramReady, error: telegramError },
  });
});

app.get("/whatsapp-status", (req, res) => {
  res.json({
    status: waStatus,
    qr: qrCodeData,
    qrImage: qrCodeBase64,
    qrUrl: qrCodeData
      ? `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qrCodeData)}`
      : null,
  });
});

app.get("/whatsapp-qrcode", (req, res) => {
  if (!qrCodeData)
    return res.status(404).json({
      success: false,
      error: "Nenhum QR Code disponível",
      status: waStatus,
    });
  const formato = req.query.formato || "json";
  if (formato === "txt") {
    res.type("text/plain");
    return res.send(qrCodeData);
  }
  if (formato === "png") {
    const pngPath = path.join(__dirname, "qrcode-atual.png");
    if (fs.existsSync(pngPath)) {
      res.type("image/png");
      return res.sendFile(pngPath);
    }
    return res
      .status(404)
      .json({ success: false, error: "PNG não encontrado" });
  }
  res.json({
    success: true,
    status: waStatus,
    qr: qrCodeData,
    qrImage: qrCodeBase64,
  });
});

app.get("/stats", verifyCloudflareAccess, async (req, res) => {
  try {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const [
      totalLeads,
      leadsHoje,
      totalChamadas,
      chamadasPendentes,
      chamadasAtendidas,
      chamadasEmAndamento,
    ] = await Promise.all([
      Lead.countDocuments(),
      Lead.countDocuments({ createdAt: { $gte: hoje } }),
      Chamada.countDocuments(),
      Chamada.countDocuments({ status: "pendente" }),
      Chamada.countDocuments({ status: "atendida" }),
      Chamada.countDocuments({ status: "em_andamento" }),
    ]);
    res.json({
      success: true,
      stats: {
        totalLeads,
        leadsHoje,
        totalChamadas,
        chamadasPendentes,
        chamadasAtendidas,
        chamadasEmAndamento,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get("/leads", verifyCloudflareAccess, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const [leads, total] = await Promise.all([
      Lead.find().sort({ ultimaInteracao: -1 }).limit(limit),
      Lead.countDocuments(),
    ]);
    res.json({ success: true, leads: leads.map(enriquecerLead), total });
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
});

app.get("/lead/:id", verifyCloudflareAccess, async (req, res) => {
  try {
    const lead = await Lead.findById(req.params.id);
    if (!lead)
      return res
        .status(404)
        .json({ success: false, error: "Lead não encontrado" });
    res.json({ success: true, lead: enriquecerLead(lead) });
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
});

app.put("/update-lead/:id", verifyCloudflareAccess, async (req, res) => {
  try {
    const lead = await Lead.findByIdAndUpdate(req.params.id, req.body, {
      returnDocument: "after",
    });
    if (!lead)
      return res
        .status(404)
        .json({ success: false, error: "Lead não encontrado" });
    res.json({ success: true, lead: enriquecerLead(lead) });
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
});

app.post("/update-rating/:id", verifyCloudflareAccess, async (req, res) => {
  try {
    const { rating } = req.body;
    const lead = await Lead.findByIdAndUpdate(
      req.params.id,
      { rating: parseInt(rating) || 0 },
      { returnDocument: "after" },
    );
    res.json({ success: true, lead });
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
});

app.get("/chamadas/pendentes", verifyCloudflareAccess, async (req, res) => {
  try {
    const chamadas = await Chamada.find({ status: "pendente" })
      .sort({ data: -1 })
      .populate("leadId", "nome whatsappTelefone numeroCadastrado jid");
    const resultado = chamadas.map((c) => {
      const obj = c.toObject();
      if (obj.leadId) obj.leadId = enriquecerLead(obj.leadId);
      return obj;
    });
    res.json({ success: true, chamadas: resultado });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get("/chamadas/em-andamento", verifyCloudflareAccess, async (req, res) => {
  try {
    const chamadas = await Chamada.find({ status: "em_andamento" })
      .sort({ data: -1 })
      .populate("leadId", "nome whatsappTelefone numeroCadastrado jid");
    const resultado = chamadas.map((c) => {
      const obj = c.toObject();
      if (obj.leadId) obj.leadId = enriquecerLead(obj.leadId);
      return obj;
    });
    res.json({ success: true, chamadas: resultado });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get("/chamadas/atendidas", verifyCloudflareAccess, async (req, res) => {
  try {
    const chamadas = await Chamada.find({ status: "atendida" })
      .sort({ data: -1 })
      .populate("leadId", "nome whatsappTelefone numeroCadastrado jid");
    const resultado = chamadas.map((c) => {
      const obj = c.toObject();
      if (obj.leadId) obj.leadId = enriquecerLead(obj.leadId);
      return obj;
    });
    res.json({ success: true, chamadas: resultado });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get("/chamadas/todas", verifyCloudflareAccess, async (req, res) => {
  try {
    const chamadas = await Chamada.find()
      .sort({ data: -1 })
      .populate("leadId", "nome whatsappTelefone numeroCadastrado jid");
    const resultado = chamadas.map((c) => {
      const obj = c.toObject();
      if (obj.leadId) obj.leadId = enriquecerLead(obj.leadId);
      return obj;
    });
    res.json({ success: true, chamadas: resultado });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get("/chamada/:id", verifyCloudflareAccess, async (req, res) => {
  try {
    const chamada = await Chamada.findById(req.params.id).populate(
      "leadId",
      "nome whatsappTelefone numeroCadastrado jid",
    );
    if (!chamada)
      return res
        .status(404)
        .json({ success: false, error: "Chamada não encontrada" });
    const obj = chamada.toObject();
    if (obj.leadId) obj.leadId = enriquecerLead(obj.leadId);
    res.json({ success: true, chamada: obj });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get("/chamadas/stats", verifyCloudflareAccess, async (req, res) => {
  try {
    const pendentes = await Chamada.countDocuments({ status: "pendente" });
    const emAndamento = await Chamada.countDocuments({
      status: "em_andamento",
    });
    const atendidas = await Chamada.countDocuments({ status: "atendida" });
    const perdidas = await Chamada.countDocuments({ status: "perdida" });
    res.json({
      success: true,
      stats: { pendentes, emAndamento, atendidas, perdidas },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post("/chamada/criar", verifyCloudflareAccess, async (req, res) => {
  try {
    const { leadId, telefone, nome } = req.body;
    const lead = await Lead.findById(leadId);
    if (!lead)
      return res
        .status(404)
        .json({ success: false, error: "Lead não encontrado" });
    const chamadaExistente = await Chamada.findOne({
      leadId,
      status: { $in: ["pendente", "em_andamento"] },
    });
    if (chamadaExistente)
      return res.json({ success: true, chamada: chamadaExistente });
    const telReal = telefoneRealLead(lead);
    const chamada = new Chamada({
      leadId,
      telefone: telReal ? `${telReal}@c.us` : telefone || lead.whatsappTelefone,
      jid: lead.jid || "",
      nome: nome || lead.nome,
      status: "pendente",
    });
    await chamada.save();
    io.emit("nova-chamada", {
      leadId,
      nome: nome || lead.nome,
      telefone: telReal,
      chamadaId: chamada._id,
    });
    await notificarTelegram("nova_chamada", {
      nome: chamada.nome,
      telefone: formatarTelefone(telReal) || "N/A",
      chamadaId: chamada._id,
      tenant: chamada.tenant || "Direct (WhatsApp)",
      objetivo: "Chamada criada pelo dashboard",
    });
    res.json({ success: true, chamada });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post("/chamada/:id/iniciar", verifyCloudflareAccess, async (req, res) => {
  try {
    const chamada = await Chamada.findByIdAndUpdate(
      req.params.id,
      { status: "em_andamento", atendidaEm: new Date() },
      { returnDocument: "after" },
    ).populate("leadId", "nome whatsappTelefone numeroCadastrado jid");
    if (!chamada)
      return res
        .status(404)
        .json({ success: false, error: "Chamada não encontrada" });
    io.emit("chamada-iniciada", {
      chamadaId: chamada._id,
      leadId: chamada.leadId._id,
    });
    const obj = chamada.toObject();
    if (obj.leadId) obj.leadId = enriquecerLead(obj.leadId);
    res.json({ success: true, chamada: obj });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post("/chamada/:id/finalizar", verifyCloudflareAccess, async (req, res) => {
  try {
    const chamada = await Chamada.findById(req.params.id);
    if (!chamada)
      return res
        .status(404)
        .json({ success: false, error: "Chamada não encontrada" });
    const duracao = chamada.atendidaEm
      ? Math.floor((new Date() - chamada.atendidaEm) / 1000)
      : 0;
    chamada.status = "atendida";
    chamada.duracao = duracao;
    chamada.finalizadaPor = "atendente";
    await chamada.save();
    io.emit("chamada-finalizada", {
      chamadaId: chamada._id,
      motivo: "atendente",
    });

    await retornarAoRobo(chamada, "finalizado_atendente");

    res.json({ success: true, duracao });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post("/testar-notificacao", verifyCloudflareAccess, async (req, res) => {
  try {
    await notificarTelegram("lead_cadastrado", {
      nome: "Teste OK",
      telefone: "(61) 99999-9999",
    });
    res.json({ success: true });
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
});

app.post("/restart", verifyCloudflareAccess, async (req, res) => {
  try {
    waStatus = "desconectado";
    waReady = false;
    reconnectAttempts = 0;
    if (sock) {
      try {
        sock.end(undefined);
      } catch (e) {}
      sock = null;
    }
    setTimeout(iniciarWhatsApp, 2000);
    res.json({ success: true });
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
});

app.get("/ultimas-interacoes", verifyCloudflareAccess, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const filtroTenant = req.query.tenant;

    let leads;
    if (filtroTenant) {
      const leadIds = await Chamada.distinct("leadId", {
        tenant: filtroTenant,
      });
      leads = await Lead.find({ _id: { $in: leadIds } })
        .sort({ ultimaInteracao: -1 })
        .limit(limit);
    } else {
      leads = await Lead.find().sort({ ultimaInteracao: -1 }).limit(limit);
    }

    const interacoes = await Promise.all(
      leads.map(async (l) => {
        const enriquecido = enriquecerLead(l);
        const chamadasDoLead = await Chamada.find({ leadId: l._id })
          .sort({ data: -1 })
          .select("tenant data status")
          .lean();

        const tenantsUsados = [
          ...new Set(chamadasDoLead.map((c) => c.tenant).filter(Boolean)),
        ];
        const ultimaChamada = chamadasDoLead[0];

        return {
          _id: enriquecido._id,
          nome: enriquecido.nome,
          telefone: enriquecido.telefoneReal,
          telefoneFormatado: enriquecido.telefoneFormatado,
          servico: enriquecido.tipoServico,
          tenant: ultimaChamada?.tenant || "realizedb",
          tenantsUsados,
          totalAtendimentos: chamadasDoLead.length,
          status: enriquecido.status,
          rating: enriquecido.rating,
          data: enriquecido.ultimaInteracao,
        };
      }),
    );

    res.json({ success: true, interacoes, total: interacoes.length });
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
});

app.get("/search-leads", verifyCloudflareAccess, async (req, res) => {
  try {
    const query = req.query.q || "";
    const leads = await Lead.find({
      $or: [
        { nome: { $regex: query, $options: "i" } },
        { whatsappTelefone: { $regex: query } },
        { numeroCadastrado: { $regex: query } },
      ],
    }).limit(30);
    res.json({
      success: true,
      leads: leads.map(enriquecerLead),
      total: leads.length,
    });
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
});

app.get(
  "/dashboard/services-distribution",
  verifyCloudflareAccess,
  async (req, res) => {
    try {
      const services = await Lead.aggregate([
        { $match: { tipoServico: { $ne: "" } } },
        { $group: { _id: "$tipoServico", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]);
      res.json({
        success: true,
        data: services.map((s) => ({ service: s._id, count: s.count })),
      });
    } catch (error) {
      res.json({ success: true, data: [] });
    }
  },
);

app.get("/leads-por-servico", verifyCloudflareAccess, async (req, res) => {
  try {
    const servico = req.query.servico || "";
    const leads = await Lead.find({ tipoServico: servico });
    res.json({ success: true, leads: leads.map(enriquecerLead) });
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
});

app.get("/dashboard/timeline", verifyCloudflareAccess, async (req, res) => {
  try {
    const timeline = await Lead.aggregate([
      {
        $group: {
          _id: {
            $dateToString: {
              format: "%Y-%m-%d",
              date: "$createdAt",
              timezone: "America/Sao_Paulo",
            },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
      { $limit: 30 },
    ]);
    res.json({
      success: true,
      data: timeline.map((t) => ({ date: t._id, count: t.count })),
    });
  } catch (error) {
    res.json({ success: true, data: [] });
  }
});

app.get("/dashboard/daily-demand", verifyCloudflareAccess, async (req, res) => {
  try {
    const demand = await Lead.aggregate([
      {
        $group: {
          _id: {
            $dateToString: {
              format: "%Y-%m-%d",
              date: "$ultimaInteracao",
              timezone: "America/Sao_Paulo",
            },
          },
          visits: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
      { $limit: 30 },
    ]);
    res.json({
      success: true,
      data: demand.map((d) => ({ date: d._id, visits: d.visits })),
    });
  } catch (error) {
    res.json({ success: true, data: [] });
  }
});

app.post("/disparar-campanha", verifyCloudflareAccess, async (req, res) => {
  const { ids, mensagemTemplate, todos } = req.body;
  let enviadas = 0,
    falhas = 0;

  let alvos;
  if (todos === true) {
    alvos = await Lead.find().lean();
    console.log(` Campanha GLOBAL: ${alvos.length} leads`);
  } else if (Array.isArray(ids) && ids.length > 0) {
    alvos = await Lead.find({ _id: { $in: ids } }).lean();
    console.log(` Campanha SELETIVA: ${alvos.length} leads`);
  } else {
    return res
      .status(400)
      .json({ success: false, error: "Envie `ids` ou `todos: true`" });
  }

  const total = alvos.length;
  for (let i = 0; i < total; i++) {
    const lead = alvos[i];
    try {
      if (!sock || waStatus !== "pronto" || !waReady) {
        falhas++;
        continue;
      }

      const numeroReal = telefoneRealLead(lead);
      const destino = numeroReal
        ? `${numeroReal}@c.us`
        : lead.whatsappTelefone || lead.chatId;

      if (!destino || (String(destino).includes("@lid") && !numeroReal)) {
        console.warn(`️ Lead ${lead._id} sem número real (só LID). Pulando.`);
        falhas++;
        continue;
      }

      let mensagem = mensagemTemplate
        .replace(/{nome}/g, lead.nome || "Cliente")
        .replace(/{telefone}/g, formatarTelefone(numeroReal) || "N/A")
        .replace(/{servico}/g, lead.tipoServico || "não informado")
        .replace(/{rating}/g, lead.rating || 0);

      await enviarMensagemWhatsApp(destino, mensagem, lead.jid || null);
      enviadas++;

      if ((i + 1) % 10 === 0) {
        console.log(
          ` Campanha: ${i + 1}/${total} (${enviadas} ok, ${falhas} falhas)`,
        );
      }

      const delay =
        Math.floor(
          Math.random() * (WHATSAPP_DELAY_MAX - WHATSAPP_DELAY_MIN + 1),
        ) + WHATSAPP_DELAY_MIN;
      await new Promise((r) => setTimeout(r, delay));
    } catch (e) {
      console.error(` Campanha lead ${lead._id}:`, e.message);
      falhas++;
    }
  }

  console.log(
    ` Campanha finalizada: ${enviadas} enviadas, ${falhas} falhas de ${total}`,
  );
  res.json({ success: true, enviadas, falhas, total });
});

app.get("/admin/menu-imagens", verifyCloudflareAccess, async (req, res) => {
  try {
    const imagens = await ImagemTela.find();
    res.json({ success: true, imagens });
  } catch (e) {
    res.json({ success: false, error: e.message });
  }
});

app.post("/admin/menu-imagens", verifyCloudflareAccess, async (req, res) => {
  try {
    const { tela, legenda, imagemUrl } = req.body;
    if (!tela)
      return res
        .status(400)
        .json({ success: false, error: "tela obrigatória" });
    const atualizada = await ImagemTela.findOneAndUpdate(
      { tela },
      {
        legenda: legenda || "",
        imagemUrl: imagemUrl || "",
        updatedAt: new Date(),
      },
      { upsert: true, returnDocument: "after" },
    );
    res.json({ success: true, imagem: atualizada });
  } catch (e) {
    res.json({ success: false, error: e.message });
  }
});

const PROPORCAO_MOBILE = {
  menu: "1:1 (1080×1080) ou 4:5 (1080×1350)",
  boasvindas: "1:1 (1080×1080)",
  imoveis: "1:1 (1080×1080) ou 4:5 (1080×1350)",
  atendente: "1:1 (1080×1080)",
  menu_entenda: "1:1 (1080×1080)",
};
app.get("/admin/menu-imagens/guia-mobile", (req, res) => {
  res.json({
    success: true,
    regras: {
      proporcao:
        "1:1 (quadrado) ou 4:5 (retrato) — evita corte no WhatsApp mobile",
      resolucao: "1080×1080 ou 1080×1350 px",
      formato: "JPG ou PNG, até 1 MB",
      observacao:
        "Imagens muito largas (16:9) são cortadas na prévia do celular.",
    },
    telas: PROPORCAO_MOBILE,
  });
});

app.post("/admin/migrar-lid", verifyCloudflareAccess, async (req, res) => {
  try {
    const leads = await Lead.find({
      $or: [
        { whatsappTelefone: { $regex: "@lid" } },
        { numeroCadastrado: { $in: ["", null] } },
      ],
    });
    let corrigidos = 0,
      naoCorrigidos = 0;
    const detalhes = [];
    for (const lead of leads) {
      const real = telefoneRealLead(lead);
      if (real && real.length >= 10) {
        if (lead.numeroCadastrado !== real) {
          const antes = lead.numeroCadastrado;
          lead.numeroCadastrado = real;
          await lead.save();
          corrigidos++;
          detalhes.push({ id: lead._id, nome: lead.nome, antes, depois: real });
        }
      } else {
        naoCorrigidos++;
      }
    }
    console.log(
      ` Migração @lid: ${corrigidos} corrigidos, ${naoCorrigidos} sem número recuperável`,
    );
    res.json({
      success: true,
      total: leads.length,
      corrigidos,
      naoCorrigidos,
      detalhes,
    });
  } catch (error) {
    console.error(" /admin/migrar-lid:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

const API_TOKEN_INTERNO = process.env.API_TOKEN_INTERNO || "";
const EXIGIR_TOKEN = process.env.NODE_ENV === "production";

function autenticarApiInterna(req, res, next) {
  if (!EXIGIR_TOKEN) return next();
  const token =
    (req.headers["authorization"] || "").replace("Bearer ", "") ||
    req.query.token;
  if (!API_TOKEN_INTERNO)
    return res
      .status(500)
      .json({ success: false, error: "Servidor mal configurado" });
  if (token !== API_TOKEN_INTERNO)
    return res.status(401).json({ success: false, error: "Não autorizado" });
  next();
}

app.post("/api/conversa/iniciar", autenticarApiInterna, async (req, res) => {
  try {
    const { telefone, nomeCliente, imovelId, mensagemInicial, tenant } =
      req.body;
    const tenantFinal = tenant || "realizedb";
    if (!telefone)
      return res
        .status(400)
        .json({ success: false, error: "telefone obrigatório" });

    const numeroLimpo = soDigitos(telefone);
    if (!numeroLimpo || numeroLimpo.length < 10) {
      return res
        .status(400)
        .json({ success: false, error: "Telefone inválido" });
    }
    const numeroCanon = numeroLimpo.startsWith("55")
      ? numeroLimpo
      : `55${numeroLimpo}`;
    const chatId = `${numeroCanon}@c.us`;

    let lead = await buscarLeadPorIdentificadores({
      chatId,
      numeroCadastrado: numeroCanon,
    });

    if (!lead) {
      lead = new Lead({
        whatsappTelefone: chatId,
        chatId: chatId,
        numeroCadastrado: numeroCanon,
        nome: nomeCliente || "Cliente Imóveis",
        status: "em_atendimento",
        tipoServico: "Imóveis",
      });
      await lead.save();
      console.log(` [Imóveis] Novo lead: ${lead.nome}`);
    } else {
      const numeroAnterior = telefoneRealLead(lead);
      let mudou = false;

      if (numeroCanon && lead.numeroCadastrado !== numeroCanon) {
        console.log(
          ` [Imóveis] Lead ${lead._id}: número ${numeroAnterior || "LID"} → ${numeroCanon}`,
        );
        lead.numeroCadastrado = numeroCanon;
        mudou = true;
      }

      if (String(lead.whatsappTelefone).includes("@lid")) {
        if (!Array.isArray(lead.lids)) lead.lids = [];
        if (!lead.lids.includes(lead.whatsappTelefone)) {
          lead.lids.push(lead.whatsappTelefone);
        }
        lead.whatsappTelefone = chatId;
        lead.chatId = chatId;
        mudou = true;
      }

      if (mudou) await lead.save();
    }

    let conversa = await Chamada.findOne({
      leadId: lead._id,
      tenant: tenantFinal,
      status: { $in: ["pendente", "em_andamento"] },
    });
    if (!conversa) {
      conversa = new Chamada({
        leadId: lead._id,
        telefone: chatId,
        jid: lead.jid || "",
        nome: lead.nome,
        tenant: tenantFinal,
        status: "em_andamento",
        atendidaEm: new Date(),
      });
      await conversa.save();
      await notificarTelegram("nova_chamada", {
        nome: lead.nome,
        telefone: formatarTelefone(numeroCanon) || "N/A",
        chamadaId: conversa._id,
        tenant: tenantFinal,
        objetivo: "Chat do site (visitante)",
      }).catch(() => {});
    }

    if (mensagemInicial && mensagemInicial.trim()) {
      try {
        const matchImg = mensagemInicial.match(/\[IMG\](.+?)\[\/IMG\]/s);
        if (matchImg) {
          const urlImagem = matchImg[1].trim();
          const legenda = mensagemInicial
            .replace(/\[IMG\].+?\[\/IMG\]/s, "")
            .trim();
          try {
            const response = await axios.get(urlImagem, {
              responseType: "arraybuffer",
              timeout: 15000,
            });
            const buffer = Buffer.from(response.data);
            const jid = chatIdParaJid(chatId);
            await sock.sendMessage(jid, {
              image: buffer,
              caption: legenda,
              mimetype: "image/jpeg",
            });
            conversa.mensagens.push({
              texto: legenda,
              origem: "atendente",
              criadoEm: new Date(),
            });
            await conversa.save();
            io.emit(`chamada-mensagem-${conversa._id}`, {
              texto: legenda,
              origem: "atendente",
              criadoEm: new Date(),
            });
          } catch (e) {
            console.warn(
              "️ Falha ao baixar imagem, enviando só texto:",
              e.message,
            );
            const legendaSemImg = mensagemInicial
              .replace(/\[IMG\].+?\[\/IMG\]/s, "")
              .trim();
            await enviarMensagemWhatsApp(
              chatId,
              legendaSemImg,
              lead.jid || null,
            );
            conversa.mensagens.push({
              texto: legendaSemImg,
              origem: "atendente",
              criadoEm: new Date(),
            });
            await conversa.save();
          }
        } else {
          await enviarMensagemWhatsApp(
            chatId,
            mensagemInicial,
            lead.jid || null,
          );
          conversa.mensagens.push({
            texto: mensagemInicial,
            origem: "atendente",
            criadoEm: new Date(),
          });
          await conversa.save();
          io.emit(`chamada-mensagem-${conversa._id}`, {
            texto: mensagemInicial,
            origem: "atendente",
            criadoEm: new Date(),
          });
        }
      } catch (e) {
        console.error(" Erro msg inicial:", e.message);
        return res
          .status(500)
          .json({ success: false, error: "Falha ao enviar pelo WhatsApp" });
      }
    }

    res.json({
      success: true,
      conversaId: conversa._id,
      leadId: lead._id,
      nome: lead.nome,
      telefone: chatId,
      telefoneFormatado: formatarTelefone(numeroCanon),
      imovelId: imovelId || null,
      status: conversa.status,
    });
  } catch (error) {
    console.error(" /api/conversa/iniciar:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get(
  "/api/conversa/:id/mensagens",
  autenticarApiInterna,
  async (req, res) => {
    try {
      const conversa = await Chamada.findById(req.params.id).populate(
        "leadId",
        "nome whatsappTelefone numeroCadastrado jid chatId lids",
      );

      if (!conversa) {
        return res
          .status(404)
          .json({ success: false, error: "Conversa não encontrada" });
      }

      const obj = conversa.toObject();
      const leadEnriquecido = obj.leadId ? enriquecerLead(obj.leadId) : null;

      let telefoneFormatado = "";

      if (leadEnriquecido?.telefoneReal) {
        telefoneFormatado = leadEnriquecido.telefoneFormatado || "";
      }

      if (!telefoneFormatado) {
        const telChamada = formatarTelefone(conversa.telefone);
        if (telChamada) telefoneFormatado = telChamada;
      }

      if (!telefoneFormatado) {
        telefoneFormatado = "Número não informado";
      }

      res.json({
        success: true,
        conversaId: conversa._id,
        nome: conversa.nome || leadEnriquecido?.nome || "Cliente",
        telefone: conversa.telefone,
        telefoneFormatado,
        status: conversa.status,
        mensagens: conversa.mensagens || [],
      });
    } catch (error) {
      console.error(" /api/conversa/:id/mensagens:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  },
);

app.post("/api/conversa/:id/enviar", autenticarApiInterna, async (req, res) => {
  try {
    const { texto, origem } = req.body;
    if (!texto || !texto.trim()) {
      return res
        .status(400)
        .json({ success: false, error: "texto obrigatório" });
    }

    const conversa = await Chamada.findById(req.params.id);
    if (!conversa) {
      return res
        .status(404)
        .json({ success: false, error: "Conversa não encontrada" });
    }

    const origemFinal = ["cliente", "atendente", "bot", "sistema"].includes(
      origem,
    )
      ? origem
      : "cliente";

    conversa.mensagens.push({
      texto: texto.trim(),
      origem: origemFinal,
      criadoEm: new Date(),
    });
    await conversa.save();

    io.emit(`chamada-mensagem-${conversa._id}`, {
      texto: texto.trim(),
      origem: origemFinal,
      criadoEm: new Date(),
    });

    res.json({ success: true });
  } catch (error) {
    console.error(" /api/conversa/:id/enviar:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post("/relatorio", async (req, res) => {
  try {
    const { tipo, ids } = req.body || {};
    const tiposValidos = ["chamadas", "servicos", "agendamentos", "clientes"];

    if (!tipo || !tiposValidos.includes(tipo)) {
      return res
        .status(400)
        .json({ success: false, error: "Tipo de relatório inválido." });
    }

    let dados = [];

    if (tipo === "chamadas") {
      const chamadas = await Chamada.find()
        .sort({ data: -1 })
        .populate("leadId", "nome whatsappTelefone numeroCadastrado jid")
        .lean();
      dados = chamadas.map((c) => ({
        ...c,
        leadId: c.leadId ? enriquecerLead(c.leadId) : null,
      }));
    } else if (tipo === "servicos") {
      const agg = await Lead.aggregate([
        { $match: { tipoServico: { $ne: "" } } },
        { $group: { _id: "$tipoServico", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]);
      dados = agg.map((s) => ({ service: s._id, count: s.count }));
    } else if (tipo === "agendamentos") {
      const leads = await Lead.find({
        "agendamento.data": { $exists: true, $ne: null },
      })
        .sort({ "agendamento.data": 1 })
        .lean();
      dados = leads.map(enriquecerLead);
    } else if (tipo === "clientes") {
      let leads;
      if (Array.isArray(ids) && ids.length > 0) {
        leads = await Lead.find({ _id: { $in: ids } })
          .sort({ ultimaInteracao: -1 })
          .lean();
      } else {
        leads = await Lead.find()
          .sort({ ultimaInteracao: -1 })
          .limit(50)
          .lean();
      }
      dados = leads.map(enriquecerLead);
    }

    res.json({ success: true, tipo, dados, meta: { total: dados.length } });
  } catch (error) {
    console.error(" /relatorio:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "landing", "index.html"));
});
app.get("/landing", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "landing", "index.html"));
});

async function verifyCloudflareAccess(req, res, next) {
  let token = req.headers["cf-access-jwt-assertion"];

  if (!token && req.headers.cookie) {
    const cookies = Object.fromEntries(
      req.headers.cookie.split(";").map((c) => {
        const [k, ...v] = c.trim().split("=");
        return [k, v.join("=")];
      }),
    );
    token = cookies["CF_Authorization"];
  }

  if (!token) {
    return res.status(403).send("Acesso negado: token ausente.");
  }

  try {
    const { payload } = await jwtVerify(token, JWKS, {
      issuer: TEAM_DOMAIN,
      audience: POLICY_AUD,
    });
    if (payload.email !== "vanderlitecnologia@gmail.com") {
      return res.status(403).send("Acesso negado: e-mail não autorizado.");
    }
    req.cfUser = payload;
    next();
  } catch (err) {
    return res.status(403).send("Acesso negado: token inválido ou expirado.");
  }
}

app.get("/admin", verifyCloudflareAccess, (req, res) => {
  res.sendFile(path.join(__dirname, "private", "admin", "index.html"));
});

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "landing", "index.html"));
});

const startServer = async () => {
  try {
    server.listen(PORT, "0.0.0.0", async () => {
      console.log(` Servidor rodando em http://0.0.0.0:${PORT}`);
      console.log(` Autenticação: Cloudflare Access (email + PIN) — borda`);
      iniciarTelegramBot();
      await iniciarWhatsApp();
      console.log(" Sistema inicializado.");
    });
  } catch (err) {
    console.error(" Falha ao iniciar:", err);
  }
};

startServer();

export { io };
