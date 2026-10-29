
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import ImovelCard from './ImovelCard';
import CarrosselImoveis from './CarrosselImoveis';
import Banners from './Banners';
import MenuImobiliario from './MenuImobiliario';
import ChatPanel from './ChatPanel';
import './LandingPage.css';

const API_URL = import.meta.env.VITE_API_URL || '';

const LandingPage = () => {
  const [imoveis, setImoveis] = useState([]);
  const [destaques, setDestaques] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtros, setFiltros] = useState({
    categoria: '',
    cidade: '',
    precoMin: '',
    precoMax: '',
    quartos: ''
  });

  
  const [imovelParaChat, setImovelParaChat] = useState(undefined);

  useEffect(() => {
    carregarImoveis();
    carregarDestaques();
  }, []);

  const carregarImoveis = async (filtrosAplicados = {}) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ ...filtros, ...filtrosAplicados, limite: 12 });
      const response = await axios.get(`${API_URL}/api/imoveis?${params}`);
      if (response.data.success) {
        const imoveisComImagens = response.data.imoveis.map(imovel => {
          if (!imovel.imagemPrincipal || imovel.imagemPrincipal.includes('default')) {
            const imagensReais = {
              'casa': 'https:
              'apartamento': 'https:
              'terreno': 'https:
              'cobertura': 'https:
            };
            imovel.imagemPrincipal = imagensReais[imovel.categoria] ||
              'https:
          }
          return imovel;
        });
        setImoveis(imoveisComImagens);
      }
    } catch (error) {
      console.error('Erro ao carregar imóveis:', error);
    } finally {
      setLoading(false);
    }
  };

  const carregarDestaques = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/imoveis/destaque`);
      if (response.data.success) {
        const destaquesComImagens = response.data.imoveis.map(imovel => {
          if (!imovel.imagemPrincipal || imovel.imagemPrincipal.includes('default') || imovel.imagemPrincipal === '') {
            const imagensReais = {
              'casa': 'https:
              'apartamento': 'https:
              'terreno': 'https:
              'cobertura': 'https:
              'comercial': 'https:
              'industrial': 'https:
            };
            imovel.imagemPrincipal = imagensReais[imovel.categoria] ||
              'https:
          }
          return imovel;
        });
        setDestaques(destaquesComImagens);
      }
    } catch (error) {
      console.error(' Erro ao carregar destaques:', error);
    }
  };

  const handleFiltro = (e) => {
    e.preventDefault();
    carregarImoveis();
  };

 const handleFalarCorretor = (dados) => {
  
  
  if (dados && typeof dados === 'object' && dados.imovelId && !dados.titulo) {
    setImovelParaChat({
      _id: dados.imovelId,
      titulo: dados.imovelTitulo || 'Imóvel',
      
      endereco: {},
      preco: 0,
      quartos: 0,
      area: 0,
      ...dados
    });
  } else {
    setImovelParaChat(dados || null);
  }
};

  return (
    <div className="landing-page">
      <header className="header">
        <div className="header-container">
          <div className="logo">
            <span className="logo-icon"></span>
            <span className="logo-text">RealizeDB</span>
            <span className="logo-badge">Imóveis</span>
          </div>
          <nav className="nav-menu">
            <a href="#imoveis">Imóveis</a>
            <a href="#destaques">Destaques</a>
            <a href="#servicos">Serviços</a>
          </nav>
          <div className="header-actions">
            <button
              className="btn-atendente"
              onClick={() => handleFalarCorretor(null)}
            >
               Falar com corretor
            </button>
          </div>
        </div>
      </header>

      <section className="hero-section">
        <div className="hero-content">
          <h1>Encontre o <span>Imóvel dos Seus Sonhos</span></h1>
          <p>As melhores opções em imóveis com atendimento personalizado</p>

          <form className="hero-search" onSubmit={handleFiltro}>
            <select
              className="search-select"
              value={filtros.categoria}
              onChange={(e) => setFiltros({ ...filtros, categoria: e.target.value })}
            >
              <option value="">Tipo</option>
              <option value="casa">Casa</option>
              <option value="apartamento">Apartamento</option>
              <option value="terreno">Terreno</option>
            </select>
            <input
              type="text"
              placeholder="Cidade..."
              className="search-input"
              value={filtros.cidade}
              onChange={(e) => setFiltros({ ...filtros, cidade: e.target.value })}
            />
            <input
              type="number"
              placeholder="Preço min."
              className="search-input small"
              value={filtros.precoMin}
              onChange={(e) => setFiltros({ ...filtros, precoMin: e.target.value })}
            />
            <input
              type="number"
              placeholder="Preço max."
              className="search-input small"
              value={filtros.precoMax}
              onChange={(e) => setFiltros({ ...filtros, precoMax: e.target.value })}
            />
            <button type="submit" className="search-btn"> Buscar</button>
          </form>

          <div className="hero-stats">
            <div className="stat">
              <span className="stat-number">500+</span>
              <span className="stat-label">Imóveis Disponíveis</span>
            </div>
            <div className="stat">
              <span className="stat-number">98%</span>
              <span className="stat-label">Satisfação</span>
            </div>
            <div className="stat">
              <span className="stat-number">24h</span>
              <span className="stat-label">Atendimento</span>
            </div>
          </div>
        </div>

        <div className="hero-image">
          <img
            src="https:
            alt="Imóvel dos sonhos"
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              borderRadius: '20px',
              minHeight: '300px'
            }}
            onError={(e) => {
              e.target.src = 'https:
            }}
          />
        </div>
      </section>

      <Banners />

      {destaques.length > 0 ? (
        <section id="destaques" className="destaques-section">
          <div className="section-header">
            <h2>⭐ Imóveis em Destaque</h2>
            <p>Os mais procurados do momento</p>
          </div>
          <CarrosselImoveis onAtendimentoHumano={handleFalarCorretor}
            imoveis={destaques}
          />
        </section>
      ) : (
        <section id="destaques" className="destaques-section">
          <div className="section-header">
            <h2>⭐ Imóveis em Destaque</h2>
            <p>Carregando destaques...</p>
          </div>
          <div style={{ textAlign: 'center', padding: '40px', color: '#888' }}>
            <span style={{ fontSize: '40px' }}></span>
            <p>Nenhum imóvel em destaque no momento</p>
          </div>
        </section>
      )}

      <section id="imoveis" className="imoveis-section">
        <div className="section-header">
          <h2> Nossos Imóveis</h2>
          <p>Selecione o imóvel ideal para você</p>
        </div>
        {loading ? (
          <div className="loading-spinner">Carregando imóveis...</div>
        ) : (
          <div className="imoveis-grid">
            {imoveis.map(imovel => (
              <ImovelCard
                key={imovel._id}
                imovel={imovel}
                onAtendimentoHumano={handleFalarCorretor}
              />
            ))}
          </div>
        )}
      </section>

      <MenuImobiliario onAtendimentoHumano={handleFalarCorretor} />

      <footer className="footer">
        <div className="footer-container">
          <div className="footer-brand">
            <span className="logo-icon"></span>
            <span className="logo-text">RealizeDB</span>
            <p>Plataforma imobiliária com atendimento Centronic</p>
          </div>
          <div className="footer-links">
            <div className="footer-column">
              <h4>Navegação</h4>
              <a href="#imoveis">Imóveis</a>
              <a href="#destaques">Destaques</a>
              <a href="#servicos">Serviços</a>
            </div>
            <div className="footer-column">
              <h4>Atendimento</h4>
              <a
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  handleFalarCorretor(null);
                }}
              >
                 Falar com corretor
              </a>
            </div>
          </div>
        </div>
        <div className="footer-bottom">
          <p>© 2026 RealizeDB - Desenvolvido por Centronic Tecnologia LTDA</p>
        </div>
      </footer>

      {imovelParaChat !== undefined && (
        <ChatPanel
          imovel={imovelParaChat}
          onClose={() => setImovelParaChat(undefined)}
        />
      )}
    </div>
  );
};

export default LandingPage;