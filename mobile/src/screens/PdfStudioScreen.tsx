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
import { FileItem, JobResult } from '../types';
import { colors } from '../theme/colors';
import { FileService } from '../services/fileService';
import { PdfEngine, CompressLevel } from '../services/pdfEngine';
import { FileList } from '../components/FileList';

export type PdfCategory = 'convert' | 'organize' | 'security';

export type PdfOp =
  | 'to_word'
  | 'to_excel'
  | 'to_text'
  | 'to_images'
  | 'merge'
  | 'split'
  | 'extract'
  | 'rotate'
  | 'compress'
  | 'encrypt'
  | 'decrypt';

interface OpMeta {
  key: PdfOp;
  name: string;
  desc: string;
  icon: keyof typeof Ionicons.glyphMap;
  category: PdfCategory;
}

const OPERATIONS: OpMeta[] = [
  // Convert
  { key: 'to_word', name: 'To Word', desc: 'Editable .docx', icon: 'document-text', category: 'convert' },
  { key: 'to_excel', name: 'To Excel', desc: 'Detect tables to .xlsx', icon: 'grid', category: 'convert' },
  { key: 'to_text', name: 'To Text', desc: 'Clean selectable .txt', icon: 'reader', category: 'convert' },
  { key: 'to_images', name: 'To Images', desc: 'PNG / JPG pages', icon: 'images', category: 'convert' },

  // Organize
  { key: 'merge', name: 'Merge', desc: 'Combine multiple PDFs', icon: 'git-merge', category: 'organize' },
  { key: 'split', name: 'Split', desc: 'Extract all pages', icon: 'cut', category: 'organize' },
  { key: 'extract', name: 'Extract', desc: 'Custom page ranges', icon: 'copy', category: 'organize' },
  { key: 'rotate', name: 'Rotate', desc: 'Change page angle', icon: 'refresh', category: 'organize' },

  // Security & Optimize
  { key: 'compress', name: 'Compress', desc: 'Reduce file size', icon: 'contract', category: 'security' },
  { key: 'encrypt', name: 'Protect', desc: 'Add password lock', icon: 'lock-closed', category: 'security' },
  { key: 'decrypt', name: 'Unlock', desc: 'Remove password', icon: 'lock-open', category: 'security' },
];

