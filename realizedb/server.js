import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import http from 'http';
import { Server as SocketIO } from 'socket.io';
import mongoose from 'mongoose';
import { GridFSBucket } from 'mongodb';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import compression from 'compression';
import helmet from 'helmet';
import stream from 'stream';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const io = new SocketIO(server, {
    cors: { origin: "*", methods: ["GET", "POST"] },
    path: '/socket.io',
    transports: ['websocket', 'polling']
});

const PORT = process.env.PORT || 3001;

const MENSAGERIA_URL = process.env.MENSAGERIA_URL || 'http://'
const MENSAGERIA_TOKEN = process.env.MENSAGERIA_TOKEN || '';
const EXIGIR_TOKEN = process.env.NODE_ENV === 'production';

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
    const maxRequisicoes = 10;

    const registro = rateLimitMap.get(ip) || { count: 0, inicio: agora };

    if (agora - registro.inicio > janela) {
        registro.count = 1;
        registro.inicio = agora;
    } else {
        registro.count++;
    }

    rateLimitMap.set(ip, registro);

    if (registro.count > maxRequisicoes) {
        return res.status(429).json({
            success: false,
            error: 'Muitas requisicoes. Aguarde um momento.'
        });
    }

    next();
}

const MONGODB_URI = process.env.REALIZEDB_MONGODB_URI;

let mongoConnected = false;
let gridFSBucket = null;
let conn = null;

function initGridFS(db) {
    try {
        gridFSBucket = new GridFSBucket(db, {
            bucketName: 'imagens'
        });
        console.log('GridFS inicializado para imagens');
        return gridFSBucket;
    } catch (error) {
        console.error('Erro ao inicializar GridFS:', error.message);
        return null;
    }
}

conn = mongoose.createConnection(MONGODB_URI, {
    maxPoolSize: 20,
    minPoolSize: 5,
    socketTimeoutMS: 45000,
    serverSelectionTimeoutMS: 5000
});

conn.on('connected', () => {
    mongoConnected = true;
    console.log('MongoDB Cluster02 conectado - banco: imoveisdb');
    if (conn.db) {
        initGridFS(conn.db);
    }
});

conn.on('error', (err) => {
    mongoConnected = false;
    console.error('MongoDB erro:', err);
});

conn.on('disconnected', () => {
    mongoConnected = false;
    console.log('MongoDB desconectado');
});

conn.once('open', () => {
    if (conn.db) {
        initGridFS(conn.db);
    }
});

const imovelSchema = new mongoose.Schema({
    titulo: { type: String, required: true, trim: true },
    descricao: { type: String, required: true },
    preco: { type: Number, required: true, min: 0 },
    precoCondominio: { type: Number, default: 0 },
    area: { type: Number, required: true, min: 0 },
    areaConstruida: { type: Number, min: 0 },
    quartos: { type: Number, default: 0 },
    suites: { type: Number, default: 0 },
    banheiros: { type: Number, default: 0 },
    vagas: { type: Number, default: 0 },
    endereco: {
        cep: String,
        logradouro: { type: String, required: true },
        numero: { type: String, required: true },
        complemento: String,
        bairro: { type: String, required: true },
        cidade: { type: String, required: true },
        estado: { type: String, required: true, uppercase: true, maxlength: 2 }
    },
    categoria: {
        type: String,
        enum: ['casa', 'apartamento', 'terreno', 'comercial', 'industrial', 'cobertura'],
        default: 'apartamento'
    },
    status: {
        type: String,
        enum: ['disponivel', 'vendido', 'reservado', 'inativo'],
        default: 'disponivel'
    },
    caracteristicas: [String],
    imagens: [{
        url: String,
        fileId: mongoose.Schema.Types.ObjectId,
        principal: { type: Boolean, default: false }
    }],
    destaque: { type: Boolean, default: false },
    criadoEm: { type: Date, default: Date.now },
    atualizadoEm: { type: Date, default: Date.now }
});

