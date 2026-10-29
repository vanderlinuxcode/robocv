import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PORT = process.env.PORT || 3002;
const MENSAGERIA_URL = process.env.MENSAGERIA_URL || 'https:';
const MENSAGERIA_TOKEN = process.env.MENSAGERIA_TOKEN || '';
const TENANT = process.env.TENANT || 'telemedica';

const app = express();
app.use(express.json({ limit: '1mb' }));
app.use(cors());


function headersControladora() {
    const h = { 'Content-Type': 'application/json' };
    if (MENSAGERIA_TOKEN) {
        h['Authorization'] = `Bearer ${MENSAGERIA_TOKEN}`;
    }
    return h;
}


const rateLimitMap = new Map();
function rateLimit(req, res, next) {
    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    const agora = Date.now();
    const janela = 60 * 1000;
    const max = 10;
    const registros = (rateLimitMap.get(ip) || []).filter(t => agora - t < janela);
    if (registros.length >= max) {
        return res.status(429).json({ success: false, error: 'Muitas requisições. Tente novamente em instantes.' });
    }
    registros.push(agora);
    rateLimitMap.set(ip, registros);
    next();
}


app.post('/api/chat/iniciar', rateLimit, async (req, res) => {
    try {
        const { telefone, nomeCliente, imovelId, mensagemInicial } = req.body;

        if (!telefone || !nomeCliente) {
            return res.status(400).json({ success: false, error: 'Nome e telefone são obrigatórios' });
        }

        const resp = await fetch(`${MENSAGERIA_URL}/api/conversa/iniciar`, {
            method: 'POST',
            headers: headersControladora(),
            body: JSON.stringify({
                telefone,
                nomeCliente,
                imovelId: imovelId ? String(imovelId) : null,
                mensagemInicial: mensagemInicial || 'Olá! Gostaria de mais informações.',
                tenant: TENANT,
            }),
        });

        const data = await resp.json();
        res.status(resp.status).json(data);
    } catch (error) {
        console.error('/api/chat/iniciar:', error);
        res.status(500).json({ success: false, error: 'Falha ao conectar com atendimento' });
    }
});

app.get('/api/chat/:conversaId/mensagens', rateLimit, async (req, res) => {
    try {
        const resp = await fetch(
            `${MENSAGERIA_URL}/api/conversa/${req.params.conversaId}/mensagens?tenant=${TENANT}`,
            { headers: headersControladora() }
        );
        const data = await resp.json();
        res.status(resp.status).json(data);
    } catch (error) {
        console.error('/api/chat/mensagens:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/chat/:conversaId/mensagem', rateLimit, async (req, res) => {
    try {
        const { texto } = req.body;
        if (!texto || !texto.trim()) {
            return res.status(400).json({ success: false, error: 'Mensagem vazia' });
        }

        const resp = await fetch(`${MENSAGERIA_URL}/api/conversa/${req.params.conversaId}/enviar`, {
            method: 'POST',
            headers: headersControladora(),
            body: JSON.stringify({ texto, tenant: TENANT }),
        });

        const data = await resp.json();
        res.status(resp.status).json(data);
    } catch (error) {
        console.error('/api/chat/mensagem:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});


app.get('/api/health', (req, res) => {
    res.json({ success: true, app: 'telemedica-proxy', tenant: TENANT, uptime: process.uptime() });
});


const distPath = path.join(__dirname, 'dist');
app.use(express.static(distPath));


app.get('*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
});


app.listen(PORT, '0.0.0.0', () => {
    console.log(`Telemedica Cães proxy rodando na porta ${PORT}`);
    console.log(`   → Robocv: ${MENSAGERIA_URL}`);
    console.log(`   → Tenant: ${TENANT}`);
    console.log(`   → Token configurado: ${MENSAGERIA_TOKEN ? 'sim' : 'NÃO'}`);
});
