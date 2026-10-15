import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Text } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { StudioTab } from './src/types';
import { colors } from './src/theme/colors';
import { Header } from './src/components/Header';
import { HomeScreen } from './src/screens/HomeScreen';
import { PdfStudioScreen } from './src/screens/PdfStudioScreen';
import { ImageStudioScreen } from './src/screens/ImageStudioScreen';
import { TextStudioScreen } from './src/screens/TextStudioScreen';
import { HistoryScreen } from './src/screens/HistoryScreen';

export default function App() {
  const [activeTab, setActiveTab] = useState<StudioTab>('home');

  const getScreenTitle = (): { title: string; subtitle: string } => {
    switch (activeTab) {
      case 'pdf':
        return { title: 'PDF Studio', subtitle: 'Merge, Split, Extract & Rotate' };
      case 'image':
        return { title: 'Image Studio', subtitle: 'Combine to PDF, Convert & Compress' };
      case 'text':
        return { title: 'Text Studio', subtitle: 'Type or Paste Text to Paginated PDF' };
      case 'history':
        return { title: 'Converted Files', subtitle: 'Manage & Share Exported Documents' };
      default:
        return { title: 'Universal File Converter', subtitle: '100% On-Device & Private' };
    }
  };

  const { title, subtitle } = getScreenTitle();

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <StatusBar style="light" />

        {/* Global Header */}
        <Header title={title} subtitle={subtitle} />

        {/* Main Screen Body */}
        <View style={styles.content}>
          {activeTab === 'home' && <HomeScreen onNavigate={setActiveTab} />}
          {activeTab === 'pdf' && <PdfStudioScreen />}
          {activeTab === 'image' && <ImageStudioScreen />}
          {activeTab === 'text' && <TextStudioScreen />}
          {activeTab === 'history' && <HistoryScreen />}
        </View>

        {/* Bottom Navigation Dock */}
        <View style={styles.bottomNav}>
          <TouchableOpacity
            style={styles.navItem}
            onPress={() => setActiveTab('home')}
            activeOpacity={0.7}
          >
            <Ionicons
              name={activeTab === 'home' ? 'home' : 'home-outline'}
              size={22}
              color={activeTab === 'home' ? colors.primary : colors.textDim}
            />
            <Text style={[styles.navLabel, activeTab === 'home' && styles.navLabelActive]}>
              Home
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.navItem}
            onPress={() => setActiveTab('pdf')}
            activeOpacity={0.7}
          >
            <Ionicons
              name={activeTab === 'pdf' ? 'document-text' : 'document-text-outline'}
              size={22}
              color={activeTab === 'pdf' ? colors.primary : colors.textDim}
            />
            <Text style={[styles.navLabel, activeTab === 'pdf' && styles.navLabelActive]}>
              PDF
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.navItem}
            onPress={() => setActiveTab('image')}
            activeOpacity={0.7}
          >
            <Ionicons
              name={activeTab === 'image' ? 'images' : 'images-outline'}
              size={22}
              color={activeTab === 'image' ? colors.primary : colors.textDim}
            />
            <Text style={[styles.navLabel, activeTab === 'image' && styles.navLabelActive]}>
              Images
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.navItem}
            onPress={() => setActiveTab('text')}
            activeOpacity={0.7}
          >
            <Ionicons
              name={activeTab === 'text' ? 'create' : 'create-outline'}
              size={22}
              color={activeTab === 'text' ? colors.primary : colors.textDim}
            />
            <Text style={[styles.navLabel, activeTab === 'text' && styles.navLabelActive]}>
              Notes
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.navItem}
            onPress={() => setActiveTab('history')}
            activeOpacity={0.7}
          >
            <Ionicons
              name={activeTab === 'history' ? 'folder-open' : 'folder-open-outline'}
              size={22}
              color={activeTab === 'history' ? colors.primary : colors.textDim}
            />
            <Text style={[styles.navLabel, activeTab === 'history' && styles.navLabelActive]}>
              Files
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    flex: 1,
  },
  bottomNav: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.cardBorder,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textDim,
    marginTop: 4,
  },
  navLabelActive: {
    color: colors.primary,
  },
});
