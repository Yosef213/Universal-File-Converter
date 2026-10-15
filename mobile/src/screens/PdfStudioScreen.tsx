import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FileItem } from '../types';
import { colors } from '../theme/colors';
import { FileService } from '../services/fileService';
import { PdfEngine } from '../services/pdfEngine';
import { FileList } from '../components/FileList';

type PdfOp = 'merge' | 'split' | 'extract' | 'rotate';

export const PdfStudioScreen: React.FC = () => {
  const [activeOp, setActiveOp] = useState<PdfOp>('merge');
  const [files, setFiles] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [pageRange, setPageRange] = useState('');
  const [rotationAngle, setRotationAngle] = useState<90 | 180 | 270>(90);
  const [resultUri, setResultUri] = useState<string | null>(null);
  const [resultName, setResultName] = useState<string>('');

  const handlePickFiles = async () => {
    try {
      const picked = await FileService.pickDocuments(
        ['application/pdf'],
        activeOp === 'merge' // Only merge allows multiple files
      );
      if (picked.length > 0) {
        setFiles(activeOp === 'merge' ? [...files, ...picked] : picked);
        setResultUri(null);
      }
    } catch {
      Alert.alert('Error', 'Failed to pick PDF file(s).');
    }
  };

  const handleRemoveFile = (id: string) => {
    setFiles(files.filter((f) => f.id !== id));
  };

  const handleClearFiles = () => {
    setFiles([]);
    setResultUri(null);
  };

  const handleProcess = async () => {
    if (files.length === 0) {
      Alert.alert('No Files', 'Please select at least one PDF file first.');
      return;
    }

    setLoading(true);
    setResultUri(null);

    try {
      let outputUri = '';
      let outName = '';

      if (activeOp === 'merge') {
        if (files.length < 2) {
          Alert.alert('Merge Notice', 'Please add at least 2 PDF files to merge.');
          setLoading(false);
          return;
        }
        outName = `Merged_${Date.now()}.pdf`;
        outputUri = await PdfEngine.mergePdfs(files.map((f) => f.uri), outName);
      } else if (activeOp === 'split') {
        const uris = await PdfEngine.splitPdf(files[0].uri, 'Page');
        if (uris.length > 0) {
          outputUri = uris[0];
          outName = `${uris.length} pages split successfully`;
          Alert.alert('Success', `Split into ${uris.length} separate PDF pages.`);
        }
      } else if (activeOp === 'extract') {
        if (!pageRange.trim()) {
          Alert.alert('Page Range Required', 'Please specify pages to extract (e.g. 1-3, 5).');
          setLoading(false);
          return;
        }
        outName = `Extracted_${Date.now()}.pdf`;
        outputUri = await PdfEngine.extractPages(files[0].uri, pageRange, outName);
      } else if (activeOp === 'rotate') {
        outName = `Rotated_${Date.now()}.pdf`;
        outputUri = await PdfEngine.rotatePdf(
          files[0].uri,
          rotationAngle,
          pageRange.trim() || undefined,
          outName
        );
      }

      setResultUri(outputUri);
      setResultName(outName);
    } catch (err: any) {
      Alert.alert('Processing Error', err.message || 'An error occurred during PDF conversion.');
    } finally {
      setLoading(false);
    }
  };

  const handleShareResult = async () => {
    if (!resultUri) return;
    try {
      await FileService.shareFile(resultUri, 'application/pdf');
    } catch (err: any) {
      Alert.alert('Share Error', err.message || 'Unable to share document.');
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Operation Tabs */}
      <View style={styles.tabBar}>
        {(['merge', 'split', 'extract', 'rotate'] as PdfOp[]).map((op) => (
          <TouchableOpacity
            key={op}
            style={[styles.tabItem, activeOp === op && styles.tabItemActive]}
            onPress={() => {
              setActiveOp(op);
              setResultUri(null);
              if (op !== 'merge' && files.length > 1) {
                setFiles([files[0]]);
              }
            }}
          >
            <Text style={[styles.tabText, activeOp === op && styles.tabTextActive]}>
              {op.charAt(0).toUpperCase() + op.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Action / Picker Button */}
      <TouchableOpacity
        style={styles.pickButton}
        activeOpacity={0.8}
        onPress={handlePickFiles}
      >
        <Ionicons name="document-attach" size={24} color={colors.primary} />
        <Text style={styles.pickButtonText}>
          {files.length === 0
            ? activeOp === 'merge'
              ? 'Select Multiple PDFs'
              : 'Select PDF File'
            : activeOp === 'merge'
            ? 'Add More PDFs'
            : 'Change Selected PDF'}
        </Text>
      </TouchableOpacity>

      {/* Selected Files */}
      <FileList files={files} onRemove={handleRemoveFile} onClear={handleClearFiles} />

      {/* Operation Specific Options */}
      {activeOp === 'extract' && (
        <View style={styles.optionsCard}>
          <Text style={styles.optionsLabel}>Page Range to Extract</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. 1-3, 5, 8-"
            placeholderTextColor={colors.textDim}
            value={pageRange}
            onChangeText={setPageRange}
          />
          <Text style={styles.optionsHint}>
            Specify single pages or comma-separated ranges.
          </Text>
        </View>
      )}

      {activeOp === 'rotate' && (
        <View style={styles.optionsCard}>
          <Text style={styles.optionsLabel}>Rotation Angle</Text>
          <View style={styles.angleRow}>
            {([90, 180, 270] as const).map((angle) => (
              <TouchableOpacity
                key={angle}
                style={[styles.angleBtn, rotationAngle === angle && styles.angleBtnActive]}
                onPress={() => setRotationAngle(angle)}
              >
                <Text
                  style={[
                    styles.angleBtnText,
                    rotationAngle === angle && styles.angleBtnTextActive,
                  ]}
                >
                  {angle}°
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={[styles.optionsLabel, { marginTop: 14 }]}>
            Optional Page Range (leave blank for all)
          </Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. 1, 3-5"
            placeholderTextColor={colors.textDim}
            value={pageRange}
            onChangeText={setPageRange}
          />
        </View>
      )}

      {/* Process Button */}
      {files.length > 0 && (
        <TouchableOpacity
          style={[styles.processBtn, loading && styles.processBtnDisabled]}
          activeOpacity={0.8}
          disabled={loading}
          onPress={handleProcess}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="flash" size={20} color="#fff" />
              <Text style={styles.processBtnText}>
                {activeOp === 'merge'
                  ? `Merge ${files.length} PDFs`
                  : activeOp === 'split'
                  ? 'Split All Pages'
                  : activeOp === 'extract'
                  ? 'Extract Pages'
                  : `Rotate Pages (${rotationAngle}°)`}
              </Text>
            </>
          )}
        </TouchableOpacity>
      )}

      {/* Result Card */}
      {resultUri && (
        <View style={styles.resultCard}>
          <View style={styles.resultIconBox}>
            <Ionicons name="checkmark-circle" size={32} color={colors.emerald} />
          </View>
          <View style={styles.resultInfo}>
            <Text style={styles.resultTitle}>Operation Completed!</Text>
            <Text style={styles.resultName} numberOfLines={1}>
              {resultName}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.shareBtn}
            onPress={handleShareResult}
            activeOpacity={0.8}
          >
            <Ionicons name="share-outline" size={18} color="#fff" />
            <Text style={styles.shareBtnText}>Share / Save</Text>
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
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 4,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  tabItem: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
  },
  tabItemActive: {
    backgroundColor: colors.primary,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted,
  },
  tabTextActive: {
    color: '#fff',
  },
  pickButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.primary,
    borderRadius: 14,
    paddingVertical: 20,
    paddingHorizontal: 16,
  },
  pickButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  optionsCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: 14,
    marginTop: 12,
  },
  optionsLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted,
    marginBottom: 8,
  },
  input: {
    backgroundColor: colors.bg,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    color: colors.text,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  optionsHint: {
    fontSize: 11,
    color: colors.textDim,
    marginTop: 6,
  },
  angleRow: {
    flexDirection: 'row',
    gap: 10,
  },
  angleBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  angleBtnActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  angleBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textMuted,
  },
  angleBtnTextActive: {
    color: '#fff',
  },
  processBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    paddingVertical: 15,
    borderRadius: 12,
    marginTop: 16,
  },
  processBtnDisabled: {
    opacity: 0.6,
  },
  processBtnText: {
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
    marginTop: 20,
    flexDirection: 'row',
    alignItems: 'center',
  },
  resultIconBox: {
    marginRight: 12,
  },
  resultInfo: {
    flex: 1,
    marginRight: 10,
  },
  resultTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.emerald,
  },
  resultName: {
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