const clienteImobiliarioSchema = new mongoose.Schema({
    centronicLeadId: { type: String, unique: true, sparse: true },
    nome: { type: String, required: true },
    telefone: { type: String, required: true },
    email: { type: String, default: '' },
    preferencias: {
        tipoImovel: [String],
        faixaPreco: { min: Number, max: Number },
        bairros: [String],
        quartos: Number,
        area: Number
    },
    interesses: [{
        imovelId: { type: mongoose.Schema.Types.ObjectId, ref: 'Imovel' },
        data: { type: Date, default: Date.now },
        tipo: { type: String, enum: ['visita', 'info', 'negociacao'], default: 'info' },
        status: { type: String, enum: ['pendente', 'em_andamento', 'finalizado'], default: 'pendente' },
        observacoes: String
    }],
    ultimaInteracao: { type: Date, default: Date.now },
    criadoEm: { type: Date, default: Date.now }
});

const atendimentoSchema = new mongoose.Schema({
    clienteId: { type: mongoose.Schema.Types.ObjectId, ref: 'ClienteImobiliario', required: true },
    status: { type: String, enum: ['pendente', 'em_atendimento', 'finalizado'], default: 'pendente' },
    mensagens: [{
        texto: { type: String, required: true },
        origem: { type: String, enum: ['cliente', 'atendente', 'sistema'], required: true },
        criadoEm: { type: Date, default: Date.now }
    }],
    dataInicio: { type: Date, default: Date.now },
    dataFim: Date,
    atendente: String
});

const Imovel = conn.models.Imovel || conn.model('Imovel', imovelSchema);
const ClienteImobiliario = conn.models.ClienteImobiliario || conn.model('ClienteImobiliario', clienteImobiliarioSchema);
const Atendimento = conn.models.Atendimento || conn.model('Atendimento', atendimentoSchema);

const IMAGENS_REAIS = {
    'casa': [
        'https://',
        'https://',
        'https://'
    ],
    'apartamento': [
        'https://',
        'https://',
        'https://'
    ],
    'terreno': [
        'https://',
        'https://',
        'https://'
    ],
    'cobertura': [
        'https://',
        'https://'
    ]
};

async function criarImoveisComImagensReais() {
    try {
        const count = await Imovel.countDocuments();
        console.log(`Imoveis existentes: ${count}`);
        
        if (count === 0) {
            console.log('Criando imoveis com imagens reais...');

            const imoveisExemplo = [
                {
                    titulo: 'Casa Moderna com 3 Quartos e Piscina',
                    descricao: 'Casa ampla com area de lazer, churrasqueira e piscina aquecida. Otima localizacao, proxima a comercios e escolas.',
                    preco: 450000,
                    precoCondominio: 150,
                    area: 120,
                    areaConstruida: 180,
                    quartos: 3,
                    suites: 1,
                    banheiros: 2,
                    vagas: 2,
                    endereco: {
                        cep: '72146206',
                        logradouro: 'QNM 42',
                        numero: '42',
                        complemento: 'Conjunto F',
                        bairro: 'Taguatinga Norte',
                        cidade: 'Brasilia',
                        estado: 'DF'
                    },
                    categoria: 'casa',
                    status: 'disponivel',
                    caracteristicas: ['Piscina', 'Churrasqueira', 'Area de lazer', 'Garagem'],
                    imagens: [{ url: IMAGENS_REAIS.casa[0], principal: true }],
                    destaque: true
                },
                {
                    titulo: 'Apartamento 2 quartos com Varanda Gourmet',
                    descricao: 'Apartamento moderno com varanda gourmet, vista panoramica e acabamento de alto padrao.',
                    preco: 320000,
                    precoCondominio: 350,
                    area: 85,
                    quartos: 2,
                    suites: 0,
                    banheiros: 1,
                    vagas: 1,
                    endereco: {
                        cep: '72146206',
                        logradouro: 'QNM 38',
                        numero: '15',
                        complemento: 'Bloco A',
                        bairro: 'Taguatinga Norte',
                        cidade: 'Brasilia',
                        estado: 'DF'
                    },
                    categoria: 'apartamento',
                    status: 'disponivel',
                    caracteristicas: ['Varanda gourmet', 'Vista panoramica', 'Elevador', 'Academia'],
                    imagens: [{ url: IMAGENS_REAIS.apartamento[0], principal: true }],
                    destaque: true
                },
                {
                    titulo: 'Terreno 500m em Condominio Fechado',
                    descricao: 'Terreno plano com escritura regularizada, infraestrutura completa (agua, luz, esgoto) e seguranca 24h.',
                    preco: 280000,
                    area: 500,
                    endereco: {
                        cep: '72146206',
                        logradouro: 'Setor Residencial Sul',
                        numero: 'S/N',
                        bairro: 'Taguatinga Sul',
                        cidade: 'Brasilia',
                        estado: 'DF'
                    },
                    categoria: 'terreno',
                    status: 'disponivel',
                    caracteristicas: ['Condominio fechado', 'Escritura regularizada', 'Infraestrutura completa'],
                    imagens: [{ url: IMAGENS_REAIS.terreno[0], principal: true }],
                    destaque: false
                }
            ];

            await Imovel.insertMany(imoveisExemplo);
            console.log(`${imoveisExemplo.length} imoveis com imagens reais criados!`);
        } else {
            console.log('Imoveis ja existentes, pulando criacao.');
        }
    } catch (error) {
        console.error('Erro ao criar imoveis:', error.message);
    }
}

