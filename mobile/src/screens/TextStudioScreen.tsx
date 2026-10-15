import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { PdfEngine } from '../services/pdfEngine';
import { FileService } from '../services/fileService';

export const TextStudioScreen: React.FC = () => {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [resultUri, setResultUri] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!content.trim()) {
      Alert.alert('Empty Content', 'Please enter some text or notes to generate a PDF.');
      return;
    }

    setLoading(true);
    setResultUri(null);

    try {
      const docTitle = title.trim() || 'Notes';
      const outName = `${docTitle.replace(/[^a-zA-Z0-9_-]/g, '_')}_${Date.now()}.pdf`;
      const uri = await PdfEngine.textToPdf(content, docTitle, outName);
      setResultUri(uri);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to generate PDF document.');
    } finally {
      setLoading(false);
    }
  };

  const handleShare = async () => {
    if (!resultUri) return;
    try {
      await FileService.shareFile(resultUri, 'application/pdf');
    } catch (err: any) {
      Alert.alert('Share Error', err.message || 'Unable to share document.');
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      <View style={styles.card}>
        <Text style={styles.label}>Document Title</Text>
        <TextInput
          style={styles.titleInput}
          placeholder="e.g. Project Summary, Meeting Minutes"
          placeholderTextColor={colors.textDim}
          value={title}
          onChangeText={setTitle}
        />

        <Text style={[styles.label, { marginTop: 14 }]}>Document Body / Notes</Text>
        <TextInput
          style={styles.bodyInput}
          placeholder="Type or paste your text here..."
          placeholderTextColor={colors.textDim}
          value={content}
          onChangeText={setContent}
          multiline
          textAlignVertical="top"
        />

        <TouchableOpacity
          style={[styles.generateBtn, loading && styles.btnDisabled]}
          activeOpacity={0.8}
          disabled={loading}
          onPress={handleGenerate}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="document-text" size={20} color="#fff" />
              <Text style={styles.btnText}>Generate Paginated PDF</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {resultUri && (
        <View style={styles.resultCard}>
          <View style={styles.resultIconBox}>
            <Ionicons name="checkmark-circle" size={32} color={colors.emerald} />
          </View>
          <View style={styles.resultInfo}>
            <Text style={styles.resultTitle}>PDF Generated!</Text>
            <Text style={styles.resultSubtitle}>Ready to export or print</Text>
          </View>
          <TouchableOpacity style={styles.shareBtn} onPress={handleShare} activeOpacity={0.8}>
            <Ionicons name="share-outline" size={18} color="#fff" />
            <Text style={styles.shareBtnText}>Share</Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: 16,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted,
    marginBottom: 8,
  },
  titleInput: {
    backgroundColor: colors.bg,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    color: colors.text,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    fontWeight: '600',
  },
  bodyInput: {
    backgroundColor: colors.bg,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    color: colors.text,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 14,
    minHeight: 180,
    lineHeight: 20,
  },
  generateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    paddingVertical: 15,
    borderRadius: 12,
    marginTop: 18,
  },
  btnDisabled: {
    opacity: 0.6,
  },
  btnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  resultCard: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.4)',
    padding: 16,
    marginTop: 18,
    flexDirection: 'row',
    alignItems: 'center',
  },
  resultIconBox: {
    marginRight: 12,
  },
  resultInfo: {
    flex: 1,
  },
  resultTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.emerald,
  },
  resultSubtitle: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.emerald,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  shareBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
});
