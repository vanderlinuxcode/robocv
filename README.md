RoboCV — Plataforma Multi-Tenant de Atendimento Conversacional
Sumário
Identificação Acadêmica
Descrição
Objetivos
Arquitetura da Solução
Pontos Arquiteturais Chave
Desafios Arquiteturais: Por que não usamos a Vercel?
Resiliência e Recuperação de Desastres
Stack Tecnológica
Tecnologias Utilizadas
Funcionalidades
Modelagem do Banco de Dados
Pré-requisitos
Instalação
Execução em Produção com PM2
Estrutura do Projeto
Exemplos de Uso
API — Rotas Principais
Equipe do Projeto
Melhorias Futuras
Licença
Status do Projeto
Identificação Acadêmica
Instituição de Ensino: SENAC — CEP Jó Rufino
Curso: Técnico em Desenvolvimento de Sistemas
Disciplina: Aplicativo Node.js
Orientador: Profº Hudson Neves
Descrição

O RoboCV é uma aplicação de atendimento virtual e automação de serviços de alta complexidade.

O sistema consiste em uma aplicação de chat persistente que integra uma interface web, composta por landing page e painel administrativo, a um servidor backend desenvolvido em Node.js, utilizando comunicação em tempo real por meio do Socket.IO.

A aplicação adota uma arquitetura multi-tenant, com BFFs (Backend for Frontend) dedicados, integrando-se a APIs externas, como WhatsApp, por meio da biblioteca Baileys, e Telegram, por meio da biblioteca Telegraf.

Objetivos
Objetivo geral: Entregar uma solução de atendimento automatizado escalável, segura e de alta performance para múltiplos clientes (tenants).
Problema que o sistema resolve: Centralizar os atendimentos de diferentes landing pages em um único broker de mensageria, mantendo o isolamento de dados, credenciais e conversas.
Público-alvo: Empresas que necessitam de atendimento virtual em suas landing pages, como RealizeDB e Telemedica.
Arquitetura da Solução (Multi-Tenant)

O sistema opera com isolamento de responsabilidades por camadas, desde a borda até a persistência, garantindo que um tenant não interfira nos demais.

Diagrama da Arquitetura
text
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
                            └──────────────────┘

Pontos Arquiteturais Chave
Cloudflare (Zero Trust): Provê o túnel reverso, evitando a exposição direta de portas na Oracle Cloud Infrastructure (OCI).
BFF (Backend for Frontend): Cada landing page possui seu próprio proxy dedicado, desenvolvido em Node.js/Express, nas portas 3001 e 3002.
Isolamento de credenciais: Os tokens de autenticação (Bearer Tokens) não devem ser expostos ao navegador. Cada proxy gerencia sua própria credencial.
RoboCV (Message Broker): Atua como API Gateway centralizado, recebendo requisições com o campo tenant para separar corretamente as conversas.
MongoDB Atlas: Banco de dados em nuvem que armazena as conversas de forma particionada por tenant.
Desafios Arquiteturais: Por que não usamos a Vercel?

Durante o planejamento da infraestrutura, avaliamos a possibilidade de hospedar o backend do chat na Vercel, uma plataforma que oferece recursos de execução serverless. No entanto, a migração foi descartada devido a limitações técnicas para o modelo de funcionamento do RoboCV.

O Problema com Serverless para Chat Persistente

A Vercel é adequada para funções de curta duração, como renderização no servidor (SSR) e APIs REST. Entretanto, o RoboCV depende de conexões WebSocket persistentes, implementadas com Socket.IO, e de processos contínuos.

Desafio na Vercel	Impacto no RoboCV	Solução na OCI
Timeout de funções	Conexões persistentes podem ser interrompidas ou exigir uma arquitetura específica para manter a comunicação em tempo real.	O processo Node.js é executado continuamente, permitindo manter conexões persistentes conforme a configuração do servidor.
Stateless (sem estado)	Instâncias independentes não compartilham automaticamente o estado em memória.	A aplicação pode manter estado no processo e utilizar mecanismos compartilhados quando necessários.
Cold starts	Algumas funções podem apresentar latência adicional durante a inicialização.	O servidor permanece em execução, evitando a inicialização de uma função a cada requisição.
Processos em background	Tarefas contínuas não são adequadas ao modelo de execução limitado de funções sob demanda.	O servidor Node.js pode executar tarefas assíncronas e processos em segundo plano enquanto estiver ativo.
Resiliência e Recuperação de Desastres (Migração AWS para OCI)

Inicialmente, a aplicação foi hospedada na AWS. No entanto, a instância sofreu uma falha crítica de infraestrutura, resultando na perda do servidor e inviabilizando sua recuperação no curto prazo.

Para garantir a continuidade do projeto, a arquitetura foi reconstruída e migrada emergencialmente para a Oracle Cloud Infrastructure (OCI).

Essa transição trouxe aprendizados importantes e contribuiu para a arquitetura atual:

Isolamento de rede: A adoção do Cloudflare Tunnel com Zero Trust na OCI eliminou a necessidade de expor diretamente portas públicas, contribuindo para a redução da superfície de ataque.
Recuperação rápida: Com o código versionado no GitHub e o banco de dados hospedado no MongoDB Atlas, a reconstrução da aplicação na OCI foi facilitada.
Resiliência operacional: A implementação do PM2 na OCI permite reiniciar automaticamente o processo Node.js em caso de falha, desde que o gerenciador e o ambiente permaneçam operacionais.
Stack Tecnológica