async function uploadImage(filename, buffer, contentType = 'image/jpeg') {
    if (!gridFSBucket) {
        throw new Error('GridFS nao inicializado. Aguarde a conexao com o MongoDB.');
    }
    
    return new Promise((resolve, reject) => {
        const uploadStream = gridFSBucket.openUploadStream(filename, {
            contentType: contentType,
            metadata: {
                uploadDate: new Date(),
                originalName: filename
            }
        });

        const bufferStream = new stream.PassThrough();
        bufferStream.end(buffer);

        bufferStream.pipe(uploadStream)
            .on('error', reject)
            .on('finish', () => {
                resolve({
                    fileId: uploadStream.id,
                    filename: filename,
                    contentType: contentType
                });
            });
    });
}

async function getImage(fileId) {
    if (!gridFSBucket) {
        throw new Error('GridFS nao inicializado');
    }
    
    return new Promise((resolve, reject) => {
        const downloadStream = gridFSBucket.openDownloadStream(fileId);
        const chunks = [];
        
        downloadStream.on('data', (chunk) => chunks.push(chunk));
        downloadStream.on('error', reject);
        downloadStream.on('end', () => {
            resolve({
                buffer: Buffer.concat(chunks),
                contentType: downloadStream.contentType || 'image/jpeg'
            });
        });
    });
}

async function getImageByFilename(filename) {
    if (!gridFSBucket) {
        throw new Error('GridFS nao inicializado');
    }
    
    const files = await gridFSBucket.find({ filename }).toArray();
    if (files.length === 0) {
        throw new Error('Imagem nao encontrada');
    }
    return getImage(files[0]._id);
}

