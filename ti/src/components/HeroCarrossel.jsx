import React, { useEffect, useState } from 'react';
import {
  View,
  ImageBackground,
  Text,
  StyleSheet,
  Pressable,
  useWindowDimensions,
} from 'react-native';

const slides = [
  {
    eyebrow: 'TECNOLOGIA E MANUTENÇÃO',
    title: 'Desempenho, Upgrade de Hardware e Software.',
    description:
      'Manutenção especializada, suporte técnico e soluções tecnológicas para computadores e infraestrutura.',
  },
  {
    eyebrow: 'ESPECIALISTAS APPLE',
    title: 'Reparação MacBook, Imac e MacMini.',
    description:
      'Diagnóstico, manutenção, recuperação e configuração de equipamentos Apple Sistema Operacional Macintosh.',
  },
  {
    eyebrow: 'INFRAESTRUTURA E CONECTIVIDADE',
    title: 'Conectividade, desempenho e segurança.',
    description:
      'Redes Wi-Fi, roteadores, access points, switches e soluções de nuvem híbrida.',
  },
  {
    eyebrow: 'SISTEMAS OPERACIONAIS',
    title: 'Customização para o máximo desempenho.',
    description:
      'Formatação, instalação, atualização e customização de Windows, MacOsX e Linux.',
  },
  {
    eyebrow: 'CONFIGURAÇÃO E PERSONALIZAÇÃO',
    title: 'Tecnologia configurada para suas necessidades.',
    description:
      'Instalação de aplicativos, configuração de sistemas, otimização e personalização de equipamentos Apple.',
  },
];

export default function HeroCarrossel() {
  const [active, setActive] = useState(0);
  const { width } = useWindowDimensions();
  const compact = width < 700;
  const slide = slides[active];

  useEffect(() => {
    const timer = setInterval(() => {
      setActive((current) => (current + 1) % slides.length);
    }, 6000);

    return () => clearInterval(timer);
  }, []);

  return (
    <ImageBackground
      source={require('../../assets/images/hero/carrossel_imagem.png')}
      style={[styles.container, compact && styles.containerCompact]}
      resizeMode="cover"
    >
      <View style={styles.overlay} />
      <View style={styles.content}>
        <Text style={styles.eyebrow}>{slide.eyebrow}</Text>

        <Text
          style={[
            styles.title,
            compact && styles.titleCompact,
          ]}
        >
          {slide.title}
        </Text>

        <Text style={styles.description}>
          {slide.description}
        </Text>

        <Pressable style={styles.button}>
          <Text style={styles.buttonText}>
            Conheça nossos serviços
          </Text>
        </Pressable>

        <View style={styles.indicators}>
          {slides.map((item, index) => (
            <Pressable
              key={item.eyebrow}
              onPress={() => setActive(index)}
              style={[
                styles.indicator,
                active === index && styles.indicatorActive,
              ]}
            />
          ))}
        </View>
      </View>

    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#101923',
    width: '100%',
    alignSelf: 'stretch',
    minHeight: 420,
    paddingVertical: 58,
    paddingHorizontal: 28,
    justifyContent: 'center',
  },
  containerCompact: {
    minHeight: 500,
    paddingHorizontal: 22,
    paddingVertical: 45,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(5, 12, 20, 0.72)',
  },
  content: {
    width: '100%',
    maxWidth: 760,
    zIndex: 1,
  },
  eyebrow: {
    color: '#38A0FF',
    fontWeight: '800',
    fontSize: 12,
    letterSpacing: 2,
    marginBottom: 18,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 43,
    lineHeight: 53,
    fontWeight: '900',
    maxWidth: 680,
  },
  titleCompact: {
    fontSize: 32,
    lineHeight: 40,
  },
  description: {
    color: '#B8C5D3',
    fontSize: 16,
    lineHeight: 26,
    marginTop: 20,
    maxWidth: 580,
  },
  button: {
    backgroundColor: '#1478D4',
    paddingVertical: 15,
    paddingHorizontal: 22,
    borderRadius: 7,
    alignSelf: 'flex-start',
    marginTop: 25,
  },
  buttonText: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  indicators: {
    flexDirection: 'row',
    gap: 9,
    marginTop: 35,
  },
  indicator: {
    width: 23,
    height: 5,
    borderRadius: 5,
    backgroundColor: '#536171',
  },
  indicatorActive: {
    width: 45,
    backgroundColor: '#1685E8',
  },
});
