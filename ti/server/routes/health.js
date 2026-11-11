const express = require('express');
const mongoose = require('mongoose');

const router = express.Router();

router.get('/health', (req, res) => {
  const databaseStates = {
    0: 'desconectado',
    1: 'conectado',
    2: 'conectando',
    3: 'desconectando',
  };

  const databaseStatus =
    databaseStates[mongoose.connection.readyState] || 'desconhecido';

  res.status(200).json({
    status: 'ok',
    server: 'CENTRONICTEC API',
    database: databaseStatus,
    timestamp: new Date().toISOString(),
  });
});

module.exports = router;