app.use(helmet({ 
    contentSecurityPolicy: false, 
    crossOriginEmbedderPolicy: false 
}));
app.use(compression());
app.use(cors({ 
    origin: '*', 
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use(express.static(path.join(__dirname, 'dist'), { 
    maxAge: '1y', 
    etag: true 
}));

app.get('/api/imagem/:id', async (req, res) => {
    try {
        if (!gridFSBucket) {
            return res.status(503).json({ success: false, error: 'GridFS nao disponivel' });
        }
        
        const fileId = new mongoose.Types.ObjectId(req.params.id);
        const image = await getImage(fileId);
        
        res.setHeader('Content-Type', image.contentType);
        res.send(image.buffer);
    } catch (error) {
        res.status(404).json({ success: false, error: 'Imagem nao encontrada' });
    }
});

app.get('/api/imagem/nome/:filename', async (req, res) => {
    try {
        if (!gridFSBucket) {
            const svg = `<svg xmlns="http:
                <rect width="400" height="300" fill="#dfe6e9"/>
                <text x="200" y="160" font-family="Arial" font-size="48" text-anchor="middle">Casa</text>
                <text x="200" y="190" font-family="Arial" font-size="14" fill="#b2bec3" text-anchor="middle">Carregando...</text>
            </svg>`;
            res.setHeader('Content-Type', 'image/svg+xml');
            return res.send(svg);
        }
        
        const filename = req.params.filename;
        console.log(`Buscando imagem: ${filename}`);
        
        const files = await gridFSBucket.find({ filename }).toArray();
        
        if (files.length === 0) {
            if (filename !== 'default.jpg') {
                const defaultFiles = await gridFSBucket.find({ filename: 'default.jpg' }).toArray();
                if (defaultFiles.length > 0) {
                    const image = await getImage(defaultFiles[0]._id);
                    res.setHeader('Content-Type', image.contentType);
                    return res.send(image.buffer);
                }
            }
            
            const svg = `<svg xmlns="http:
                <rect width="400" height="300" fill="#dfe6e9"/>
                <text x="200" y="160" font-family="Arial" font-size="48" text-anchor="middle">Casa</text>
                <text x="200" y="190" font-family="Arial" font-size="14" fill="#b2bec3" text-anchor="middle">Imagem nao encontrada</text>
            </svg>`;
            res.setHeader('Content-Type', 'image/svg+xml');
            return res.send(svg);
        }
        
        const file = files[0];
        const image = await getImage(file._id);
        
        res.setHeader('Content-Type', image.contentType);
        res.send(image.buffer);
        
    } catch (error) {
        console.error('Erro ao buscar imagem:', error.message);
        const svg = `<svg xmlns="http:
            <rect width="400" height="300" fill="#dfe6e9"/>
            <text x="200" y="160" font-family="Arial" font-size="48" text-anchor="middle">Casa</text>
            <text x="200" y="190" font-family="Arial" font-size="14" fill="#b2bec3" text-anchor="middle">Erro ao carregar</text>
        </svg>`;
        res.setHeader('Content-Type', 'image/svg+xml');
        res.send(svg);
    }
});

app.get('/api/imagens', async (req, res) => {
    try {
        if (!gridFSBucket) {
            return res.status(503).json({ success: false, error: 'GridFS nao disponivel' });
        }
        
        const files = await gridFSBucket.find({}).toArray();
        res.json({ 
            success: true, 
            total: files.length,
            imagens: files.map(f => ({
                id: f._id,
                filename: f.filename,
                contentType: f.contentType,
                length: f.length,
                uploadDate: f.uploadDate
            }))
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/health', (req, res) => {
    res.json({
        success: true,
        mongodb: mongoConnected,
        gridfs: !!gridFSBucket,
        database: 'imoveisdb',
        uptime: process.uptime()
    });
});

app.get('/api/imoveis', async (req, res) => {
    try {
        const { categoria, cidade, precoMin, precoMax, quartos, destaque, limite = 20 } = req.query;
        const filtro = { status: 'disponivel' };
        if (categoria) filtro.categoria = categoria;
        if (cidade) filtro['endereco.cidade'] = { $regex: cidade, $options: 'i' };
        if (quartos) filtro.quartos = parseInt(quartos);
        if (destaque === 'true') filtro.destaque = true;
        if (precoMin || precoMax) {
            filtro.preco = {};
            if (precoMin) filtro.preco.$gte = parseFloat(precoMin);
            if (precoMax) filtro.preco.$lte = parseFloat(precoMax);
        }

        const imoveis = await Imovel.find(filtro)
            .sort({ destaque: -1, criadoEm: -1 })
            .limit(parseInt(limite));

        const imoveisComImagens = imoveis.map(imovel => {
            const imgs = imovel.imagens || [];
            const principal = imgs.find(img => img.principal) || imgs[0];
            
            let imagemPrincipal = '/api/imagem/nome/default.jpg';
            if (principal) {
                if (principal.fileId) {
                    imagemPrincipal = `/api/imagem/${principal.fileId}`;
                } else if (principal.url) {
                    imagemPrincipal = principal.url;
                }
            }
            
            return {
                ...imovel.toObject(),
                imagemPrincipal
            };
        });

        res.json({ success: true, imoveis: imoveisComImagens, total: imoveis.length });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/imoveis/destaque', async (req, res) => {
    try {
        const imoveis = await Imovel.find({ status: 'disponivel', destaque: true })
            .limit(6).sort({ criadoEm: -1 });

        const imoveisComImagens = imoveis.map(imovel => {
            const imgs = imovel.imagens || [];
            const principal = imgs.find(img => img.principal) || imgs[0];
            let imagemPrincipal = '/api/imagem/nome/default.jpg';
            if (principal) {
                if (principal.fileId) {
                    imagemPrincipal = `/api/imagem/${principal.fileId}`;
                } else if (principal.url) {
                    imagemPrincipal = principal.url;
                }
            }
            return {
                ...imovel.toObject(),
                imagemPrincipal
            };
        });

        res.json({ success: true, imoveis: imoveisComImagens });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/interesse', async (req, res) => {
    try {
        const { clienteId, imovelId, tipo, observacoes } = req.body;
        let cliente = clienteId ? await ClienteImobiliario.findById(clienteId) : 
            new ClienteImobiliario({ nome: 'Visitante', telefone: 'visitante' });

        if (!cliente) {
            return res.status(404).json({ success: false, error: 'Cliente nao encontrado' });
        }

        if (!cliente._id) {
            await cliente.save();
        }

        cliente.interesses.push({ 
            imovelId, 
            tipo: tipo || 'info', 
            status: 'pendente', 
            observacoes 
        });
        cliente.ultimaInteracao = new Date();
        await cliente.save();

        const atendimento = new Atendimento({
            clienteId: cliente._id,
            status: 'pendente',
            mensagens: [{ 
                texto: `Novo interesse: ${tipo || 'info'} no imovel`, 
                origem: 'sistema' 
            }]
        });
        await atendimento.save();

        io.emit('novo-interesse', { clienteId: cliente._id, imovelId, tipo });
        res.json({ success: true, cliente, atendimentoId: atendimento._id });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

io.on('connection', (socket) => {
    console.log('Cliente RealizeDB conectado');

    socket.on('registrar-cliente-imobiliario', async (data) => {
        try {
            const { nome, imovelId, mensagemInicial } = data;
            const cliente = new ClienteImobiliario({ 
                nome: nome || 'Visitante', 
                telefone: 'visitante' 
            });
            await cliente.save();

            if (imovelId) {
                cliente.interesses.push({ 
                    imovelId, 
                    tipo: 'info', 
                    status: 'pendente' 
                });
                await cliente.save();
            }

            const atendimento = new Atendimento({
                clienteId: cliente._id,
                status: 'pendente',
                mensagens: [{ 
                    texto: mensagemInicial || 'Iniciou atendimento', 
                    origem: 'cliente' 
                }]
            });
            await atendimento.save();

            socket.emit('cliente-registrado', { 
                clienteId: cliente._id, 
                atendimentoId: atendimento._id 
            });
            socket.join(`cliente-${cliente._id}`);
            console.log(`Cliente registrado: ${cliente.nome}`);
        } catch (error) {
            socket.emit('erro-registro', { mensagem: error.message });
        }
    });

    socket.on('mensagem-cliente-imobiliario', async (data) => {
        try {
            const { clienteId, mensagem } = data;
            const atendimento = await Atendimento.findOne({ 
                clienteId, 
                status: { $in: ['pendente', 'em_atendimento'] } 
            });
            if (atendimento) {
                atendimento.mensagens.push({ 
                    texto: mensagem, 
                    origem: 'cliente', 
                    criadoEm: new Date() 
                });
                await atendimento.save();
                io.emit('nova-mensagem-atendimento', { 
                    atendimentoId: atendimento._id, 
                    clienteId, 
                    mensagem, 
                    origem: 'cliente' 
                });
                socket.emit('mensagem-enviada', { clienteId, mensagem });
            }
        } catch (error) {
            console.error('Erro ao enviar mensagem:', error);
        }
    });

    socket.on('disconnect', () => {
        console.log('Cliente RealizeDB desconectado');
    });
});

app.post('/api/chat/iniciar', async (req, res) => {
    try {
        const { telefone, nomeCliente, imovelId, mensagemInicial } = req.body;

        if (!telefone || !nomeCliente) {
            return res.status(400).json({
                success: false,
                error: 'Nome e telefone sao obrigatorios'
            });
        }

        let imovelTitulo = '';
        if (imovelId) {
            try {
                const imovel = await Imovel.findById(imovelId);
                if (imovel) imovelTitulo = imovel.titulo;
            } catch (e) { }
        }

        const msgFinal = mensagemInicial || (
            `Ola! Tenho interesse no imovel: *${imovelTitulo || 'informacoes'}*`
        );

        const resp = await fetch(`${MENSAGERIA_URL}/api/conversa/iniciar`, {
            method: 'POST',
            headers: headersControladora(),
            body: JSON.stringify({
                telefone,
                nomeCliente,
                imovelId: imovelId ? String(imovelId) : null,
                mensagemInicial: msgFinal
            })
        });

        const data = await resp.json();

        if (!data.success) {
            return res.status(resp.status).json(data);
        }

        try {
            const clienteExistente = await ClienteImobiliario.findOne({ telefone });
            if (!clienteExistente) {
                const novo = new ClienteImobiliario({
                    nome: nomeCliente,
                    telefone,
                    centronicLeadId: String(data.leadId || '')
                });
                if (imovelId) {
                    novo.interesses.push({ imovelId, tipo: 'info', status: 'pendente' });
                }
                await novo.save();
            } else if (imovelId) {
                clienteExistente.interesses.push({ imovelId, tipo: 'info', status: 'pendente' });
                clienteExistente.ultimaInteracao = new Date();
                await clienteExistente.save();
            }
        } catch (e) {
            console.warn('Aviso: cliente local nao registrado:', e.message);
        }

        res.json({
            success: true,
            conversaId: data.conversaId,
            leadId: data.leadId,
            imovelTitulo
        });

    } catch (error) {
        console.error('/api/chat/iniciar:', error);
        res.status(500).json({ success: false, error: 'Falha ao conectar com atendimento' });
    }
});

app.get('/api/chat/:conversaId/mensagens', async (req, res) => {
    try {
        const resp = await fetch(`${MENSAGERIA_URL}/api/conversa/${req.params.conversaId}/mensagens`, {
            headers: headersControladora()
        });
        const data = await resp.json();
        res.json(data);
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/chat/:conversaId/mensagem', async (req, res) => {
    try {
        const { texto } = req.body;
        if (!texto || !texto.trim()) {
            return res.status(400).json({ success: false, error: 'Mensagem vazia' });
        }

        const resp = await fetch(`${MENSAGERIA_URL}/api/conversa/${req.params.conversaId}/enviar`, {
            method: 'POST',
            headers: headersControladora(),
            body: JSON.stringify({ texto })
        });

        const data = await resp.json();
        res.status(resp.status).json(data);

    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

const startServer = async () => {
    try {
        server.listen(PORT, '0.0.0.0', async () => {
            console.log('RealizeDB - Plataforma Imobiliaria');
            console.log(`API: http://`);
            console.log(`Socket.IO: http://`);
            console.log(`Banco: imoveisdb`);
            console.log(`GridFS: ${gridFSBucket ? 'Ativo' : 'Aguardando...'}`);

            let attempts = 0;
            while (!gridFSBucket && attempts < 10) {
                await new Promise(resolve => setTimeout(resolve, 1000));
                attempts++;
            }

            await criarImoveisComImagensReais();

            console.log('RealizeDB inicializado completamente!');
        });
    } catch (err) {
        console.error('Falha ao iniciar servidor:', err);
    }
};

startServer();

export { io, conn };
