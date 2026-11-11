import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ||
  (__DEV__ ? 'http://localhost:3003/api/chat' : '/api/chat');

export default function ChatPanel({ visible, onClose }) {
  const [etapa, setEtapa] = useState('identificacao');
  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [codigo, setCodigo] = useState('');
  const [otpTicket, setOtpTicket] = useState('');
  const [conversaId, setConversaId] = useState('');
  const [sessionToken, setSessionToken] = useState('');
  const [mensagens, setMensagens] = useState([]);
  const [texto, setTexto] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');
  const scrollRef = useRef(null);

  async function requisicao(caminho, metodo = 'POST', dados = null, token = '') {
    const resposta = await fetch(`${API_BASE_URL}${caminho}`, {
      method: metodo,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      ...(dados ? { body: JSON.stringify(dados) } : {}),
    });

    const resultado = await resposta.json().catch(() => ({}));

    if (!resposta.ok || resultado.success === false) {
      throw new Error(resultado.error || resultado.message || 'Não foi possível concluir a operação.');
    }

    return resultado;
  }

  async function solicitarCodigo() {
    setErro('');
    setCarregando(true);

    try {
      await requisicao('/solicitar-codigo', 'POST', { telefone });
      setEtapa('codigo');
    } catch (e) {
      setErro(e.message);
    } finally {
      setCarregando(false);
    }
  }

  async function confirmarCodigo() {
    setErro('');
    setCarregando(true);

    try {
      const resultado = await requisicao('/confirmar-codigo', 'POST', {
        telefone,
        codigo,
      });

      if (!resultado.otpTicket) {
        throw new Error('A confirmação não retornou o comprovante esperado.');
      }

      setOtpTicket(resultado.otpTicket);
      setEtapa('nome');
    } catch (e) {
      setErro(e.message);
    } finally {
      setCarregando(false);
    }
  }

  async function iniciarAtendimento() {
    setErro('');
    setCarregando(true);

    try {
      const resultado = await requisicao('/iniciar', 'POST', {
        nome,
        telefone,
        otpTicket,
      });

      if (!resultado.conversaId || !resultado.sessionToken) {
        throw new Error('A API não retornou os dados necessários para iniciar a conversa.');
      }

      setConversaId(resultado.conversaId);
      setSessionToken(resultado.sessionToken);
      setOtpTicket('');
      setEtapa('conversa');
    } catch (e) {
      setErro(e.message);
    } finally {
      setCarregando(false);
    }
  }

  async function carregarMensagens() {
    if (!conversaId || !sessionToken) return;

    try {
      const resultado = await requisicao(
        `/${encodeURIComponent(conversaId)}/mensagens`,
        'GET',
        null,
        sessionToken
      );

      const lista = Array.isArray(resultado)
        ? resultado
        : resultado.mensagens || resultado.resultado?.mensagens || [];

      if (Array.isArray(lista)) {
        setMensagens(lista);
      }
    } catch (e) {
      setErro(e.message);
    }
  }

  async function enviarMensagem() {
    const mensagem = texto.trim();
    if (!mensagem || carregando) return;

    setErro('');
    setCarregando(true);

    try {
      await requisicao(
        `/${encodeURIComponent(conversaId)}/enviar`,
        'POST',
        { texto: mensagem },
        sessionToken
      );

      setTexto('');
      await carregarMensagens();
    } catch (e) {
      setErro(e.message);
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    if (!visible || etapa !== 'conversa') return undefined;

    carregarMensagens();
    const intervalo = setInterval(carregarMensagens, 7000);

    return () => clearInterval(intervalo);
  }, [visible, etapa, conversaId, sessionToken]);

  useEffect(() => {
    if (visible && mensagens.length) {
      scrollRef.current?.scrollToEnd({ animated: true });
    }
  }, [mensagens, visible]);

  function fecharPainel() {
    setEtapa('identificacao');
    setNome('');
    setTelefone('');
    setCodigo('');
    setOtpTicket('');
    setConversaId('');
    setSessionToken('');
    setMensagens([]);
    setTexto('');
    setErro('');
    onClose?.();
  }

  function formatarTelefone(valor) {
    return valor.replace(/\D/g, '').slice(0, 13);
  }

  function textoMensagem(item) {
    return item.mensagem || item.texto || item.conteudo || item.body || '';
  }

  function mensagemDoCliente(item) {
    const origem = String(item.origem || item.remetente || item.autor || '').toLowerCase();
    return origem === 'cliente' || origem === 'user' || origem === 'usuario';
  }

  if (!visible) return null;

  return (
    <View style={styles.overlay} pointerEvents="box-none">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.panel}
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>CENTRONICTEC</Text>
            <Text style={styles.headerSubtitle}>Atendimento técnico</Text>
          </View>

          <Pressable onPress={fecharPainel} style={styles.closeButton}>
            <Text style={styles.closeText}>×</Text>
          </Pressable>
        </View>

        <View style={styles.content}>
          {etapa === 'identificacao' && (
            <>
              <Text style={styles.title}>Vamos começar?</Text>
              <Text style={styles.description}>
                Informe seu WhatsApp com DDD para receber um código de confirmação.
              </Text>

              <Text style={styles.label}>WhatsApp</Text>
              <TextInput
                style={styles.input}
                value={telefone}
                onChangeText={(valor) => setTelefone(formatarTelefone(valor))}
                placeholder="DDD + número"
                placeholderTextColor="#77808e"
                keyboardType="phone-pad"
                maxLength={13}
              />

              <Pressable
                style={[styles.primaryButton, carregando && styles.disabledButton]}
                onPress={solicitarCodigo}
                disabled={carregando || telefone.replace(/\D/g, '').length < 10}
              >
                {carregando ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>Enviar código</Text>}
              </Pressable>
            </>
          )}

          {etapa === 'codigo' && (
            <>
              <Text style={styles.title}>Confirme seu número</Text>
              <Text style={styles.description}>
                Digite o código de seis dígitos enviado pelo WhatsApp.
              </Text>

              <Text style={styles.label}>Código de confirmação</Text>
              <TextInput
                style={styles.input}
                value={codigo}
                onChangeText={(valor) => setCodigo(valor.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                placeholderTextColor="#77808e"
                keyboardType="number-pad"
                maxLength={6}
              />

              <Pressable
                style={[styles.primaryButton, carregando && styles.disabledButton]}
                onPress={confirmarCodigo}
                disabled={carregando || codigo.length !== 6}
              >
                {carregando ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>Confirmar código</Text>}
              </Pressable>

              <Pressable onPress={() => { setEtapa('identificacao'); setCodigo(''); }}>
                <Text style={styles.secondaryButtonText}>Voltar</Text>
              </Pressable>
            </>
          )}

          {etapa === 'nome' && (
            <>
              <Text style={styles.title}>Quase lá!</Text>
              <Text style={styles.description}>
                Como podemos chamar você durante o atendimento?
              </Text>

              <Text style={styles.label}>Seu nome</Text>
              <TextInput
                style={styles.input}
                value={nome}
                onChangeText={setNome}
                placeholder="Nome completo"
                placeholderTextColor="#77808e"
                autoCapitalize="words"
              />

              <Pressable
                style={[styles.primaryButton, carregando && styles.disabledButton]}
                onPress={iniciarAtendimento}
                disabled={carregando || nome.trim().length < 2}
              >
                {carregando ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>Iniciar atendimento</Text>}
              </Pressable>
            </>
          )}

          {etapa === 'conversa' && (
            <>
              <Text style={styles.title}>Atendimento iniciado</Text>
              <Text style={styles.description}>
                Envie sua mensagem. Nossa equipe dará continuidade à conversa.
              </Text>

              <ScrollView
                ref={scrollRef}
                style={styles.messageList}
                contentContainerStyle={styles.messageContent}
              >
                {mensagens.length === 0 ? (
                  <Text style={styles.emptyText}>Envie uma mensagem para iniciar a conversa.</Text>
                ) : (
                  mensagens.map((item, indice) => (
                    <View
                      key={item._id || item.id || indice}
                      style={[
                        styles.messageBubble,
                        mensagemDoCliente(item) ? styles.clientBubble : styles.supportBubble,
                      ]}
                    >
                      <Text style={styles.messageText}>{textoMensagem(item)}</Text>
                    </View>
                  ))
                )}
              </ScrollView>

              <View style={styles.sendRow}>
                <TextInput
                  style={[styles.input, styles.messageInput]}
                  value={texto}
                  onChangeText={setTexto}
                  placeholder="Digite sua mensagem..."
                  placeholderTextColor="#77808e"
                  multiline
                  maxLength={4000}
                />
                <Pressable
                  style={[styles.sendButton, (!texto.trim() || carregando) && styles.disabledButton]}
                  onPress={enviarMensagem}
                  disabled={!texto.trim() || carregando}
                >
                  <Text style={styles.primaryButtonText}>Enviar</Text>
                </Pressable>
              </View>
            </>
          )}

          {!!erro && <Text style={styles.errorText}>{erro}</Text>}
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>CENTRONICTEC • Atendimento seguro</Text>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 1000,
    justifyContent: 'flex-end',
    alignItems: 'flex-end',
    padding: 20,
    pointerEvents: 'box-none',
  },
  panel: {
    width: 380,
    maxWidth: '100%',
    height: 590,
    maxHeight: '85%',
    backgroundColor: '#111820',
    borderWidth: 1,
    borderColor: '#263747',
    borderRadius: 18,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 15,
  },
  header: {
    backgroundColor: '#0b1118',
    paddingHorizontal: 20,
    paddingVertical: 17,
    borderBottomWidth: 1,
    borderBottomColor: '#263747',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    color: '#eaf2fa',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 1.4,
  },
  headerSubtitle: {
    color: '#8da1b5',
    fontSize: 12,
    marginTop: 4,
  },
  closeButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1d2a36',
  },
  closeText: {
    color: '#dce8f2',
    fontSize: 25,
    lineHeight: 28,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  title: {
    color: '#f0f5fa',
    fontSize: 21,
    fontWeight: '700',
    marginBottom: 9,
  },
  description: {
    color: '#9baaba',
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 22,
  },
  label: {
    color: '#d5e0eb',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#19232e',
    borderWidth: 1,
    borderColor: '#344657',
    borderRadius: 9,
    color: '#f2f6fa',
    paddingHorizontal: 13,
    paddingVertical: 12,
    fontSize: 14,
    marginBottom: 16,
    minHeight: 46,
  },
  primaryButton: {
    backgroundColor: '#1769aa',
    borderRadius: 9,
    minHeight: 46,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 5,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  disabledButton: {
    opacity: 0.5,
  },
  secondaryButtonText: {
    color: '#8fc8f4',
    textAlign: 'center',
    marginTop: 18,
    fontSize: 13,
  },
  messageList: {
    flex: 1,
    marginBottom: 12,
  },
  messageContent: {
    paddingVertical: 8,
    gap: 10,
  },
  messageBubble: {
    maxWidth: '86%',
    padding: 12,
    borderRadius: 12,
  },
  clientBubble: {
    alignSelf: 'flex-end',
    backgroundColor: '#155b91',
  },
  supportBubble: {
    alignSelf: 'flex-start',
    backgroundColor: '#253341',
  },
  messageText: {
    color: '#f2f6fa',
    fontSize: 13,
    lineHeight: 19,
  },
  emptyText: {
    color: '#9baaba',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 30,
  },
  sendRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  messageInput: {
    flex: 1,
    minHeight: 44,
    maxHeight: 90,
    marginBottom: 0,
  },
  sendButton: {
    backgroundColor: '#1769aa',
    borderRadius: 9,
    minHeight: 44,
    paddingHorizontal: 15,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    color: '#ff8f8f',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 12,
  },
  footer: {
    paddingVertical: 11,
    alignItems: 'center',
    backgroundColor: '#0b1118',
    borderTopWidth: 1,
    borderTopColor: '#263747',
  },
  footerText: {
    color: '#718396',
    fontSize: 10,
    letterSpacing: 0.5,
  },
});