A aplicação não é monolítica nem composta exclusivamente por HTML. Sua arquitetura é dividida em duas grandes camadas:

Camada de apresentação (Frontend): SPA (Single Page Application) desenvolvida em React e JavaScript, empacotada pelo Vite. O código-fonte JSX é compilado para um conjunto otimizado de arquivos HTML, CSS e JavaScript.
Camada de aplicação (Backend/Proxy): Servidor Node.js com o framework Express, responsável por servir os arquivos estáticos gerados pelo build do React e atuar como API Gateway (BFF) para o RoboCV.
Tecnologias Utilizadas
Categoria	Tecnologias
Runtime e Backend	Node.js, Express, Socket.IO
Frontend	React, Vite, HTML5, CSS3, JavaScript
Banco de dados	MongoDB Atlas, Mongoose
Integrações	@whiskeysockets/baileys (WhatsApp), Telegraf (Telegram), Axios
Infraestrutura e Deploy	Oracle Cloud Infrastructure (OCI), PM2, Cloudflare Tunnel, dotenv
Funcionalidades
Atendimento por chat persistente em tempo real na landing page.
Painel administrativo privado para gestão de leads e visualização de métricas.
Integração com WhatsApp Web por meio do Baileys e com bots do Telegram.
Gerenciamento de sessões autenticadas, incluindo arquivos e diretórios de sessão.
Multi-tenancy: Isolamento de instâncias por domínio, visando garantir que os dados dos clientes não se misturem.
Modelagem do Banco de Dados

As principais entidades previstas na modelagem incluem:

Leads: Dados de clientes, números de telefone, histórico de interações e status no funil de atendimento.
Chamadas: Registros de atendimentos, duração, mensagens trocadas e status.
ImagemTela: Referências a mídias, como imagens e vídeos, utilizadas pelo robô.
Pré-requisitos

Antes de iniciar a instalação, verifique se você possui:

Node.js versão 18 ou superior.
Conta no MongoDB Atlas ou uma instalação local do MongoDB.
Acesso à internet para comunicação com as APIs do Telegram, WhatsApp e RoboCV.
Opcional para produção: Instância na OCI, PM2 instalado e Cloudflare Tunnel configurado.
Instalação (Desenvolvimento)
1. Clone o repositório
bash
git clone https://github.com/seu-usuario/robocv.git

Observação: Substitua seu-usuario pelo nome de usuário ou pela organização responsável pelo repositório.
2. Acesse o diretório do projeto
bash
cd robocv

3. Instale as dependências
bash
npm install

4. Configure as variáveis de ambiente

Crie o arquivo .env com base no arquivo .env.example e configure as credenciais necessárias para o MongoDB, Telegram e RoboCV.

Importante: Não publique o arquivo .env nem credenciais, tokens ou senhas no repositório.

5. Inicie o servidor
bash
node server.js

Como Executar (Produção com PM2)

Para manter a aplicação em execução na OCI, utiliza-se o PM2 como gerenciador de processos.

Iniciar a aplicação
bash
pm2 start server.js --name "robocv"

Salvar a configuração dos processos
bash
pm2 save

Configurar a inicialização automática
bash
pm2 startup


Execute também o comando adicional exibido pelo PM2, caso seja solicitado, para concluir a configuração de inicialização automática.

Atualizar as variáveis de ambiente

Após editar o arquivo .env, reinicie a aplicação para carregar as novas variáveis:

bash
pm2 restart robocv --update-env

Estrutura do Projeto
text
robocv/
├── package.json
├── package-lock.json
├── server.js                 # Arquivo principal do backend (Node.js/Express)
├── private/
│   └── admin/
│       └── index.html        # Painel administrativo (acesso restrito)
└── public/
    ├── images/               # Mídias enviadas pelo bot
    ├── videos/               # Vídeos de apresentação
    ├── landing/
    │   └── index.html        # Landing page pública (teia animada)
    └── premov.login.html     # Tela de login

Nota: A estrutura apresentada representa os diretórios e arquivos informados no projeto. Ajuste-a caso a estrutura real do repositório seja diferente.
Exemplos de Uso

Os exemplos de uso serão definidos pela equipe e poderão incluir instruções sobre como interagir com o chat, utilizar o painel administrativo e acompanhar os atendimentos.

API — Rotas Principais

As rotas principais informadas para a aplicação são:

Método HTTP	Endpoint	Descrição
POST	/api/conversa/iniciar	Inicia uma nova conversa por meio do RoboCV.
GET	/status	Retorna o status dos serviços, incluindo WhatsApp, Telegram e MongoDB.
GET	/stats	Retorna métricas gerais de leads.
GET	/chamadas/pendentes	Lista chamadas que aguardam atendimento.
Nota: Consulte o arquivo server.js para verificar a lista completa de endpoints, os métodos HTTP, os parâmetros e os requisitos de autenticação.
Equipe do Projeto
Integrantes: A definir pela equipe.
Melhorias Futuras
Implementação de autenticação robusta no painel administrativo, utilizando OAuth 2.0 e/ou JWT.
Criação de uma interface web para gerenciamento de tenants, sem necessidade de editar diretamente o arquivo .env.
Implementação de testes automatizados com Jest e Cypress.
Licença

A definir pela equipe.

Status do Projeto

Situação: Em desenvolvimento / Em produção.
