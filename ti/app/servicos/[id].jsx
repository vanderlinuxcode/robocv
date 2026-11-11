
import React from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  Image,
} from 'react-native';
import { Link, Stack, useLocalSearchParams } from 'expo-router';
import { services } from '../../src/constants/services';

export default function ServiceDetails() {
  const { id } = useLocalSearchParams();

  const service = services.find(
    (item) => item.id === id
  );

  if (!service) {
    return (
      <View style={styles.page}>
        <Stack.Screen options={{ title: 'Serviço não encontrado' }} />

        <Text style={styles.title}>
          Serviço não encontrado
        </Text>

        <Link href="/" asChild>
          <Pressable style={styles.button}>
            <Text style={styles.buttonText}>
              Voltar ao início
            </Text>
          </Pressable>
        </Link>
      </View>
    );
  }

  return (
    <ScrollView style={styles.page}>
      <Stack.Screen
        options={{
          title: service.title,
          headerShown: false,
        }}
      />

        <Image
        source={service.image}
        style={styles.heroImage}
        resizeMode="contain"
      />

      <View style={styles.header}>
        <Link href="/" asChild>
          <Pressable>
            <Text style={styles.back}>
              ← Voltar ao início
            </Text>
          </Pressable>
        </Link>

        <Text style={styles.brand}>
          CENTRONICTEC
        </Text>
      </View>

      <View style={styles.hero}>
        <Text style={styles.eyebrow}>
          SERVIÇOS ESPECIALIZADOS
        </Text>

        <Text style={styles.symbol}>
          {service.icon}
        </Text>

        <Text style={styles.title}>
          {service.title}
        </Text>

        <Text style={styles.subtitle}>
          {service.subtitle}
        </Text>

        <Text style={styles.description}>
          {service.description}
        </Text>
      </View>

      <View style={styles.content}>
        <Text style={styles.sectionTitle}>
          O que oferecemos
        </Text>

        {service.items.map((item, index) => (
          <View key={index} style={styles.item}>
            <Text style={styles.check}>✓</Text>
            <Text style={styles.itemText}>{item}</Text>
          </View>
        ))}

        <View style={styles.notice}>
          <Text style={styles.noticeTitle}>
            Avaliação técnica e orçamento
          </Text>

          <Text style={styles.noticeText}>
            Cada equipamento e necessidade pode exigir
            procedimentos específicos. Os serviços e valores
            são definidos após avaliação técnica.
          </Text>
        </View>

        <Link href="/" asChild>
          <Pressable style={styles.button}>
            <Text style={styles.buttonText}>
              Voltar aos serviços
            </Text>
          </Pressable>
        </Link>
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>
          CENTRONICTEC • TECNOLOGIA E SOLUÇÕES
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: '#101318',
  },
  heroImage: {
    width: '100%',
    aspectRatio: 16 / 9,
    maxHeight: 460,
    backgroundColor: '#172638',
  },
  header: {
    minHeight: 72,
    paddingHorizontal: 25,
    backgroundColor: '#151A22',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#303B49',
  },
  back: {
    color: '#38A0FF',
    fontSize: 14,
    fontWeight: '700',
  },
  brand: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '900',
    letterSpacing: 1,
  },
  hero: {
    backgroundColor: '#172638',
    paddingHorizontal: 28,
    paddingVertical: 55,
    alignItems: 'center',
  },
  eyebrow: {
    color: '#38A0FF',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 2,
  },
  symbol: {
    color: '#38A0FF',
    fontSize: 65,
    marginTop: 18,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 35,
    fontWeight: '900',
    textAlign: 'center',
    marginTop: 12,
  },
  subtitle: {
    color: '#38A0FF',
    fontSize: 16,
    textAlign: 'center',
    marginTop: 12,
  },
  description: {
    color: '#C2D0DF',
    fontSize: 15,
    lineHeight: 25,
    textAlign: 'center',
    maxWidth: 700,
    marginTop: 22,
  },
  content: {
    width: '100%',
    maxWidth: 850,
    alignSelf: 'center',
    padding: 28,
  },
  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 25,
    fontWeight: '900',
    marginBottom: 25,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: '#293342',
    gap: 13,
  },
  check: {
    color: '#38A0FF',
    fontSize: 19,
    fontWeight: '900',
  },
  itemText: {
    color: '#D5DFEA',
    fontSize: 15,
    lineHeight: 23,
    flex: 1,
  },
  notice: {
    backgroundColor: '#191F29',
    borderWidth: 1,
    borderColor: '#303B49',
    borderRadius: 10,
    padding: 22,
    marginTop: 32,
  },
  noticeTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800',
  },
  noticeText: {
    color: '#AAB6C4',
    fontSize: 14,
    lineHeight: 23,
    marginTop: 10,
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
  footer: {
    backgroundColor: '#151A22',
    padding: 25,
    alignItems: 'center',
  },
  footerText: {
    color: '#71859B',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
    textAlign: 'center',
  },
});
