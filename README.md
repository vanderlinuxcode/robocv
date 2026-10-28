# RoboCV - Plataforma Multi-Tenant de Atendimento Conversacional

## Identificação Acadêmica
* **Instituição de Ensino:** SENAC - CEP Jó Rufino
* **Curso:** Técnico em Desenvolvimento de Sistemas
* **Disciplina:** Aplicativo Node.js
* **Orientador:** Profº Hudson Neves

---

## Descrição
O RoboCV é uma aplicação de atendimento virtual e automação de serviços de alta complexidade. O sistema consiste em uma aplicação de chat persistente que integra uma interface web (landing page e painel administrativo) a um servidor backend em Node.js, utilizando comunicação em tempo real via Socket.IO. O sistema adota uma arquitetura multi-tenant com BFFs (Backend for Frontend) dedicados, integrando-se a APIs externas como WhatsApp (via Baileys) e Telegram (via Telegraf).

## Objetivos
* **Objetivo Geral:** Entregar uma solução de atendimento automatizado escalável, segura e de alta performance para múltiplos clientes (tenants).
* **Problema que o sistema resolve:** Centralização de atendimentos de diferentes landing pages em um único broker de mensageria, mantendo o isolamento de dados, credenciais e conversas.
* **Público-alvo:** Empresas que necessitam de atendimento virtual em suas landing pages (ex: RealizeDB, Telemedica).

---

## Arquitetura da Solução (Multi-Tenant)

O sistema opera com isolamento de responsabilidades por camadas, desde a borda até a persistência, garantindo que um tenant não afete o outro.

