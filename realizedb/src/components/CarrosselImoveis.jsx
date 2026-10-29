

import React, { useState, useEffect, useRef } from 'react';
import './CarrosselImoveis.css';

const CarrosselImoveis = ({ imoveis, onAtendimentoHumano }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [touchStartX, setTouchStartX] = useState(0);
  const [touchEndX, setTouchEndX] = useState(0);
  const carouselRef = useRef(null);

  
  const slides = [
    {
      id: 1,
      titulo: 'Casa de Luxo com Piscina',
      descricao: 'Casa ampla com 4 quartos, piscina aquecida, churrasqueira gourmet e área de lazer completa.',
      preco: 850000,
      endereco: 'Taguatinga Norte, Brasília - DF',
      quartos: 4,
      suites: 2,
      banheiros: 3,
      vagas: 3,
      area: 280,
      image: 'https:
      destaque: true,
      status: 'disponivel',
      categoria: 'casa'
    },
    {
      id: 2,
      titulo: 'Apartamento Premium com Vista 360°',
      descricao: 'Apartamento de alto padrão com varanda gourmet, vista panorâmica e acabamento premium.',
      preco: 520000,
      endereco: 'Águas Claras, Brasília - DF',
      quartos: 3,
      suites: 1,
      banheiros: 2,
      vagas: 2,
      area: 145,
      image: 'https:
      destaque: true,
      status: 'disponivel',
      categoria: 'apartamento'
    },
    {
      id: 3,
      titulo: 'Terreno 1000m² com Vista para o Lago',
      descricao: 'Terreno plano com escritura regularizada, infraestrutura completa e vista privilegiada.',
      preco: 450000,
      endereco: 'Setor Residencial Sul, Brasília - DF',
      quartos: 0,
      suites: 0,
      banheiros: 0,
      vagas: 0,
      area: 1000,
      image: 'https:
      destaque: false,
      status: 'disponivel',
      categoria: 'terreno'
    },
    {
      id: 4,
      titulo: 'Cobertura Duplex com Terraço Gourmet',
      descricao: 'Cobertura duplex com 4 suítes, terraço gourmet, piscina privativa e vista espetacular.',
      preco: 1200000,
      endereco: 'Asa Sul, Brasília - DF',
      quartos: 4,
      suites: 4,
      banheiros: 5,
      vagas: 3,
      area: 350,
      image: 'https:
      destaque: true,
      status: 'disponivel',
      categoria: 'cobertura'
    },
    {
      id: 5,
      titulo: 'Casa Moderna com Design Contemporâneo',
      descricao: 'Casa com arquitetura moderna, grandes janelas, integração com área externa e paisagismo.',
      preco: 680000,
      endereco: 'Park Way, Brasília - DF',
      quartos: 3,
      suites: 1,
      banheiros: 2,
      vagas: 2,
      area: 220,
      image: 'https:
      destaque: true,
      status: 'disponivel',
      categoria: 'casa'
    },
    {
      id: 6,
      titulo: 'Apartamento Econômico 2 Quartos',
      descricao: 'Apartamento com 2 quartos, sala ampla, cozinha planejada e ótima localização.',
      preco: 220000,
      endereco: 'Ceilândia, Brasília - DF',
      quartos: 2,
      suites: 0,
      banheiros: 1,
      vagas: 1,
      area: 68,
      image: 'https:
      destaque: false,
      status: 'disponivel',
      categoria: 'apartamento'
    }
  ];

  const displaySlides = imoveis && imoveis.length >= 6 ? imoveis : slides;

  
  useEffect(() => {
    if (!displaySlides || displaySlides.length === 0 || isPaused) return;

    const interval = setInterval(() => {
      if (!isTransitioning) {
        nextSlide();
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [displaySlides, isPaused, isTransitioning]);

  const handleMouseEnter = () => setIsPaused(true);
  const handleMouseLeave = () => setIsPaused(false);

  const nextSlide = () => {
    if (isTransitioning || !displaySlides || displaySlides.length === 0) return;
    setIsTransitioning(true);
    setCurrentIndex((prev) => (prev + 1) % displaySlides.length);
    setTimeout(() => setIsTransitioning(false), 500);
  };

  const prevSlide = () => {
    if (isTransitioning || !displaySlides || displaySlides.length === 0) return;
    setIsTransitioning(true);
    setCurrentIndex((prev) => (prev - 1 + displaySlides.length) % displaySlides.length);
    setTimeout(() => setIsTransitioning(false), 500);
  };

  const goToSlide = (index) => {
    if (isTransitioning || index === currentIndex) return;
    setIsTransitioning(true);
    setCurrentIndex(index);
    setTimeout(() => setIsTransitioning(false), 500);
  };

  
  const handleTouchStart = (e) => setTouchStartX(e.touches[0].clientX);
  const handleTouchMove = (e) => setTouchEndX(e.touches[0].clientX);
  const handleTouchEnd = () => {
    if (touchStartX - touchEndX > 50) nextSlide();
    if (touchStartX - touchEndX < -50) prevSlide();
  };

  
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'ArrowRight') nextSlide();
      if (e.key === 'ArrowLeft') prevSlide();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  if (!displaySlides || displaySlides.length === 0) {
    return (
      <div className="carrossel-empty">
        <span className="empty-icon"></span>
        <p>Nenhum imóvel em destaque</p>
      </div>
    );
  }

  const currentSlide = displaySlides[currentIndex];

  const formatarPreco = (valor) => {
    if (!valor) return '';
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(valor);
  };

  const formatarEndereco = (endereco) => {
    if (!endereco) return 'Localização não informada';
    if (typeof endereco === 'string') return endereco;
    if (endereco.bairro && endereco.cidade) {
      return `${endereco.bairro}, ${endereco.cidade}${endereco.estado ? ` - ${endereco.estado}` : ''}`;
    }
    return endereco.logradouro || 'Localização não informada';
  };

  const handleInteresse = () => {
    onAtendimentoHumano({
      imovelId: currentSlide.id,
      imovelTitulo: currentSlide.titulo,
      mensagem: `Tenho interesse no imóvel "${currentSlide.titulo}"`
    });
  };

  return (
    <div 
      className="carrossel-premium"
      ref={carouselRef}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {}
      <div className="autoplay-indicator">
        <span className={`autoplay-dot ${!isPaused ? 'active' : ''}`}></span>
        <span className="autoplay-text">{!isPaused ? '▶ Reproduzindo' : '⏸ Pausado'}</span>
      </div>

      {}
      <div className="carrossel-slide-wrapper">
        <div 
          className="carrossel-slide-content"
          style={{ transform: `translateX(-${currentIndex * 100}%)` }}
        >
          {displaySlides.map((slide) => (
            <div key={slide.id} className="carrossel-item">
              {}
              <div className="carrossel-image-container">
                <img 
                  src={slide.image}
                  alt={slide.titulo}
                  className="carrossel-image"
                  loading="lazy"
                  onError={(e) => {
                    e.target.onerror = null;
                    e.target.src = 'https:
                  }}
                />
                <div className="image-gradient-overlay"></div>
                
                {}
                <div className="carrossel-badges">
                  {slide.destaque && (
                    <span className="badge-destaque-carrossel">⭐ Destaque</span>
                  )}
                  <span className={`badge-status-carrossel ${slide.status}`}>
                    {slide.status === 'disponivel' ? 'Disponível' : 'Reservado'}
                  </span>
                </div>
              </div>

              {}
              <div className="carrossel-info">
                <div className="carrossel-categoria-tag">
                  <span className="tag-categoria">
                    {slide.categoria === 'casa' ? ' Casa' : 
                     slide.categoria === 'apartamento' ? ' Apartamento' : 
                     slide.categoria === 'terreno' ? ' Terreno' : 
                     slide.categoria === 'cobertura' ? ' Cobertura' : ' Imóvel'}
                  </span>
                </div>

                <h3 className="carrossel-title">{slide.titulo}</h3>
                <div className="carrossel-address"> {formatarEndereco(slide.endereco)}</div>

                <div className="carrossel-price-container">
                  <span className="carrossel-price">{formatarPreco(slide.preco)}</span>
                </div>

                <div className="carrossel-features">
                  {slide.quartos > 0 && <span className="carrossel-feature">️ {slide.quartos}</span>}
                  {slide.suites > 0 && <span className="carrossel-feature"> {slide.suites}</span>}
                  {slide.banheiros > 0 && <span className="carrossel-feature"> {slide.banheiros}</span>}
                  {slide.vagas > 0 && <span className="carrossel-feature"> {slide.vagas}</span>}
                  {slide.area > 0 && <span className="carrossel-feature"> {slide.area}m²</span>}
                </div>

                <p className="carrossel-description">{slide.descricao}</p>

                <button 
                  className="carrossel-btn-interesse"
                  onClick={handleInteresse}
                >
                   Tenho Interesse
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {}
      {displaySlides.length > 1 && (
        <>
          <button className="carrossel-nav-btn prev" onClick={prevSlide} aria-label="Anterior">
            <svg viewBox="0 0 24 24" width="24" height="24">
              <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round"/>
            </svg>
          </button>
          <button className="carrossel-nav-btn next" onClick={nextSlide} aria-label="Próximo">
            <svg viewBox="0 0 24 24" width="24" height="24">
              <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round"/>
            </svg>
          </button>
        </>
      )}

      {}
      {displaySlides.length > 1 && (
        <div className="carrossel-dots-container">
          {displaySlides.map((_, index) => (
            <button
              key={index}
              className={`carrossel-dot ${index === currentIndex ? 'active' : ''}`}
              onClick={() => goToSlide(index)}
              aria-label={`Ir para slide ${index + 1}`}
            />
          ))}
        </div>
      )}

      {}
      {displaySlides.length > 1 && (
        <div className="carrossel-counter">
          {currentIndex + 1} / {displaySlides.length}
        </div>
      )}
    </div>
  );
};

export default CarrosselImoveis;