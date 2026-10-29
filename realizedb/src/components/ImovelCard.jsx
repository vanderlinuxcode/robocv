

import React, { useState } from 'react';
import './ImovelCard.css';

const ImovelCard = ({ imovel, onAtendimentoHumano, userData }) => {
  const [showDetalhes, setShowDetalhes] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const formatarPreco = (valor) => {
    return new Intl.NumberFormat('pt-BR', { 
      style: 'currency', 
      currency: 'BRL',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(valor);
  };

  
  const getImageUrl = () => {
    
    if (imovel.imagemPrincipal && imovel.imagemPrincipal.startsWith('http')) {
      return imovel.imagemPrincipal;
    }

    
    if (imovel.imagens && imovel.imagens.length > 0) {
      const principal = imovel.imagens.find(img => img.principal) || imovel.imagens[0];
      if (principal.fileId) {
        return `/api/imagem/${principal.fileId}`;
      }
      if (principal.url && principal.url.startsWith('http')) {
        return principal.url;
      }
    }

    
    const imagensReais = {
      'casa': [
        'https:
        'https:
        'https:
      ],
      'apartamento': [
        'https:
        'https:
        'https:
      ],
      'terreno': [
        'https:
        'https:
        'https:
      ],
      'cobertura': [
        'https:
        'https:
      ]
    };

    const categoria = imovel.categoria || 'casa';
    const imagens = imagensReais[categoria] || imagensReais['casa'];
    const index = (imovel._id?.toString().length || 0) % imagens.length;
    
    return imagens[index] || imagens[0];
  };

  
  const handleImageError = (e) => {
    setImgError(true);
    e.target.onerror = null;
    
    e.target.src = 'https:
  };

  const imageUrl = getImageUrl();

  const caracteristicas = [
    { icon: '️', label: imovel.quartos, show: imovel.quartos > 0 },
    { icon: '', label: `${imovel.suites || 0} suíte(s)`, show: imovel.suites > 0 },
    { icon: '', label: imovel.banheiros, show: imovel.banheiros > 0 },
    { icon: '', label: imovel.vagas, show: imovel.vagas > 0 },
    { icon: '', label: `${imovel.area}m²`, show: true }
  ].filter(c => c.show);

  return (
    <div 
      className="imovel-card-enhanced"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="imovel-image-wrapper">
        <img 
          src={imageUrl}
          alt={imovel.titulo}
          className={`imovel-image-enhanced ${isHovered ? 'hovered' : ''}`}
          onError={handleImageError}
          loading="lazy"
        />
        
        <div className="badges-container">
          {imovel.destaque && (
            <span className="badge-destaque-enhanced">⭐ Destaque</span>
          )}
          <span className={`badge-status-enhanced ${imovel.status}`}>
            {imovel.status === 'disponivel' ? 'Disponível' : 
             imovel.status === 'vendido' ? 'Vendido' : 
             imovel.status === 'reservado' ? 'Reservado' : 'Inativo'}
          </span>
        </div>

        <div className={`image-overlay ${isHovered ? 'visible' : ''}`}>
          <button 
            className="btn-interesse-rapido"
            onClick={() => onAtendimentoHumano({ 
              imovelId: imovel._id, 
              imovelTitulo: imovel.titulo, 
              mensagem: `Tenho interesse no imóvel "${imovel.titulo}"` 
            })}
          >
             Tenho Interesse
          </button>
        </div>
      </div>

      <div className="imovel-content">
        <h3 className="imovel-title">{imovel.titulo}</h3>
        
        <div className="imovel-address">
          <span className="address-icon"></span>
          <span>{imovel.endereco?.bairro || 'Localização'}, {imovel.endereco?.cidade || 'Brasília'} - {imovel.endereco?.estado || 'DF'}</span>
        </div>

        <div className="imovel-price-container">
          <div className="imovel-price">{formatarPreco(imovel.preco)}</div>
          {imovel.precoCondominio > 0 && (
            <div className="imovel-condominio">+ Cond. {formatarPreco(imovel.precoCondominio)}</div>
          )}
        </div>

        <div className="imovel-features">
          {caracteristicas.map((item, index) => (
            <span key={index} className="feature-item">
              <span className="feature-icon">{item.icon}</span>
              <span className="feature-value">{item.label}</span>
            </span>
          ))}
        </div>

        <div className="imovel-actions">
          <button 
            className="btn-detalhes-enhanced"
            onClick={() => setShowDetalhes(!showDetalhes)}
          >
            {showDetalhes ? ' Menos Detalhes' : ' Ver Detalhes'}
          </button>
          <button 
            className="btn-atendente-enhanced"
            onClick={() => onAtendimentoHumano({ 
              imovelId: imovel._id, 
              imovelTitulo: imovel.titulo, 
              mensagem: `Tenho interesse no imóvel "${imovel.titulo}"` 
            })}
          >
             Falar com Atendente
          </button>
        </div>

        {showDetalhes && (
          <div className="imovel-detalhes-enhanced">
            <p className="imovel-description">{imovel.descricao}</p>
            
            {imovel.caracteristicas && imovel.caracteristicas.length > 0 && (
              <div className="features-tags">
                <span className="tags-label">️ Características:</span>
                <div className="tags-container">
                  {imovel.caracteristicas.map((carac, index) => (
                    <span key={index} className="tag-item">#{carac}</span>
                  ))}
                </div>
              </div>
            )}

            <div className="info-adicional">
              <div className="info-row">
                <span className="info-label"> Anunciado:</span>
                <span className="info-value">{new Date(imovel.criadoEm).toLocaleDateString('pt-BR')}</span>
              </div>
              <div className="info-row">
                <span className="info-label"> Status:</span>
                <span className={`status-text ${imovel.status}`}>
                  {imovel.status === 'disponivel' ? ' Disponível para venda' : 
                   imovel.status === 'vendido' ? ' Vendido' : 
                   imovel.status === 'reservado' ? ' Reservado' : ' Inativo'}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ImovelCard;