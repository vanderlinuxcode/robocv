require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');

const connectDatabase = require('./config/database');
const healthRoute = require('./routes/health');
const chatRoute = require('./routes/chat');

const app = express();
const PORT = process.env.PORT || 3003;

const DIST_DIR = path.resolve(__dirname, '../dist');

const origensPermitidas = new Set([
  'https://ti.centronictec.com.br',
  'http://localhost:8081',
  'http://localhost:19006',
]);

app.use(cors({
  origin(origin, callback) {
    if (!origin || origensPermitidas.has(origin)) {
      return callback(null, true);
    }

    return callback(new Error('Origem não autorizada pelo CORS.'));
  },
}));

app.use(express.json({ limit: '100kb' }));

// API
app.use('/api', healthRoute);
app.use('/api/chat', chatRoute);

// Retorna JSON para rotas inexistentes da API
app.use('/api', (req, res) => {
  res.status(404).json({
    status: 'error',
    message: 'Rota da API não encontrada.',
  });
});

// Arquivos estáticos do Expo
app.use(express.static(DIST_DIR));

// Fallback para navegação do Expo Router
app.get('/{*splat}', (req, res) => {
  res.sendFile(path.join(DIST_DIR, 'index.html'));
});

// Inicialização
async function startServer() {
  try {
    await connectDatabase();

    app.listen(PORT, '0.0.0.0', () => {
      console.log(`CENTRONICTEC API e FRONTEND rodando na porta ${PORT}`);
      console.log(`Frontend: ${DIST_DIR}`);
    });
  } catch (error) {
    console.error('Erro ao iniciar o servidor:', error.message);
    process.exit(1);
  }
}

startServer();
