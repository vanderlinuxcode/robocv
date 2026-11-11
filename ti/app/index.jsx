import React, { useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
} from 'react-native';

import Header from '../src/components/Header';
import HeroCarrossel from '../src/components/HeroCarrossel';
import Services from '../src/components/Services';
import ChatPanel from '../src/components/ChatPanel';


const services = [
  {
    id: 'notebooks',
    title: 'Notebooks e desktops',
    description: 'Diagnóstico, manutenção e recuperação de equipamentos.',
    symbol: '▣',
  },
  {
    id: 'apple',
    title: 'MacBook e iMac',
    description: 'Manutenção especializada em equipamentos Apple.',
    symbol: '⌘',
  },
  {
    id: 'sistemas',
    title: 'Formatação e sistemas',
    description: 'Windows, macOS e Linux: instalação e configuração.',
    symbol: '▤',
  },
  {
    id: 'upgrade',
    title: 'Upgrade e desempenho',
    description: 'SSD, NVMe, memória RAM e otimização.',
    symbol: '◈',
  },
  {
    id: 'redes',
    title: 'Redes e Wi-Fi',
    description: 'Roteadores, switches e access points.',
    symbol: '⌁',
  },
  {
    id: 'seguranca',
    title: 'Segurança e reparos',
    description: 'Manutenção eletrônica e proteção ESD.',
    symbol: '⬡',
  },
];

export default function HomeScreen() {
  const router = useRouter();
  const scrollRef = useRef(null);
  const sectionPositions = useRef({});
  const [showBackToTop, setShowBackToTop] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);

  function registerSection(id, event) {
    sectionPositions.current[id] = event.nativeEvent.layout.y;
  }

  function navigateToSection(id) {
    if (id === 'chat') {
      setChatOpen(true);
      return;
    }

    const y = sectionPositions.current[id];

    if (id === 'inicio') {
      scrollRef.current?.scrollTo({ y: 0, animated: true });
      return;
    }

    if (typeof y === 'number') {
      scrollRef.current?.scrollTo({ y, animated: true });
    }
  }

  function handleScroll(event) {
    setShowBackToTop(event.nativeEvent.contentOffset.y > 300);
  }

  return (
    <View style={styles.page}>
      <Header onNavigate={navigateToSection} />

      <ScrollView
        ref={scrollRef}
        style={styles.scrollArea}
        onScroll={handleScroll}
        scrollEventThrottle={16}
      >
        <View onLayout={(event) => registerSection('inicio', event)}>
          <HeroCarrossel />
        </View>

        <View onLayout={(event) => registerSection('servicos', event)}>
          <Services />
        </View>

      <View style={styles.section}>
        <Text style={styles.eyebrow}>CENTRONICTEC</Text>
        <Text style={styles.heading}>Nossas soluções</Text>
        <Text style={styles.intro}>
          Tecnologia e assistência especializada para equipamentos,
          sistemas e infraestrutura.
        </Text>

        <View style={styles.grid}>
          {services.map((service) => (
            <View key={service.title} style={styles.card}>
              <Text style={styles.symbol}>{service.symbol}</Text>
              <Text style={styles.cardTitle}>{service.title}</Text>
              <Text style={styles.cardDescription}>
                {service.description}
              </Text>
              <Pressable
                onPress={() => router.push(`/servicos/${service.id}`)}
                accessibilityRole="link"
              >
                <Text style={styles.more}>Saiba mais →</Text>
              </Pressable>
            </View>
          ))}
        </View>
      </View>

      <View
        style={styles.appleSection}
        onLayout={(event) => registerSection('apple', event)}
      >
        <Text style={styles.eyebrow}>LINHA APPLE</Text>
        <Text style={styles.appleTitle}>
          Especialização em MacBook, macOS e iMac.
        </Text>
        <Text style={styles.appleDescription}>
          Serviços dedicados à manutenção, configuração e recuperação
          de equipamentos Apple.
        </Text>
      </View>

      <View
        style={styles.orcamentoSection}
        onLayout={(event) => registerSection('orcamento', event)}
      >
        <Text style={styles.eyebrow}>ORÇAMENTO</Text>
        <Text style={styles.heading}>Solicite uma avaliação</Text>
        <Text style={styles.intro}>
          Entre em contato para apresentar sua necessidade e solicitar
          uma avaliação técnica dos serviços.
        </Text>
        <Pressable
          style={styles.quoteButton}
          onPress={() => navigateToSection('chat')}
        >
          <Text style={styles.buttonText}>Falar com a CENTRONICTEC</Text>
        </Pressable>
      </View>

      <View
        style={styles.contact}
        onLayout={(event) => registerSection('contato', event)}
      >
        <Text style={styles.heading}>Precisa de assistência?</Text>
        <Text style={styles.intro}>
          Entre em contato para solicitar uma avaliação ou orçamento.
        </Text>
        <Text style={styles.contactBrand}>CENTRONICTEC</Text>
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>
          © 2026 CENTRONIC TECNOLOGIA • Todos os direitos reservados MIT — Vanderli Marques dos Reis
        </Text>
      </View>
      </ScrollView>

      <ChatPanel visible={chatOpen} onClose={() => setChatOpen(false)} />

      {showBackToTop && (
        <Pressable
          style={styles.backToTop}
          onPress={() => scrollRef.current?.scrollTo({ y: 0, animated: true })}
          accessibilityRole="button"
          accessibilityLabel="Voltar ao topo"
        >
          <Text style={styles.backToTopText}>↑</Text>
        </Pressable>
      )}
    </View>
  );
}


