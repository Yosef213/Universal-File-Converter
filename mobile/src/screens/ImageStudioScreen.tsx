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
import { FileItem, JobResult } from '../types';
import { colors } from '../theme/colors';
import { FileService } from '../services/fileService';
import { ImageEngine } from '../services/imageEngine';
import { FileList } from '../components/FileList';

type ImageOp = 'to_pdf' | 'batch_convert';

export const ImageStudioScreen: React.FC = () => {
  const [activeOp, setActiveOp] = useState<ImageOp>('to_pdf');
  const [files, setFiles] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [progressMsg, setProgressMsg] = useState('');

  // Options
  const [targetFormat, setTargetFormat] = useState<'jpeg' | 'png' | 'webp'>('jpeg');
  const [qualityLevel, setQualityLevel] = useState<number>(85);
  const [scaleLevel, setScaleLevel] = useState<number>(100);
  const [pdfLayout, setPdfLayout] = useState<'fit' | 'a4'>('fit');
  const [outputName, setOutputName] = useState('Images_Combined');

  // Result
  const [result, setResult] = useState<JobResult | null>(null);

  const handlePickPhotos = async () => {
    try {
      const picked = await FileService.pickImages(true);
      if (picked.length > 0) {
        setFiles([...files, ...picked]);
        setResult(null);
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
        setResult(null);
      }
    } catch {
      Alert.alert('Error', 'Failed to pick image files.');
    }
  };

  const handleProcess = async () => {
    if (files.length === 0) {
      Alert.alert('No Images', 'Please select at least one image first.');
      return;
    }

    setLoading(true);
    setProgressMsg('Processing images...');
    setResult(null);

    const onProg = (done: number, total: number, label?: string) => {
      setProgressMsg(label || `Image ${done}/${total}...`);
    };

    try {
      let res: JobResult;

      if (activeOp === 'to_pdf') {
        res = await ImageEngine.imagesToPdf(
          files,
          pdfLayout,
          outputName.trim() || 'Images_Combined',
          onProg
        );
      } else {
        res = await ImageEngine.batchProcessImages(
          files,
          {
            format: targetFormat,
            quality: qualityLevel,
            scale: scaleLevel,
          },
          onProg
        );
      }

      setResult(res);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Image processing failed.');
    } finally {
      setLoading(false);
      setProgressMsg('');
    }
  };

  const handleShare = async () => {
    if (!result?.outputs.length) return;
    try {
      await FileService.shareFile(result.outputs[0]);
    } catch (err: any) {
      Alert.alert('Share Error', err.message);
    }
  };

  const handleSaveToDevice = async () => {
    if (!result?.outputs.length) return;
    try {
      const count = await FileService.saveToDeviceFolder(result.outputs);
      if (count > 0) {
        Alert.alert('Saved!', `Successfully exported ${count} image(s) to device folder.`);
      }
    } catch (err: any) {
      Alert.alert('Save Error', err.message);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Mode Tabs */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tabItem, activeOp === 'to_pdf' && styles.tabItemActive]}
          onPress={() => {
            setActiveOp('to_pdf');
            setResult(null);
          }}
        >
          <Text style={[styles.tabText, activeOp === 'to_pdf' && styles.tabTextActive]}>
            Combine into PDF
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabItem, activeOp === 'batch_convert' && styles.tabItemActive]}
          onPress={() => {
            setActiveOp('batch_convert');
            setResult(null);
          }}
        >
          <Text style={[styles.tabText, activeOp === 'batch_convert' && styles.tabTextActive]}>
            Format & Resize
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
      <FileList
        files={files}
        onRemove={(id) => setFiles(files.filter((f) => f.id !== id))}
        onClear={() => {
          setFiles([]);
          setResult(null);
        }}
      />

      {/* Options */}
      {activeOp === 'to_pdf' ? (
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
      ) : (
        <View style={styles.optionsCard}>
          <Text style={styles.optionsLabel}>Target Format</Text>
          <View style={styles.optRow}>
            {(['jpeg', 'png', 'webp'] as const).map((fmt) => (
              <TouchableOpacity
                key={fmt}
                style={[styles.optBtn, targetFormat === fmt && styles.optBtnActive]}
                onPress={() => setTargetFormat(fmt)}
              >
                <Text style={[styles.optBtnText, targetFormat === fmt && styles.optBtnTextActive]}>
                  {fmt.toUpperCase()}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={[styles.optionsLabel, { marginTop: 12 }]}>Downscaling / Resize</Text>
          <View style={styles.optRow}>
            {[100, 75, 50, 25].map((s) => (
              <TouchableOpacity
                key={s}
                style={[styles.optBtn, scaleLevel === s && styles.optBtnActive]}
                onPress={() => setScaleLevel(s)}
              >
                <Text style={[styles.optBtnText, scaleLevel === s && styles.optBtnTextActive]}>
                  {s === 100 ? 'Original' : `${s}%`}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={[styles.optionsLabel, { marginTop: 12 }]}>Quality</Text>
          <View style={styles.optRow}>
            {[
              { label: 'Max (95%)', val: 95 },
              { label: 'High (85%)', val: 85 },
              { label: 'Med (70%)', val: 70 },
              { label: 'Low (50%)', val: 50 },
            ].map((q) => (
              <TouchableOpacity
                key={q.val}
                style={[styles.optBtn, qualityLevel === q.val && styles.optBtnActive]}
                onPress={() => setQualityLevel(q.val)}
              >
                <Text style={[styles.optBtnText, qualityLevel === q.val && styles.optBtnTextActive]}>
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
            <View style={styles.loadingRow}>
              <ActivityIndicator color="#fff" />
              <Text style={styles.loadingText}>{progressMsg || 'Processing...'}</Text>
            </View>
          ) : (
            <>
              <Ionicons name="sparkles" size={20} color="#fff" />
              <Text style={styles.processBtnText}>
                {activeOp === 'to_pdf'
                  ? `Combine ${files.length} Images into PDF`
                  : `Convert & Resize ${files.length} Images`}
              </Text>
            </>
          )}
        </TouchableOpacity>
      )}

      {/* Result Card */}
      {result && (
        <View style={styles.resultCard}>
          <View style={styles.resultIconBox}>
            <Ionicons name="checkmark-circle" size={32} color={colors.emerald} />
          </View>
          <View style={styles.resultInfo}>
            <Text style={styles.resultTitle}>Processing Finished!</Text>
            <Text style={styles.resultSummary}>{result.summary}</Text>
            <Text style={styles.resultCount}>
              {result.outputs.length} file(s) saved to app storage
            </Text>
          </View>

          <View style={styles.actionBtnRow}>
            <TouchableOpacity style={styles.shareBtn} onPress={handleShare}>
              <Ionicons name="share-outline" size={16} color="#fff" />
              <Text style={styles.btnActionText}>Share</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.saveBtn} onPress={handleSaveToDevice}>
              <Ionicons name="download-outline" size={16} color="#fff" />
              <Text style={styles.btnActionText}>Save to Folder</Text>
            </TouchableOpacity>
          </View>
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
    marginBottom: 14,
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
    marginTop: 10,
  },
  optionsLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
    marginBottom: 8,
  },
  optRow: {
    flexDirection: 'row',
    gap: 6,
  },
  optBtn: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 6,
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
    fontSize: 11,
    fontWeight: '600',
    color: colors.textMuted,
    textAlign: 'center',
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
    paddingVertical: 14,
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
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  loadingText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  resultCard: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.4)',
    padding: 16,
    marginTop: 18,
  },
  resultIconBox: {
    marginBottom: 8,
  },
  resultInfo: {
    marginBottom: 12,
  },
  resultTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.emerald,
  },
  resultSummary: {
    fontSize: 13,
    color: colors.text,
    marginTop: 3,
  },
  resultCount: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
  },
  actionBtnRow: {
    flexDirection: 'row',
    gap: 8,
  },
  shareBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: colors.primary,
    paddingVertical: 10,
    borderRadius: 8,
  },
  saveBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: colors.emerald,
    paddingVertical: 10,
    borderRadius: 8,
  },
  btnActionText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
});
