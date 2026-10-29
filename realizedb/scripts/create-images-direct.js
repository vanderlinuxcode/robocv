import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

const MONGODB_URI = process.env.REALIZEDB_MONGODB_URI;

if (!MONGODB_URI) {
  console.error(" REALIZEDB_MONGODB_URI não definida no .env");
  process.exit(1);
}

console.log(" Conectando ao MongoDB...");

const conn = mongoose.createConnection(MONGODB_URI, {
  maxPoolSize: 10,
});

function createStyledSVG(title, subtitle, bgColor = "#2d3436") {
  const width = 800;
  const height = 600;
  return `<svg xmlns="http:
        <defs>
            <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" style="stop-color:${bgColor};stop-opacity:1" />
                <stop offset="100%" style="stop-color:${bgColor};stop-opacity:0.7" />
            </linearGradient>
        </defs>
        <rect width="${width}" height="${height}" fill="url(#bgGrad)"/>
        <circle cx="${width * 0.1}" cy="${height * 0.1}" r="80" fill="rgba(255,255,255,0.05)"/>
        <circle cx="${width * 0.9}" cy="${height * 0.9}" r="120" fill="rgba(255,255,255,0.05)"/>
        <text x="${width / 2}" y="${height / 2 - 30}" font-family="Arial" font-size="64" fill="white" text-anchor="middle"></text>
        <text x="${width / 2}" y="${height / 2 + 50}" font-family="Arial" font-size="28" fill="white" text-anchor="middle" font-weight="bold">${title}</text>
        <text x="${width / 2}" y="${height / 2 + 100}" font-family="Arial" font-size="18" fill="rgba(255,255,255,0.8)" text-anchor="middle">${subtitle}</text>
        <text x="${width - 20}" y="${height - 20}" font-family="Arial" font-size="14" fill="rgba(255,255,255,0.2)" text-anchor="end">REALIZE DB</text>
    </svg>`;
}

const IMAGENS = [
  {
    nome: "hero-house.jpg",
    title: "REALIZE DB",
    subtitle: "Imóveis de Luxo",
    bg: "#2d3436",
  },
  {
    nome: "casa1.jpg",
    title: "Casa Moderna",
    subtitle: "3 quartos com piscina",
    bg: "#00b894",
  },
  {
    nome: "apto1.jpg",
    title: "Apartamento Premium",
    subtitle: "Vista panorâmica",
    bg: "#667eea",
  },
  {
    nome: "terreno1.jpg",
    title: "Terreno",
    subtitle: "500m² em condomínio",
    bg: "#00cec9",
  },
  {
    nome: "cobertura1.jpg",
    title: "Cobertura Duplex",
    subtitle: "4 suítes com terraço",
    bg: "#f093fb",
  },
  {
    nome: "default.jpg",
    title: "Imóvel",
    subtitle: "Disponível para venda",
    bg: "#636e72",
  },
];

conn.on("connected", async () => {
  console.log(" Conectado ao MongoDB");

  const db = conn.db;
  const bucket = new mongoose.mongo.GridFSBucket(db, {
    bucketName: "imagens",
  });

  console.log(" Criando imagens...\n");

  let created = 0;

  for (const img of IMAGENS) {
    try {
      const existing = await bucket.find({ filename: img.nome }).toArray();
      if (existing.length > 0) {
        console.log(`⏭️ ${img.nome} já existe`);
        continue;
      }

      const svg = createStyledSVG(img.title, img.subtitle, img.bg);
      const buffer = Buffer.from(svg);

      const uploadStream = bucket.openUploadStream(img.nome, {
        contentType: "image/svg+xml",
      });

      uploadStream.end(buffer);

      await new Promise((resolve, reject) => {
        uploadStream.on("finish", () => {
          console.log(` ${img.nome} criado`);
          created++;
          resolve();
        });
        uploadStream.on("error", reject);
      });
    } catch (error) {
      console.error(` Erro ao criar ${img.nome}:`, error.message);
    }
  }

  console.log(`\n ${created} imagens criadas com sucesso!`);

  const files = await bucket.find({}).toArray();
  console.log(`\n Total no MongoDB: ${files.length}`);
  files.forEach((f, i) => {
    console.log(`   ${i + 1}. ${f.filename}`);
  });

  console.log("\n Script finalizado!");

  setTimeout(() => {
    conn.close();
    process.exit(0);
  }, 2000);
});

conn.on("error", (error) => {
  console.error(" Erro na conexão:", error.message);
  process.exit(1);
});
