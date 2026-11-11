const express = require('express');
const crypto = require('crypto');

const router = express.Router();

const ROBOCV_API_URL = (process.env.ROBOCV_API_URL || '').replace(/\/+$/, '');
const ROBOCV_API_TOKEN = (process.env.ROBOCV_API_TOKEN || '').trim();

const DURACAO_SESSAO = 8 * 60 * 60;
const CHAVE_SESSAO = ROBOCV_API_TOKEN
  ? crypto.createHash('sha256')
      .update(`CENTRONICTEC_CHAT_SESSION:${ROBOCV_API_TOKEN}`)
      .digest()
  : null;

async function chamarRoboCV(caminho, opcoes = {}) {
  if (!ROBOCV_API_URL || !ROBOCV_API_TOKEN) {
    throw new Error('Integração com o atendimento não está configurada.');
  }

  const response = await fetch(`${ROBOCV_API_URL}${caminho}`, {
    ...opcoes,
    signal: AbortSignal.timeout(15000),
    headers: {
      Authorization: `Bearer ${ROBOCV_API_TOKEN}`,
      'Content-Type': 'application/json',
      ...opcoes.headers,
    },
  });

  const resultado = await response.json().catch(() => ({}));

  if (!response.ok) {
    const erro = new Error(
      response.status >= 500
        ? 'O serviço de atendimento está temporariamente indisponível.'
        : resultado.error || 'Não foi possível concluir a solicitação.'
    );
    erro.status = response.status;
    throw erro;
  }

  return resultado;
}

function criarTokenSessao(conversaId) {
  const payload = Buffer.from(JSON.stringify({
    sub: String(conversaId),
    exp: Math.floor(Date.now() / 1000) + DURACAO_SESSAO,
  })).toString('base64url');

  const assinatura = crypto
    .createHmac('sha256', CHAVE_SESSAO)
    .update(payload)
    .digest('base64url');

  return `${payload}.${assinatura}`;
}

function autenticarSessao(req, res, next) {
  try {
    if (!CHAVE_SESSAO) {
      return res.status(503).json({
        success: false,
        error: 'Atendimento temporariamente indisponível.',
      });
    }

    const authorization = req.headers.authorization || '';
    const match = /^Bearer\s+(.+)$/i.exec(authorization);

    if (!match) {
      return res.status(401).json({
        success: false,
        error: 'Sessão de atendimento não informada.',
      });
    }

    const partes = match[1].split('.');
    if (partes.length !== 2) {
      return res.status(401).json({
        success: false,
        error: 'Sessão de atendimento inválida.',
      });
    }

    const [payload, assinaturaRecebida] = partes;
    const assinaturaEsperada = crypto
      .createHmac('sha256', CHAVE_SESSAO)
      .update(payload)
      .digest();

    const assinaturaInformada = Buffer.from(
      assinaturaRecebida,
      'base64url'
    );

    if (
      assinaturaInformada.length !== assinaturaEsperada.length ||
      !crypto.timingSafeEqual(assinaturaInformada, assinaturaEsperada)
    ) {
      return res.status(401).json({
        success: false,
        error: 'Sessão de atendimento inválida.',
      });
    }

    const dados = JSON.parse(
      Buffer.from(payload, 'base64url').toString('utf8')
    );

    if (
      !dados.sub ||
      !Number.isInteger(dados.exp) ||
      dados.exp <= Math.floor(Date.now() / 1000) ||
      dados.sub !== req.params.id
    ) {
      return res.status(401).json({
        success: false,
        error: 'Sessão expirada ou não corresponde a esta conversa.',
      });
    }

    next();
  } catch {
    return res.status(401).json({
      success: false,
      error: 'Sessão de atendimento inválida.',
    });
  }
}

function tratarErro(res, error) {
  if (error.name === 'TimeoutError' || error.name === 'AbortError') {
    return res.status(504).json({
      success: false,
      error: 'O atendimento demorou para responder. Tente novamente.',
    });
  }

  if (error.status >= 400 && error.status < 500) {
    return res.status(error.status).json({
      success: false,
      error: error.message,
    });
  }

  if (error.status >= 500) {
    return res.status(502).json({
      success: false,
      error: 'O serviço de atendimento está temporariamente indisponível.',
    });
  }

  console.error('Erro na integração com RoboCV:', error.message);

  return res.status(500).json({
    success: false,
    error: 'Não foi possível acessar o atendimento.',
  });
}