```text
┌─────────────────────────────────────────────────────────────────────┐
│                        CLOUDFLARE (Zero Trust)                      │
│  ┌────────────────────┐  ┌────────────────────┐  ┌───────────────┐  │
│  │ realizedb.         │  │ telemedica.        │  │ robocv.       │  │
│  │ centronictec.com.br│  │ centronictec.com.br│  │ centronictec  │  │
│  └─────────┬──────────┘  └─────────┬──────────┘  └───────┬───────┘  │
└────────────┼───────────────────────┼─────────────────────┼──────────┘
             │                       │                     │
             ▼                       ▼                     ▼
     ┌───────────────┐       ┌───────────────┐     ┌───────────────┐
     │  Proxy 3001   │       │  Proxy 3002   │     │  Robocv 3000  │
     │  realizedb OK │       │  telemedica OK│     │  multi-tenant │
     │  + MongoDB    │       │  (sem banco)  │     │     B.T.P     │
     └───────┬───────┘       └───────┬───────┘     └───────┬───────┘
             │                       │                     │
             │  Bearer Token         │  Bearer Token       │
             │  tenant: realizedb    │  tenant: telemedica │
             └───────────────────────┴─────────────────────┘
                                     │     
                                     ▼
                            ┌─────────────────┐
                            │  MongoDB Atlas  │
                            │  (tenants:      │
                            │   realizedb,    │
                            │   telemedica)   │
                            └─────────────────┘
                                     │
                                     ▼
                            ┌──────────────────┐
                            │ WhatsApp Business│
                            │      API         │
                            └─────────────────┘
Pontos Arquiteturais Chave:

    Cloudflare (Zero Trust): Provê o túnel reverso, evitando a exposição de portas na Oracle Cloud (OCI).

    BFF (Backend For Frontend): Cada landing page possui seu próprio proxy dedicado (Node.js/Express) nas portas 3001 e 3002.

    Isolamento de Credenciais: Os tokens (Bearer Token) nunca chegam ao browser. Cada proxy gerencia sua credencial.

    Robocv (Message Broker): Atua como o API Gateway centralizado, recebendo requisições com o campo tenant para separar corretamente as conversas.

    MongoDB Atlas: Banco de dados em nuvem que armazena as conversas de forma particionada pelos tenants.

Desafios Arquiteturais: Por que não usamos a Vercel?

Durante o planejamento da infraestrutura, avaliamos a possibilidade de hospedar o backend do chat na Vercel (plataforma Serverless). No entanto, a migração foi descartada devido a limitações técnicas severas para o modelo de negócio do RoboCV.
O Problema com Serverless para Chat Persistente

A Vercel é excelente para funções de curta duração (SSR, APIs REST), mas o RoboCV depende de conexões WebSocket persistentes (Socket.IO) e processos contínuos.
Desafio na Vercel	Impacto no RoboCV	Solução na OCI
Timeout de Funções	As conexões WebSocket são encerradas à força em poucos minutos. O chat cairia constantemente.	O processo Node.js roda de forma contínua e as conexões WebSocket ficam abertas indefinidamente.
Stateless (Sem Estado)	Instâncias não compartilham memória. Um usuário não veria a mensagem do outro se caíssem em instâncias diferentes.	O PM2 mantém a aplicação como um processo único, garantindo o estado e a conexão.
Cold Starts	A primeira requisição do dia pode demorar vários segundos para "acordar" a função.	O servidor está sempre "quente", respondendo em milissegundos.
Processos em Background	Tarefas em background não rodam fora de requisições HTTP.	O servidor Node.js pode executar loops assíncronos e tarefas em background livremente.
Resiliência e Recuperação de Desastres (Migração AWS para OCI)

Inicialmente, a aplicação foi hospedada na AWS. No entanto, a instância sofreu uma falha crítica de infraestrutura por problemas internos da própria AWS, resultando na perda do servidor e inviabilizando a recuperação no curto prazo.

Para garantir a continuidade do negócio, a arquitetura foi reconstruída e migrada emergencialmente para a Oracle Cloud Infrastructure (OCI). Essa transição forçada trouxe aprendizados valiosos e moldou a arquitetura atual:

    Isolamento de Rede: A adoção do Cloudflare Tunnel (Zero Trust) na OCI eliminou a necessidade de expor portas públicas, mitigando ataques e aumentando a segurança.

    Recuperação Rápida: Com o código versionado no GitHub e o banco de dados em nuvem gerenciado (MongoDB Atlas), a reconstrução da aplicação na OCI foi realizada em tempo recorde.

    Alta Disponibilidade: A implementação do PM2 na OCI garantiu que, mesmo em caso de falhas no processo, o Node.js fosse reiniciado automaticamente, mantendo o sistema escalável e em produção.

Stack Tecnológica

A aplicação não é monolítica, nem puramente HTML. Ela é dividida em duas grandes camadas:

    Camada de Apresentação (Frontend): SPA (Single Page Application) desenvolvida em React (JavaScript) e empacotada pelo Vite. O código-fonte em JSX é compilado para um bundle otimizado de HTML, CSS e JavaScript.

    Camada de Aplicação (Backend/Proxy): Servidor Node.js com o framework Express, responsável por servir os arquivos estáticos (build do React) e atuar como API Gateway (BFF) para o robocv.

Tecnologias Utilizadas

    Runtime & Backend: Node.js, Express, Socket.IO.

    Frontend: React, Vite, HTML5, CSS3.

    Banco de Dados: MongoDB Atlas (via Mongoose).

    Integrações: @whiskeysockets/baileys (WhatsApp), Telegraf (Telegram), Axios.

    Infraestrutura & Deploy: Oracle Cloud Infrastructure (OCI), PM2, Cloudflare Tunnel, dotenv.

Funcionalidades

    Atendimento via chat persistente em tempo real na landing page.

    Painel administrativo privado para gestão de leads e visualização de métricas.

    Integração nativa com WhatsApp Web (Baileys) e Bot do Telegram.

    Gerenciamento de sessões autenticadas (session/).

    Multi-tenancy: isolamento de instâncias por domínio, garantindo que os dados não se misturem.

Modelagem do Banco de Dados

    Leads: Dados de clientes, número de telefone, histórico de interações e status no funil.

    Chamadas: Registro de atendimentos, duração, mensagens trocadas e status.

    ImagemTela: Referências para mídias (imagens e vídeos) utilizadas no robô.

Pré-requisitos

    Node.js (versão 18 ou superior).

    Conta no MongoDB Atlas (ou MongoDB local).

    Acesso à internet (para APIs do Telegram, WhatsApp e robocv).

    (Opcional para produção) Instância na OCI, PM2 e Cloudflare Tunnel configurado.

Instalação (Desenvolvimento)

    Clone o repositório:
    bash

git clone https://github.com/seu-usuario/robocv.git

Acesse o diretório:
bash

cd robocv

Instale as dependências:
bash

npm install

Crie o arquivo .env com base no .env.example e preencha as credenciais do Mongo, Telegram e Robocv.

Inicie o servidor:
bash
node server.js
Como Executar (Produção com PM2)

Para manter o sistema rodando continuamente e com resiliência na OCI, utiliza-se o PM2:
bash

pm2 start server.js --name "robocv"
pm2 save
pm2 startup

Para atualizar as variáveis de ambiente após editar o .env:
bash

pm2 restart robocv --update-env

Estrutura do Projeto

robocv/
├── package.json
├── package-lock.json
├── server.js           # Arquivo principal do backend (Node.js/Express)
├── private/
│   └── admin/
│       └── index.html  # Painel administrativo (acesso restrito)
├── public/
│   ├── images/         # Mídias enviadas pelo bot
│   ├── videos/         # Vídeos de apresentação
│   ├── landing/
│   │   └── index.html  # Landing page pública (teia animada)
│   └── premov.login.html # Tela de login

Exemplos de Uso

A ser definido pela equipe (instruções sobre como interagir com o chat ou o painel).
API (Rotas Principais)

    POST /api/conversa/iniciar - Inicia uma nova conversa (via Robocv).

    GET /status - Retorna o status do sistema (WhatsApp, Telegram, Mongo).

    GET /stats - Retorna métricas gerais de leads.

    GET /chamadas/pendentes - Lista chamadas aguardando atendimento.
    (Verifique o arquivo server.js para a lista completa de endpoints).

Equipe do Projeto

    Integrantes da equipe: A ser definido pela equipe.

Melhorias Futuras

    Implementação de autenticação robusta no painel administrativo (OAuth2/JWT).

    Criação de uma interface web para gerenciamento de tenants sem precisar editar .env.

    Implementação de testes automatizados (Jest/Cypress).

Licença

A ser definido pela equipe.

Status do Projeto: Em desenvolvimento / Em produção