export const PdfStudioScreen: React.FC = () => {
  const [activeCategory, setActiveCategory] = useState<PdfCategory>('convert');
  const [activeOp, setActiveOp] = useState<PdfOp>('to_word');
  const [files, setFiles] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [progressMsg, setProgressMsg] = useState('');

  // Options
  const [pageRange, setPageRange] = useState('');
  const [rotationAngle, setRotationAngle] = useState<90 | 180 | 270>(90);
  const [imageFormat, setImageFormat] = useState<'png' | 'jpg'>('png');
  const [imageDpi, setImageDpi] = useState<number>(150);
  const [compressLevel, setCompressLevel] = useState<CompressLevel>('balanced');
  const [password, setPassword] = useState('');
  const [outputName, setOutputName] = useState('');

  // Result
  const [result, setResult] = useState<JobResult | null>(null);

  const handlePickFiles = async () => {
    try {
      const picked = await FileService.pickDocuments(
        ['application/pdf'],
        activeOp === 'merge'
      );
      if (picked.length > 0) {
        setFiles(activeOp === 'merge' ? [...files, ...picked] : picked);
        setResult(null);
      }
    } catch {
      Alert.alert('Error', 'Failed to pick PDF file(s).');
    }
  };

  const handleProcess = async () => {
    if (files.length === 0) {
      Alert.alert('No File', 'Please select a PDF document first.');
      return;
    }

    setLoading(true);
    setProgressMsg('Processing...');
    setResult(null);

    const onProg = (done: number, total: number, label?: string) => {
      setProgressMsg(label || `Processing ${done}/${total}...`);
    };

    try {
      const target = files[0];
      let res: JobResult;

      switch (activeOp) {
        case 'to_word':
          res = await PdfEngine.toWord(target.uri, target.name, pageRange || undefined, onProg);
          break;
        case 'to_excel':
          res = await PdfEngine.toExcel(target.uri, target.name, pageRange || undefined, onProg);
          break;
        case 'to_text':
          res = await PdfEngine.extractText(target.uri, target.name, pageRange || undefined, onProg);
          break;
        case 'to_images':
          res = await PdfEngine.toImages(
            target.uri,
            target.name,
            { range: pageRange || undefined, dpi: imageDpi, format: imageFormat, quality: 90 },
            onProg
          );
          break;
        case 'merge':
          res = await PdfEngine.merge(
            files,
            outputName.trim() || 'Merged_Document',
            onProg
          );
          break;
        case 'split':
          res = await PdfEngine.split(target.uri, target.name, pageRange || undefined, onProg);
          break;
        case 'extract':
          if (!pageRange.trim()) {
            throw new Error('Please enter pages to extract (e.g. 1-3, 5).');
          }
          res = await PdfEngine.extractPages(target.uri, target.name, pageRange);
          break;
        case 'rotate':
          res = await PdfEngine.rotate(target.uri, target.name, rotationAngle, pageRange || undefined);
          break;
        case 'compress':
          res = await PdfEngine.compress(target.uri, target.name, compressLevel, onProg);
          break;
        case 'encrypt':
          if (!password.trim()) throw new Error('Please enter a password.');
          res = await PdfEngine.encrypt(target.uri, target.name, password);
          break;
        case 'decrypt':
          if (!password.trim()) throw new Error('Please enter the current password.');
          res = await PdfEngine.decrypt(target.uri, target.name, password);
          break;
        default:
          throw new Error('Unknown operation');
      }

      setResult(res);
    } catch (err: any) {
      Alert.alert('Processing Error', err.message || 'Operation failed.');
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
        Alert.alert('Saved!', `Successfully exported ${count} file(s) to device folder.`);
      }
    } catch (err: any) {
      Alert.alert('Save Error', err.message);
    }
  };

  const categoryOps = OPERATIONS.filter((op) => op.category === activeCategory);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Category Tabs */}
      <View style={styles.categoryBar}>
        {(['convert', 'organize', 'security'] as PdfCategory[]).map((cat) => (
          <TouchableOpacity
            key={cat}
            style={[styles.categoryTab, activeCategory === cat && styles.categoryTabActive]}
            onPress={() => {
              setActiveCategory(cat);
              const firstInCat = OPERATIONS.find((o) => o.category === cat);
              if (firstInCat) setActiveOp(firstInCat.key);
              setResult(null);
            }}
          >
            <Text
              style={[
                styles.categoryTabText,
                activeCategory === cat && styles.categoryTabTextActive,
              ]}
            >
              {cat === 'convert' ? 'Convert' : cat === 'organize' ? 'Organize' : 'Optimize & Protect'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Operation Pills Grid */}
      <View style={styles.opGrid}>
        {categoryOps.map((op) => {
          const isSelected = activeOp === op.key;
          return (
            <TouchableOpacity
              key={op.key}
              style={[styles.opCard, isSelected && styles.opCardActive]}
              onPress={() => {
                setActiveOp(op.key);
                setResult(null);
                if (op.key !== 'merge' && files.length > 1) {
                  setFiles([files[0]]);
                }
              }}
            >
              <View
                style={[
                  styles.opIconBox,
                  isSelected ? { backgroundColor: '#fff' } : { backgroundColor: colors.primaryLight },
                ]}
              >
                <Ionicons
                  name={op.icon}
                  size={20}
                  color={isSelected ? colors.primary : colors.primary}
                />
              </View>
              <Text style={[styles.opName, isSelected && styles.opNameActive]}>
                {op.name}
              </Text>
              <Text style={[styles.opDesc, isSelected && styles.opDescActive]}>
                {op.desc}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* File Picker Card */}
      <TouchableOpacity
        style={styles.pickButton}
        activeOpacity={0.8}
        onPress={handlePickFiles}
      >
        <Ionicons name="document-attach" size={24} color={colors.primary} />
        <Text style={styles.pickButtonText}>
          {files.length === 0
            ? activeOp === 'merge'
              ? 'Select Multiple PDFs to Merge'
              : 'Select PDF Document'
            : activeOp === 'merge'
            ? 'Add More PDFs'
            : 'Change Selected PDF'}
        </Text>
      </TouchableOpacity>

      {/* Selected File List */}
      <FileList
        files={files}
        onRemove={(id) => setFiles(files.filter((f) => f.id !== id))}
        onClear={() => {
          setFiles([]);
          setResult(null);
        }}
      />

      {/* Dynamic Operation Options */}
      {/* 1. Page Range (for Word, Excel, Text, Images, Split, Extract, Rotate) */}
      {(activeOp === 'to_word' ||
        activeOp === 'to_excel' ||
        activeOp === 'to_text' ||
        activeOp === 'to_images' ||
        activeOp === 'split' ||
        activeOp === 'extract' ||
        activeOp === 'rotate') && (
        <View style={styles.optionsCard}>
          <Text style={styles.optionsLabel}>
            Page Range {activeOp === 'extract' ? '(Required)' : '(Optional)'}
          </Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. 1-3, 5, 8- (leave blank for all)"
            placeholderTextColor={colors.textDim}
            value={pageRange}
            onChangeText={setPageRange}
          />
        </View>
      )}

      {/* 2. Image Options */}
      {activeOp === 'to_images' && (
        <View style={styles.optionsCard}>
          <Text style={styles.optionsLabel}>Image Format & DPI</Text>
          <View style={styles.optRow}>
            {(['png', 'jpg'] as const).map((fmt) => (
              <TouchableOpacity
                key={fmt}
                style={[styles.optBtn, imageFormat === fmt && styles.optBtnActive]}
                onPress={() => setImageFormat(fmt)}
              >
                <Text style={[styles.optBtnText, imageFormat === fmt && styles.optBtnTextActive]}>
                  {fmt.toUpperCase()}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={[styles.optRow, { marginTop: 8 }]}>
            {[
              { label: 'Standard (150 DPI)', dpi: 150 },
              { label: 'High (300 DPI)', dpi: 300 },
            ].map((d) => (
              <TouchableOpacity
                key={d.dpi}
                style={[styles.optBtn, imageDpi === d.dpi && styles.optBtnActive]}
                onPress={() => setImageDpi(d.dpi)}
              >
                <Text style={[styles.optBtnText, imageDpi === d.dpi && styles.optBtnTextActive]}>
                  {d.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {/* 3. Rotate Angle */}
      {activeOp === 'rotate' && (
        <View style={styles.optionsCard}>
          <Text style={styles.optionsLabel}>Rotation Angle</Text>
          <View style={styles.optRow}>
            {([90, 180, 270] as const).map((angle) => (
              <TouchableOpacity
                key={angle}
                style={[styles.optBtn, rotationAngle === angle && styles.optBtnActive]}
                onPress={() => setRotationAngle(angle)}
              >
                <Text style={[styles.optBtnText, rotationAngle === angle && styles.optBtnTextActive]}>
                  {angle}° CW
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {/* 4. Compression Level */}
      {activeOp === 'compress' && (
        <View style={styles.optionsCard}>
          <Text style={styles.optionsLabel}>Compression Strength</Text>
          <View style={styles.optRow}>
            {[
              { level: 'light', label: 'Light (Lossless)' },
              { level: 'balanced', label: 'Balanced (150 DPI)' },
              { level: 'strong', label: 'Strong (96 DPI)' },
            ].map((c) => (
              <TouchableOpacity
                key={c.level}
                style={[styles.optBtn, compressLevel === c.level && styles.optBtnActive]}
                onPress={() => setCompressLevel(c.level as CompressLevel)}
              >
                <Text
                  style={[
                    styles.optBtnText,
                    compressLevel === c.level && styles.optBtnTextActive,
                  ]}
                >
                  {c.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {/* 5. Password input (Encrypt or Decrypt) */}
      {(activeOp === 'encrypt' || activeOp === 'decrypt') && (
        <View style={styles.optionsCard}>
          <Text style={styles.optionsLabel}>
            {activeOp === 'encrypt' ? 'Set Password (AES-256)' : 'Enter Document Password'}
          </Text>
          <TextInput
            style={styles.input}
            placeholder="Enter password..."
            placeholderTextColor={colors.textDim}
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />
        </View>
      )}

      {/* 6. Merge Output Name */}
      {activeOp === 'merge' && (
        <View style={styles.optionsCard}>
          <Text style={styles.optionsLabel}>Output File Name</Text>
          <TextInput
            style={styles.input}
            placeholder="Merged_Document"
            placeholderTextColor={colors.textDim}
            value={outputName}
            onChangeText={setOutputName}
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
            <View style={styles.loadingRow}>
              <ActivityIndicator color="#fff" />
              <Text style={styles.loadingText}>{progressMsg || 'Processing...'}</Text>
            </View>
          ) : (
            <>
              <Ionicons name="flash" size={20} color="#fff" />
              <Text style={styles.processBtnText}>
                {OPERATIONS.find((o) => o.key === activeOp)?.name || 'Run Operation'}
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
            <Text style={styles.resultTitle}>Operation Completed!</Text>
            <Text style={styles.resultSummary}>{result.summary}</Text>
            <Text style={styles.resultCount}>
              {result.outputs.length} file(s) generated in app storage
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
  categoryBar: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 4,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  categoryTab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
  },
  categoryTabActive: {
    backgroundColor: colors.primary,
  },
  categoryTabText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
  },
  categoryTabTextActive: {
    color: '#fff',
  },
  opGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },
  opCard: {
    flexBasis: '48%',
    flexGrow: 1,
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: 12,
  },
  opCardActive: {
    borderColor: colors.primary,
    backgroundColor: 'rgba(99, 102, 241, 0.12)',
  },
  opIconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  opName: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  opNameActive: {
    color: colors.primary,
  },
  opDesc: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
  },
  opDescActive: {
    color: colors.text,
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
    paddingVertical: 18,
    paddingHorizontal: 16,
  },
  pickButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
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
