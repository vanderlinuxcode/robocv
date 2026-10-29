import { useEffect, useRef, useState } from "react";
import "./ChatPanel.css";

const CHAT_ENDPOINT = "/api/chat";

export default function ChatPanel({ imovel, onClose }) {
  const [etapa, setEtapa] = useState("form");
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [conversaId, setConversaId] = useState(null);
  const [mensagens, setMensagens] = useState([]);
  const [texto, setTexto] = useState("");
  const [erro, setErro] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const listaRef = useRef(null);
  const pollingRef = useRef(null);
  const ultimaQtdRef = useRef(0);

  function formatarTelefone(valor) {
    const raw = valor.replace(/\D/g, "").slice(0, 11);
    if (raw.length <= 2) return raw;
    if (raw.length <= 6) return `(${raw.slice(0, 2)}) ${raw.slice(2)}`;
    if (raw.length <= 10)
      return `(${raw.slice(0, 2)}) ${raw.slice(2, 6)}-${raw.slice(6)}`;
    return `(${raw.slice(0, 2)}) ${raw.slice(2, 7)}-${raw.slice(7)}`;
  }

  async function iniciarConversa(e) {
    e?.preventDefault();
    setErro(null);

    const telefoneLimpo = telefone.replace(/\D/g, "");
    if (!nome.trim()) return setErro("Informe seu nome");
    if (telefoneLimpo.length < 10) return setErro("Telefone inválido");

    setCarregando(true);

    try {
      const resp = await fetch(`${CHAT_ENDPOINT}/iniciar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          telefone: telefoneLimpo,
          nomeCliente: nome.trim(),
          imovelId: imovel?._id || imovel?.imovelId || null,
          mensagemInicial: imovel
            ? `Olá! Tenho interesse no imóvel: *${imovel.titulo}*\n\n` +
              ` ${imovel.endereco?.bairro || ""}, ${imovel.endereco?.cidade || ""}\n` +
              ` R$ ${(imovel.preco || 0).toLocaleString("pt-BR")}\n` +
              `️ ${imovel.quartos || 0} quartos · ${imovel.area || 0}m²`
            : `Olá! Gostaria de mais informações sobre imóveis.`,
        }),
      });

      const data = await resp.json();

      if (!data.success) {
        throw new Error(data.error || "Falha ao iniciar conversa");
      }

      setConversaId(data.conversaId);
      setEtapa("chat");
      setMensagens([
        {
          texto:
            "Aguarde alguns instantes. Um corretor responderá por aqui em breve.",
          origem: "sistema",
          criadoEm: new Date().toISOString(),
        },
      ]);

      iniciarPolling(data.conversaId);
    } catch (e) {
      console.error(e);
      setErro(e.message || "Erro ao conectar");
    } finally {
      setCarregando(false);
    }
  }

  function iniciarPolling(id) {
    pararPolling();
    pollingRef.current = setInterval(async () => {
      try {
        const resp = await fetch(`${CHAT_ENDPOINT}/${id}/mensagens`);
        const data = await resp.json();

        if (data.success && Array.isArray(data.mensagens)) {
          if (data.mensagens.length !== ultimaQtdRef.current) {
            ultimaQtdRef.current = data.mensagens.length;
            setMensagens(data.mensagens);
          }
        }
      } catch (e) {}
    }, 4000);
  }

  function pararPolling() {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }

  async function enviarMensagem(e) {
    e?.preventDefault();
    if (!texto.trim() || !conversaId || enviando) return;

    const textoAtual = texto.trim();
    setTexto("");
    setEnviando(true);

    setMensagens((m) => [
      ...m,
      {
        texto: textoAtual,
        origem: "cliente",
        criadoEm: new Date().toISOString(),
      },
    ]);

    try {
      const resp = await fetch(`${CHAT_ENDPOINT}/${conversaId}/mensagem`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ texto: textoAtual }),
      });
      const data = await resp.json();
      if (!data.success) throw new Error(data.error || "Falha ao enviar");
    } catch (e) {
      console.error(e);
      setErro("Não foi possível enviar. Tente novamente.");
      setMensagens((m) => m.slice(0, -1));
      setTexto(textoAtual);
    } finally {
      setEnviando(false);
    }
  }

  useEffect(() => {
    if (listaRef.current) {
      listaRef.current.scrollTop = listaRef.current.scrollHeight;
    }
  }, [mensagens]);

  useEffect(() => {
    return () => pararPolling();
  }, []);

  function fechar() {
    pararPolling();
    onClose?.();
  }

  return (
    <div
      className="chat-overlay"
      onClick={(e) => e.target === e.currentTarget && fechar()}
    >
      <div className="chat-panel">
        <header className="chat-header">
          <div className="chat-header-info">
            <strong>
              {etapa === "form"
                ? " Falar com corretor"
                : imovel?.titulo || "Atendimento"}
            </strong>
            <span className="chat-header-sub">
              {etapa === "form"
                ? "Informe seus dados para começar"
                : "Aguarde — um corretor responderá por aqui"}
            </span>
          </div>
          <button
            className="chat-close"
            onClick={fechar}
            aria-label="Fechar"
          ></button>
        </header>

        {etapa === "form" && (
          <form className="chat-form" onSubmit={iniciarConversa}>
            {imovel && (
              <div className="chat-imovel-resumo">
                <div className="chat-imovel-titulo">{imovel.titulo}</div>
                <div className="chat-imovel-info">
                  {imovel.endereco?.bairro} · {imovel.endereco?.cidade}
                </div>
                <div className="chat-imovel-preco">
                  R$ {(imovel.preco || 0).toLocaleString("pt-BR")}
                </div>
              </div>
            )}

            <label>
              Seu nome
              <input
                type="text"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Como podemos te chamar?"
                required
                autoFocus
              />
            </label>

            <label>
              Seu WhatsApp
              <input
                type="tel"
                value={telefone}
                onChange={(e) => setTelefone(formatarTelefone(e.target.value))}
                placeholder="(61) 99999-9999"
                required
              />
            </label>

            {erro && <div className="chat-erro">{erro}</div>}

            <button type="submit" disabled={carregando}>
              {carregando ? "Conectando…" : " Iniciar conversa"}
            </button>

            <p className="chat-aviso">
              Ao continuar, você receberá uma mensagem no WhatsApp informado.
            </p>
          </form>
        )}

        {etapa === "chat" && (
          <>
            <div className="chat-lista" ref={listaRef}>
              {mensagens.map((m, i) => {
                const isCliente = m.origem === "cliente";
                const isSistema = m.origem === "sistema";
                return (
                  <div
                    key={i}
                    className={`bolha ${isCliente ? "bolha-eu" : isSistema ? "bolha-sistema" : "bolha-corretor"}`}
                  >
                    {!isSistema && (
                      <div className="bolha-autor">
                        {isCliente ? "Você" : "‍ Corretor"}
                      </div>
                    )}
                    <div className="bolha-texto">{m.texto}</div>
                    {!isSistema && (
                      <div className="bolha-hora">
                        {new Date(m.criadoEm).toLocaleTimeString("pt-BR", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {erro && <div className="chat-erro">{erro}</div>}

            <form className="chat-input-area" onSubmit={enviarMensagem}>
              <input
                type="text"
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                placeholder="Digite sua mensagem…"
                disabled={enviando}
              />
              <button type="submit" disabled={enviando || !texto.trim()}>
                {enviando ? "…" : ""}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