const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: '#101318',
  },
  scrollArea: {
    flex: 1,
    backgroundColor: '#101318',
  },
  section: {
    paddingVertical: 65,
    paddingHorizontal: 25,
    maxWidth: 1200,
    width: '100%',
    alignSelf: 'center',
  },
  eyebrow: {
    color: '#1685E8',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 2,
    marginBottom: 12,
  },
  heading: {
    color: '#FFFFFF',
    fontSize: 34,
    fontWeight: '900',
  },
  intro: {
    color: '#AAB6C4',
    fontSize: 15,
    lineHeight: 24,
    marginTop: 12,
    maxWidth: 650,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    marginTop: 35,
  },
  card: {
    flexGrow: 1,
    flexBasis: 280,
    backgroundColor: '#191F29',
    borderColor: '#303B49',
    borderWidth: 1,
    borderRadius: 12,
    padding: 23,
    minHeight: 205,
  },
  symbol: {
    color: '#38A0FF',
    fontSize: 35,
    marginBottom: 15,
  },
  cardTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
  },
  cardDescription: {
    color: '#AAB6C4',
    fontSize: 14,
    lineHeight: 22,
    marginTop: 10,
  },
  more: {
    color: '#38A0FF',
    fontWeight: '700',
    marginTop: 17,
  },
  appleSection: {
    backgroundColor: '#172638',
    padding: 40,
    alignItems: 'center',
  },
  appleTitle: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '900',
    textAlign: 'center',
    maxWidth: 700,
  },
  appleDescription: {
    color: '#C2D0DF',
    textAlign: 'center',
    lineHeight: 24,
    marginTop: 15,
    maxWidth: 650,
  },
  orcamentoSection: {
    paddingVertical: 55,
    paddingHorizontal: 25,
    alignItems: 'center',
    backgroundColor: '#151A22',
  },
  quoteButton: {
    backgroundColor: '#1478D4',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 7,
    marginTop: 24,
  },
  contact: {
    padding: 45,
    alignItems: 'center',
  },
  footer: {
    backgroundColor: '#151A22',
    borderTopWidth: 1,
    borderTopColor: '#293342',
    paddingVertical: 22,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  footerText: {
    color: '#AAB6C4',
    fontSize: 11,
    lineHeight: 19,
    textAlign: 'center',
  },
  backToTop: {
    position: 'absolute',
    right: 22,
    bottom: 26,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#1478D4',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
    zIndex: 200,
  },
  backToTopText: {
    color: '#FFFFFF',
    fontSize: 29,
    fontWeight: '800',
    lineHeight: 34,
  },
  contactBrand: {
    color: '#38A0FF',
    fontWeight: '900',
    fontSize: 20,
    letterSpacing: 2,
    marginTop: 30,
  },
});
