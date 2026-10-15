import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../theme/colors';

interface HeaderProps {
  title?: string;
  subtitle?: string;
}

export const Header: React.FC<HeaderProps> = ({
  title = 'Universal File Converter',
  subtitle = '100% Local & Private Processing',
}) => {
  return (
    <View style={styles.container}>
      <View style={styles.titleRow}>
        <Text style={styles.title}>{title}</Text>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>OFFLINE</Text>
        </View>
      </View>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 16,
    backgroundColor: colors.bg,
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBorder,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    letterSpacing: -0.5,
  },
  badge: {
    backgroundColor: colors.emeraldLight,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.4)',
  },
  badgeText: {
    color: colors.emerald,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 4,
  },
});
