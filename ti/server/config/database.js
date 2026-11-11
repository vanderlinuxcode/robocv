const mongoose = require('mongoose');

async function connectDatabase() {
  const mongoUri = process.env.MONGODB_URI;

  if (!mongoUri) {
    throw new Error('MONGODB_URI não foi definida no arquivo .env');
  }

  await mongoose.connect(mongoUri);

  console.log('MongoDB conectado com sucesso.');
}

module.exports = connectDatabase;
