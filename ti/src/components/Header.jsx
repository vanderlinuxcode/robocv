import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  useWindowDimensions,
} from 'react-native';

const navigationItems = [
  { label: 'Início', id: 'inicio' },
  { label: 'Serviços', id: 'servicos' },
  { label: 'Apple', id: 'apple' },
  { label: 'Orçamento', id: 'orcamento' },
  { label: 'Contato', id: 'contato' },
];

export default function Header({ onNavigate }) {
  const { width } = useWindowDimensions();
  const compact = width < 760;
  const [menuOpen, setMenuOpen] = useState(false);
  const [hoveredItem, setHoveredItem] = useState(null);

  function navigateTo(id) {
    setMenuOpen(false);
    if (onNavigate) onNavigate(id);
  }

  return (
    <View style={styles.wrapper}>
      <View style={styles.container}>
        <Pressable onPress={() => navigateTo('inicio')}>
          <Text style={styles.logo}>
            CENTRONIC<Text style={styles.logoBlue}>TEC</Text>
          </Text>
        </Pressable>

        {!compact && (
          <View style={styles.navigation}>
            {navigationItems.map((item) => (
              <Pressable
                key={item.id}
                onPress={() => navigateTo(item.id)}
                onHoverIn={() => setHoveredItem(item.id)}
                onHoverOut={() => setHoveredItem(null)}
                style={[
                  styles.navItem,
                  hoveredItem === item.id && styles.navItemHovered,
                ]}
              >
                <Text
                  style={[
                    styles.link,
                    hoveredItem === item.id && styles.linkHovered,
                  ]}
                >
                  {item.label}
                </Text>
              </Pressable>
            ))}
          </View>
        )}

        {compact && (
          <Pressable
            onPress={() => setMenuOpen((open) => !open)}
            style={styles.menuButton}
            accessibilityRole="button"
            accessibilityLabel={menuOpen ? 'Fechar menu' : 'Abrir menu'}
          >
            <Text style={styles.menuIcon}>
              {menuOpen ? '✕' : '☰'}
            </Text>
          </Pressable>
        )}

        {!compact && (
          <Pressable
            style={styles.button}
            onPress={() => navigateTo('chat')}
          >
            <Text style={styles.buttonText}>Atendimento</Text>
          </Pressable>
        )}
      </View>

      {compact && menuOpen && (
        <View style={styles.mobileMenu}>
          {navigationItems.map((item) => (
            <Pressable
              key={item.id}
              onPress={() => navigateTo(item.id)}
              style={styles.mobileItem}
            >
              <Text style={styles.mobileLink}>{item.label}</Text>
            </Pressable>
          ))}

          <Pressable
            style={styles.mobileButton}
            onPress={() => navigateTo('chat')}
          >
            <Text style={styles.buttonText}>Atendimento</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: '100%',
    backgroundColor: '#151A22',
    borderBottomWidth: 1,
    borderBottomColor: '#1685E8',
    zIndex: 100,
    elevation: 8,
  },
  container: {
    minHeight: 76,
    paddingHorizontal: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 14,
  },
  logo: {
    color: '#FFFFFF',
    fontSize: 21,
    fontWeight: '900',
    letterSpacing: 1,
  },
  logoBlue: {
    color: '#1685E8',
  },
  navigation: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 24,
  },
  navItem: {
    paddingVertical: 12,
  },
  navItemHovered: {
    transform: [{ translateY: -3 }],
  },
  link: {
    color: '#D5DFEA',
    fontSize: 13,
    fontWeight: '600',
  },
  linkHovered: {
    color: '#38A0FF',
  },
  button: {
    backgroundColor: '#1478D4',
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 7,
  },
  buttonText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  menuButton: {
    minWidth: 46,
    minHeight: 46,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuIcon: {
    color: '#FFFFFF',
    fontSize: 27,
    fontWeight: '700',
  },
  mobileMenu: {
    paddingHorizontal: 22,
    paddingTop: 8,
    paddingBottom: 20,
    backgroundColor: '#151A22',
    borderTopWidth: 1,
    borderTopColor: '#293342',
  },
  mobileItem: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#293342',
  },
  mobileLink: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  mobileButton: {
    backgroundColor: '#1478D4',
    paddingVertical: 13,
    paddingHorizontal: 18,
    borderRadius: 7,
    alignItems: 'center',
    marginTop: 16,
  },
});