router.post('/solicitar-codigo', async (req, res) => {
  try {
    const telefone = typeof req.body.telefone === 'string'
      ? req.body.telefone.replace(/\D/g, '')
      : '';

    if (telefone.length < 10 || telefone.length > 13) {
      return res.status(400).json({
        success: false,
        error: 'Informe um telefone brasileiro válido com DDD.',
      });
    }

    const resultado = await chamarRoboCV('/api/otp/enviar', {
      method: 'POST',
      body: JSON.stringify({ telefone }),
    });

    return res.status(200).json(resultado);
  } catch (error) {
    return tratarErro(res, error);
  }
});

router.post('/confirmar-codigo', async (req, res) => {
  try {
    const telefone = typeof req.body.telefone === 'string'
      ? req.body.telefone.replace(/\D/g, '')
      : '';
    const codigo = typeof req.body.codigo === 'string'
      ? req.body.codigo.trim()
      : '';

    if (
      telefone.length < 10 ||
      telefone.length > 13 ||
      !/^\d{6}$/.test(codigo)
    ) {
      return res.status(400).json({
        success: false,
        error: 'Confira o telefone e o código de seis dígitos.',
      });
    }

    const resultado = await chamarRoboCV('/api/otp/confirmar', {
      method: 'POST',
      body: JSON.stringify({ telefone, codigo }),
    });

    if (!resultado.success || typeof resultado.ticket !== 'string' || !resultado.ticket) {
      return res.status(502).json({
        success: false,
        error: 'A confirmação não retornou uma autorização válida.',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Telefone confirmado com sucesso.',
      otpTicket: resultado.ticket,
    });
  } catch (error) {
    return tratarErro(res, error);
  }
});

router.post('/iniciar', async (req, res) => {
  try {
    const nome = typeof req.body.nome === 'string' ? req.body.nome.trim() : '';
    const telefone = typeof req.body.telefone === 'string'
      ? req.body.telefone.replace(/\D/g, '')
      : '';

    if (!nome || !telefone) {
      return res.status(400).json({
        success: false,
        error: 'Nome e telefone são obrigatórios para iniciar o atendimento.',
      });
    }

    const otpTicket = typeof req.body.otpTicket === 'string'
      ? req.body.otpTicket.trim()
      : '';

    if (
      nome.length > 120 ||
      telefone.length < 10 ||
      telefone.length > 13 ||
      !otpTicket ||
      otpTicket.length > 200
    ) {
      return res.status(400).json({
        success: false,
        error: 'Confira o nome, o telefone e a confirmação do número.',
      });
    }

    const resultado = await chamarRoboCV('/api/conversa/iniciar', {
      method: 'POST',
      body: JSON.stringify({
        nomeCliente: nome,
        telefone,
        otpTicket,
      }),
    });

    if (!resultado.success || !resultado.conversaId) {
      return res.status(502).json({
        success: false,
        error: 'O atendimento não retornou uma conversa válida.',
      });
    }

    return res.status(200).json({
      ...resultado,
      sessionToken: criarTokenSessao(resultado.conversaId),
      expiresIn: DURACAO_SESSAO,
    });
  } catch (error) {
    return tratarErro(res, error);
  }
});

router.get('/:id/mensagens', autenticarSessao, async (req, res) => {
  try {
    const { id } = req.params;

    if (!/^[a-f\d]{24}$/i.test(id)) {
      return res.status(400).json({
        success: false,
        error: 'Identificador de conversa inválido.',
      });
    }

    const resultado = await chamarRoboCV(
      `/api/conversa/${encodeURIComponent(id)}/mensagens`
    );

    return res.json(resultado);
  } catch (error) {
    return tratarErro(res, error);
  }
});

router.post('/:id/enviar', autenticarSessao, async (req, res) => {
  try {
    const { id } = req.params;
    const texto = typeof req.body.texto === 'string' ? req.body.texto.trim() : '';

    if (!/^[a-f\d]{24}$/i.test(id)) {
      return res.status(400).json({
        success: false,
        error: 'Identificador de conversa inválido.',
      });
    }

    if (!texto || texto.length > 4000) {
      return res.status(400).json({
        success: false,
        error: 'A mensagem deve conter entre 1 e 4000 caracteres.',
      });
    }

    const resultado = await chamarRoboCV(
      `/api/conversa/${encodeURIComponent(id)}/enviar`,
      {
        method: 'POST',
        body: JSON.stringify({ texto, origem: 'cliente' }),
      }
    );

    return res.json(resultado);
  } catch (error) {
    return tratarErro(res, error);
  }
});

module.exports = router;
