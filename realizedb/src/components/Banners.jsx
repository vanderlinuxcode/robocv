import React from "react";
import "./Banners.css";

const Banners = () => {
  return (
    <section className="banners-section">
      <div className="banners-container">
        <div className="banner-card banner-1">
          <div className="banner-content">
            <span className="banner-tag">Oferta Especial</span>
            <h3>Financiamento com Taxa Zero</h3>
            <p>Consiga seu imóvel com as melhores condições</p>
            <button className="banner-btn">Saiba Mais</button>
          </div>
          <div className="banner-icon"></div>
        </div>
        <div className="banner-card banner-2">
          <div className="banner-content">
            <span className="banner-tag">Novidade</span>
            <h3>Lançamentos 2026</h3>
            <p>Os melhores imóveis com desconto exclusivo</p>
            <button className="banner-btn">Ver Lançamentos</button>
          </div>
          <div className="banner-icon"></div>
        </div>
        <div className="banner-card banner-3">
          <div className="banner-content">
            <span className="banner-tag">Atendimento</span>
            <h3>Atendimento Humano 24h</h3>
            <p>Fale com um corretor a qualquer momento</p>
            <button className="banner-btn">Falar Agora</button>
          </div>
          <div className="banner-icon"></div>
        </div>
      </div>
    </section>
  );
};

export default Banners;
