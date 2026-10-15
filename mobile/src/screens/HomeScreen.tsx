import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StudioTab } from '../types';
import { colors } from '../theme/colors';

interface HomeScreenProps {
  onNavigate: (tab: StudioTab) => void;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({ onNavigate }) => {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Privacy & Highlights Banner */}
      <View style={styles.banner}>
        <View style={styles.bannerIcon}>
          <Ionicons name="shield-checkmark" size={28} color={colors.emerald} />
        </View>
        <View style={styles.bannerTextContainer}>
          <Text style={styles.bannerTitle}>100% On-Device & Private</Text>
          <Text style={styles.bannerSubtitle}>
            Zero cloud uploads. Your files never leave this device.
          </Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Conversion Studios</Text>

      {/* PDF Studio Card */}
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.7}
        onPress={() => onNavigate('pdf')}
      >
        <View style={[styles.cardIconBox, { backgroundColor: colors.primaryLight }]}>
          <Ionicons name="document-text" size={28} color={colors.primary} />
        </View>
        <View style={styles.cardInfo}>
          <View style={styles.cardTitleRow}>
            <Text style={styles.cardTitle}>PDF Studio</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.textDim} />
          </View>
          <Text style={styles.cardDescription}>
            Merge multiple PDFs, split pages, extract ranges, and rotate orientation.
          </Text>
          <View style={styles.tagRow}>
            <View style={styles.tag}><Text style={styles.tagText}>Merge</Text></View>
            <View style={styles.tag}><Text style={styles.tagText}>Split</Text></View>
            <View style={styles.tag}><Text style={styles.tagText}>Extract</Text></View>
            <View style={styles.tag}><Text style={styles.tagText}>Rotate</Text></View>
          </View>
        </View>
      </TouchableOpacity>

      {/* Image Studio Card */}
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.7}
        onPress={() => onNavigate('image')}
      >
        <View style={[styles.cardIconBox, { backgroundColor: colors.skyLight }]}>
          <Ionicons name="images" size={28} color={colors.sky} />
        </View>
        <View style={styles.cardInfo}>
          <View style={styles.cardTitleRow}>
            <Text style={styles.cardTitle}>Image Studio</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.textDim} />
          </View>
          <Text style={styles.cardDescription}>
            Combine photos into multi-page PDFs, convert formats (PNG, JPG, WEBP), and compress size.
          </Text>
          <View style={styles.tagRow}>
            <View style={styles.tag}><Text style={styles.tagText}>To PDF</Text></View>
            <View style={styles.tag}><Text style={styles.tagText}>Convert</Text></View>
            <View style={styles.tag}><Text style={styles.tagText}>Compress</Text></View>
          </View>
        </View>
      </TouchableOpacity>

      {/* Text Studio Card */}
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.7}
        onPress={() => onNavigate('text')}
      >
        <View style={[styles.cardIconBox, { backgroundColor: colors.amberLight }]}>
          <Ionicons name="create" size={28} color={colors.amber} />
        </View>
        <View style={styles.cardInfo}>
          <View style={styles.cardTitleRow}>
            <Text style={styles.cardTitle}>Text & Notes to PDF</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.textDim} />
          </View>
          <Text style={styles.cardDescription}>
            Type or paste text and export crisp, paginated PDF documents with page numbers.
          </Text>
          <View style={styles.tagRow}>
            <View style={styles.tag}><Text style={styles.tagText}>Text to PDF</Text></View>
            <View style={styles.tag}><Text style={styles.tagText}>Markdown</Text></View>
          </View>
        </View>
      </TouchableOpacity>

      {/* History / Recent Files Card */}
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.7}
        onPress={() => onNavigate('history')}
      >
        <View style={[styles.cardIconBox, { backgroundColor: colors.emeraldLight }]}>
          <Ionicons name="folder-open" size={28} color={colors.emerald} />
        </View>
        <View style={styles.cardInfo}>
          <View style={styles.cardTitleRow}>
            <Text style={styles.cardTitle}>Converted Files</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.textDim} />
          </View>
          <Text style={styles.cardDescription}>
            Access your processed documents, share via AirDrop/WhatsApp, or save to device storage.
          </Text>
        </View>
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
    marginBottom: 24,
  },
  bannerIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.emeraldLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  bannerTextContainer: {
    flex: 1,
  },
  bannerTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  bannerSubtitle: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
    lineHeight: 16,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 12,
  },
  card: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: 16,
    marginBottom: 14,
  },
  cardIconBox: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  cardInfo: {
    flex: 1,
  },
  cardTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  cardDescription: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 4,
    lineHeight: 18,
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 10,
  },
  tag: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  tagText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textMuted,
  },
});
