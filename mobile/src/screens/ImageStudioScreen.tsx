import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FileItem } from '../types';
import { colors } from '../theme/colors';
import { FileService } from '../services/fileService';
import { PdfEngine } from '../services/pdfEngine';
import { ImageEngine } from '../services/imageEngine';
import { FileList } from '../components/FileList';

type ImageOp = 'to_pdf' | 'convert' | 'compress';

export const ImageStudioScreen: React.FC = () => {
  const [activeOp, setActiveOp] = useState<ImageOp>('to_pdf');
  const [files, setFiles] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [targetFormat, setTargetFormat] = useState<'jpeg' | 'png' | 'webp'>('jpeg');
  const [qualityLevel, setQualityLevel] = useState<number>(85);
  const [pdfLayout, setPdfLayout] = useState<'fit' | 'a4'>('fit');
  const [resultUri, setResultUri] = useState<string | null>(null);
  const [resultName, setResultName] = useState<string>('');

  const handlePickPhotos = async () => {
    try {
      const picked = await FileService.pickImages(true);
      if (picked.length > 0) {
        setFiles([...files, ...picked]);
        setResultUri(null);
      }
    } catch {
      Alert.alert('Error', 'Failed to pick photos.');
    }
  };

  const handlePickFiles = async () => {
    try {
      const picked = await FileService.pickDocuments(['image/*'], true);
      if (picked.length > 0) {
        setFiles([...files, ...picked]);
        setResultUri(null);
      }
    } catch {
      Alert.alert('Error', 'Failed to pick image files.');
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
      Alert.alert('No Images', 'Please select at least one image first.');
      return;
    }

    setLoading(true);
    setResultUri(null);

    try {
      if (activeOp === 'to_pdf') {
        const outName = `Images_${Date.now()}.pdf`;
        const outputUri = await PdfEngine.imagesToPdf(
          files.map((f) => f.uri),
          pdfLayout,
          outName
        );
        setResultUri(outputUri);
        setResultName(outName);
      } else if (activeOp === 'convert' || activeOp === 'compress') {
        const uris = await ImageEngine.batchProcessImages(
          files.map((f) => f.uri),
          {
            format: targetFormat,
            quality: qualityLevel,
          }
        );
        if (uris.length > 0) {
          setResultUri(uris[0]);
          setResultName(
            uris.length === 1
              ? `Processed_${targetFormat.toUpperCase()}`
              : `${uris.length} images converted successfully`
          );
        }
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Image processing failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleShareResult = async () => {
    if (!resultUri) return;
    try {
      const isPdf = activeOp === 'to_pdf';
      await FileService.shareFile(
        resultUri,
        isPdf ? 'application/pdf' : `image/${targetFormat}`
      );
    } catch (err: any) {
      Alert.alert('Share Error', err.message || 'Unable to share file.');
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Mode Tabs */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tabItem, activeOp === 'to_pdf' && styles.tabItemActive]}
          onPress={() => setActiveOp('to_pdf')}
        >
          <Text style={[styles.tabText, activeOp === 'to_pdf' && styles.tabTextActive]}>
            Images to PDF
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabItem, activeOp === 'convert' && styles.tabItemActive]}
          onPress={() => setActiveOp('convert')}
        >
          <Text style={[styles.tabText, activeOp === 'convert' && styles.tabTextActive]}>
            Format Convert
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabItem, activeOp === 'compress' && styles.tabItemActive]}
          onPress={() => setActiveOp('compress')}
        >
          <Text style={[styles.tabText, activeOp === 'compress' && styles.tabTextActive]}>
            Compress
          </Text>
        </TouchableOpacity>
      </View>

      {/* Image Picker Buttons */}
      <View style={styles.pickerRow}>
        <TouchableOpacity
          style={[styles.pickerBtn, { backgroundColor: colors.skyLight }]}
          activeOpacity={0.8}
          onPress={handlePickPhotos}
        >
          <Ionicons name="images" size={22} color={colors.sky} />
          <Text style={[styles.pickerBtnText, { color: colors.sky }]}>Photo Library</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.pickerBtn, { backgroundColor: colors.surface }]}
          activeOpacity={0.8}
          onPress={handlePickFiles}
        >
          <Ionicons name="folder-open" size={22} color={colors.textMuted} />
          <Text style={[styles.pickerBtnText, { color: colors.textMuted }]}>Browse Files</Text>
        </TouchableOpacity>
      </View>

      {/* Selected List */}
      <FileList files={files} onRemove={handleRemoveFile} onClear={handleClearFiles} />

      {/* Options */}
      {activeOp === 'to_pdf' && (
        <View style={styles.optionsCard}>
          <Text style={styles.optionsLabel}>PDF Page Layout</Text>
          <View style={styles.optRow}>
            <TouchableOpacity
              style={[styles.optBtn, pdfLayout === 'fit' && styles.optBtnActive]}
              onPress={() => setPdfLayout('fit')}
            >
              <Text style={[styles.optBtnText, pdfLayout === 'fit' && styles.optBtnTextActive]}>
                Fit to Image
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.optBtn, pdfLayout === 'a4' && styles.optBtnActive]}
              onPress={() => setPdfLayout('a4')}
            >
              <Text style={[styles.optBtnText, pdfLayout === 'a4' && styles.optBtnTextActive]}>
                Standard A4
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {(activeOp === 'convert' || activeOp === 'compress') && (
        <View style={styles.optionsCard}>
          {activeOp === 'convert' && (
            <>
              <Text style={styles.optionsLabel}>Target Image Format</Text>
              <View style={styles.optRow}>
                {(['jpeg', 'png', 'webp'] as const).map((fmt) => (
                  <TouchableOpacity
                    key={fmt}
                    style={[styles.optBtn, targetFormat === fmt && styles.optBtnActive]}
                    onPress={() => setTargetFormat(fmt)}
                  >
                    <Text
                      style={[
                        styles.optBtnText,
                        targetFormat === fmt && styles.optBtnTextActive,
                      ]}
                    >
                      {fmt.toUpperCase()}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}

          <Text style={[styles.optionsLabel, { marginTop: activeOp === 'convert' ? 14 : 0 }]}>
            Quality & Compression
          </Text>
          <View style={styles.optRow}>
            {[
              { label: 'Maximum (95%)', value: 95 },
              { label: 'Balanced (80%)', value: 80 },
              { label: 'Compact (50%)', value: 50 },
            ].map((q) => (
              <TouchableOpacity
                key={q.value}
                style={[styles.optBtn, qualityLevel === q.value && styles.optBtnActive]}
                onPress={() => setQualityLevel(q.value)}
              >
                <Text
                  style={[
                    styles.optBtnText,
                    qualityLevel === q.value && styles.optBtnTextActive,
                  ]}
                >
                  {q.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {/* Action Button */}
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
              <Ionicons name="sparkles" size={20} color="#fff" />
              <Text style={styles.processBtnText}>
                {activeOp === 'to_pdf'
                  ? `Combine ${files.length} Images to PDF`
                  : activeOp === 'convert'
                  ? `Convert ${files.length} Images to ${targetFormat.toUpperCase()}`
                  : `Compress ${files.length} Images`}
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
            <Text style={styles.resultTitle}>Processing Finished!</Text>
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
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
  },
  tabTextActive: {
    color: '#fff',
  },
  pickerRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  pickerBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 12,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  pickerBtnText: {
    fontSize: 14,
    fontWeight: '600',
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
  optRow: {
    flexDirection: 'row',
    gap: 8,
  },
  optBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  optBtnActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  optBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
  },
  optBtnTextActive: {
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
