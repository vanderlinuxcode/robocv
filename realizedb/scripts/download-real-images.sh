#!/bin/bash
# download-real-images.sh - Baixa imagens reais de alta qualidade

echo "═══════════════════════════════════════════════════════════════"
echo " BAIXANDO IMAGENS REAIS DE ALTA QUALIDADE"
echo "═══════════════════════════════════════════════════════════════"

cd cluster02-realizedb
mkdir -p public/images
cd public/images

echo ""
echo " Baixando imagens profissionais do Unsplash..."

# HERO - Imagem principal
curl -L "https:
echo " hero-house.jpg"

# CASA 1 - Moderna
curl -L "https:
echo " casa1.jpg"

# CASA 2 - Luxo
curl -L "https:
echo " casa2.jpg"

# APARTAMENTO 1 - Moderno
curl -L "https:
echo " apto1.jpg"

# APARTAMENTO 2 - Luxo
curl -L "https:
echo " apto2.jpg"

# TERRENO
curl -L "https:
echo " terreno1.jpg"

# COBERTURA
curl -L "https:
echo " cobertura1.jpg"

# DEFAULT - Imagem coringa
curl -L "https:
echo " default.jpg"

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo " Todas as imagens baixadas com sucesso!"
echo "═══════════════════════════════════════════════════════════════"
echo ""
echo " Lista de imagens:"
ls -la *.jpg
