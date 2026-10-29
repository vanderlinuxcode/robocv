import React from "react";
import "./MenuImobiliario.css";

const MenuImobiliario = ({ onAtendimentoHumano }) => {
  return (
    <section id="servicos" className="menu-section">
      <div className="menu-container">
        <h2> Serviços Imobiliários</h2>
        <p>Escolha a opção que melhor atende sua necessidade</p>
        <div className="menu-grid">
          <div className="menu-item">
            <span className="menu-icon"></span>
            <h3>Ver Imóveis</h3>
            <p>Explore todos os imóveis disponíveis</p>
            <button className="menu-btn">Ver Agora</button>
          </div>
          <div className="menu-item highlight">
            <span className="menu-icon"></span>
            <h3>Atendimento Humano</h3>
            <p>Fale diretamente com um corretor</p>
            <button
              className="menu-btn primary"
              onClick={() =>
                onAtendimentoHumano({
                  mensagem: "Olá! Gostaria de falar com um corretor.",
                })
              }
            >
              Falar Agora
            </button>
          </div>
          <div className="menu-item">
            <span className="menu-icon"></span>
            <h3>Agendar Visita</h3>
            <p>Agende uma visita ao imóvel</p>
            <button className="menu-btn">Agendar</button>
          </div>
          <div className="menu-item">
            <span className="menu-icon"></span>
            <h3>Simular Financiamento</h3>
            <p>Descubra as melhores condições</p>
            <button className="menu-btn">Simular</button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default MenuImobiliario;
