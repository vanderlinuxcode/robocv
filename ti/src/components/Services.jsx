
import React from 'react';
import {
  View,
  Text,
  Image,
  ScrollView,
  StyleSheet,
  Pressable,
} from 'react-native';

import { Link } from 'expo-router';
import { services } from '../constants/services';

export default function Services() {
  return (
    <View style={styles.section}>
      <View style={styles.headingGroup}>
        <Text style={styles.eyebrow}>
          NOSSO UNIVERSO TECNOLÓGICO
        </Text>

        <Text style={styles.heading}>
          Equipamentos e especialidades
        </Text>

        <Text style={styles.subtitle}>
          Conheça nossas áreas de atuação em tecnologia,
          manutenção e infraestrutura.
        </Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.carousel}
      >
        {services.map((item) => (
          <Link
            key={item.id}
            href={`/servicos/${item.id}`}
            asChild
          >
            <Pressable
              style={({ pressed }) => [
                styles.card,
                pressed && styles.cardPressed,
              ]}
            >
              <Image
                source={item.image}
                style={styles.cardImage}
                resizeMode="cover"
              />

              <View style={styles.cardContent}>
                <View>
                  <Text style={styles.cardTitle}>
                    {item.title}
                  </Text>

                  <Text style={styles.cardDescription}>
                    {item.subtitle}
                  </Text>
                </View>

                <View style={styles.cardFooter}>
                  <Text style={styles.cardFooterText}>
                    CONHECER SERVIÇO
                  </Text>

                  <Text style={styles.arrow}>→</Text>
                </View>
              </View>
            </Pressable>
          </Link>
        ))}
      </ScrollView>

      <Text style={styles.note}>
        Serviços sujeitos à avaliação técnica e orçamento.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    backgroundColor: '#101318',
    paddingTop: 55,
    paddingBottom: 45,
  },
  headingGroup: {
    paddingHorizontal: 25,
    marginBottom: 28,
    maxWidth: 1200,
    width: '100%',
    alignSelf: 'center',
  },
  eyebrow: {
    color: '#38A0FF',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 2,
    marginBottom: 12,
  },
  heading: {
    color: '#FFFFFF',
    fontSize: 29,
    fontWeight: '900',
  },
  subtitle: {
    color: '#AAB6C4',
    fontSize: 14,
    lineHeight: 23,
    marginTop: 10,
    maxWidth: 620,
  },
  carousel: {
    paddingHorizontal: 25,
    paddingBottom: 12,
    gap: 16,
  },
  card: {
    width: 270,
    backgroundColor: '#191F29',
    borderWidth: 1,
    borderColor: '#303B49',
    borderRadius: 12,
    overflow: 'hidden',
  },
  cardPressed: {
    borderColor: '#38A0FF',
    opacity: 0.85,
  },
  cardImage: {
    width: '100%',
    height: 152,
    backgroundColor: '#172638',
  },
  cardContent: {
    padding: 18,
    minHeight: 145,
    justifyContent: 'space-between',
  },
  cardTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800',
  },
  cardDescription: {
    color: '#AAB6C4',
    fontSize: 13,
    lineHeight: 21,
    marginTop: 9,
  },
  cardFooter: {
    borderTopWidth: 1,
    borderTopColor: '#303B49',
    marginTop: 18,
    paddingTop: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardFooterText: {
    color: '#71859B',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1,
  },
  arrow: {
    color: '#38A0FF',
    fontSize: 22,
  },
  note: {
    color: '#718090',
    fontSize: 11,
    paddingHorizontal: 25,
    marginTop: 12,
    maxWidth: 1200,
    width: '100%',
    alignSelf: 'center',
  },
});
