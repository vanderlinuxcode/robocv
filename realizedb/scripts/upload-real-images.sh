

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MONGODB_URI = process.env.REALIZEDB_MONGODB_URI;

if (!MONGODB_URI) {
    console.error(' REALIZEDB_MONGODB_URI não definida');
    process.exit(1);
}

console.log(' Conectando ao MongoDB...');

const conn = mongoose.createConnection(MONGODB_URI, {
    maxPoolSize: 10
});

const IMAGENS_DIR = path.join(__dirname, '../public/images');

conn.on('connected', async () => {
    console.log(' Conectado ao MongoDB');
    
    const db = conn.db;
    const bucket = new mongoose.mongo.GridFSBucket(db, {
        bucketName: 'imagens'
    });

    console.log(' Fazendo upload das imagens reais...\n');

    const files = fs.readdirSync(IMAGENS_DIR).filter(f => f.endsWith('.jpg'));
    
    let uploaded = 0;
    let skipped = 0;

    for (const filename of files) {
        try {
            
            const existing = await bucket.find({ filename }).toArray();
            
            if (existing.length > 0) {
                console.log(`⏭️ ${filename} já existe, pulando...`);
                skipped++;
                continue;
            }

            const filePath = path.join(IMAGENS_DIR, filename);
            const buffer = fs.readFileSync(filePath);
            const stats = fs.statSync(filePath);

            const uploadStream = bucket.openUploadStream(filename, {
                contentType: 'image/jpeg',
                metadata: {
                    size: stats.size,
                    createdAt: new Date(),
                    type: 'real_image'
                }
            });

            uploadStream.end(buffer);

            await new Promise((resolve, reject) => {
                uploadStream.on('finish', () => {
                    console.log(` ${filename} upload concluído (${(stats.size / 1024).toFixed(1)} KB)`);
                    uploaded++;
                    resolve();
                });
                uploadStream.on('error', reject);
            });

        } catch (error) {
            console.error(` Erro ao fazer upload de ${filename}:`, error.message);
        }
    }

    console.log(`\n Resumo:`);
    console.log(`    Upload realizados: ${uploaded}`);
    console.log(`   ⏭️ Pulados (já existem): ${skipped}`);
    console.log(`    Total: ${files.length}`);

    console.log('\n Script finalizado!');
    
    setTimeout(() => {
        conn.close();
        process.exit(0);
    }, 2000);
});

conn.on('error', (error) => {
    console.error(' Erro na conexão:', error.message);
    process.exit(1);
});