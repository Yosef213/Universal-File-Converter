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
import { FileItem, JobResult } from '../types';
import { colors } from '../theme/colors';
import { FileService } from '../services/fileService';
import { DocsEngine } from '../services/docsEngine';
import { FileList } from '../components/FileList';

type DocsOp = 'word_to_pdf' | 'file_to_pdf' | 'notes_to_pdf';

export const DocsStudioScreen: React.FC = () => {
  const [activeOp, setActiveOp] = useState<DocsOp>('word_to_pdf');
  const [files, setFiles] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [progressMsg, setProgressMsg] = useState('');

  // Scratchpad notes
  const [noteTitle, setNoteTitle] = useState('');
  const [noteContent, setNoteContent] = useState('');

  // Result
  const [result, setResult] = useState<JobResult | null>(null);

  const handlePickWord = async () => {
    try {
      const picked = await FileService.pickDocuments(
        [
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'application/msword',
        ],
        false
      );
      if (picked.length > 0) {
        setFiles(picked);
        setResult(null);
      }
    } catch {
      Alert.alert('Error', 'Failed to pick Word document.');
    }
  };

  const handlePickTextFile = async () => {
    try {
      const picked = await FileService.pickDocuments(['*/*'], false);
      if (picked.length > 0) {
        setFiles(picked);
        setResult(null);
      }
    } catch {
      Alert.alert('Error', 'Failed to pick file.');
    }
  };

  const handleProcess = async () => {
    setLoading(true);
    setProgressMsg('Processing document...');
    setResult(null);

    const onProg = (done: number, total: number, label?: string) => {
      setProgressMsg(label || `Processing ${done}/${total}...`);
    };

    try {
      let res: JobResult;

      if (activeOp === 'word_to_pdf') {
        if (!files.length) throw new Error('Please select a Word (.docx) document.');
        res = await DocsEngine.docxToPdf(files[0].uri, files[0].name, onProg);
      } else if (activeOp === 'file_to_pdf') {
        if (!files.length) throw new Error('Please select a text or markdown file.');
        res = await DocsEngine.textFileToPdf(files[0].uri, files[0].name, onProg);
      } else {
        if (!noteContent.trim()) throw new Error('Please enter some text or notes.');
        res = await DocsEngine.textToPdf(
          noteContent,
          noteTitle.trim() || 'Notes',
          `${FileService.baseName(noteTitle || 'Notes')}.pdf`
        );
      }

      setResult(res);
    } catch (err: any) {
      Alert.alert('Conversion Error', err.message || 'Operation failed.');
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

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Operation Tabs */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tabItem, activeOp === 'word_to_pdf' && styles.tabItemActive]}
          onPress={() => {
            setActiveOp('word_to_pdf');
            setFiles([]);
            setResult(null);
          }}
        >
          <Text style={[styles.tabText, activeOp === 'word_to_pdf' && styles.tabTextActive]}>
            Word → PDF
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabItem, activeOp === 'file_to_pdf' && styles.tabItemActive]}
          onPress={() => {
            setActiveOp('file_to_pdf');
            setFiles([]);
            setResult(null);
          }}
        >
          <Text style={[styles.tabText, activeOp === 'file_to_pdf' && styles.tabTextActive]}>
            Text/MD → PDF
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabItem, activeOp === 'notes_to_pdf' && styles.tabItemActive]}
          onPress={() => {
            setActiveOp('notes_to_pdf');
            setFiles([]);
            setResult(null);
          }}
        >
          <Text style={[styles.tabText, activeOp === 'notes_to_pdf' && styles.tabTextActive]}>
            Type Notes
          </Text>
        </TouchableOpacity>
      </View>

      {/* Word / Text File Pickers */}
      {activeOp === 'word_to_pdf' && (
        <View>
          <TouchableOpacity
            style={styles.pickButton}
            activeOpacity={0.8}
            onPress={handlePickWord}
          >
            <Ionicons name="document-text" size={24} color={colors.primary} />
            <Text style={styles.pickButtonText}>
              {files.length === 0 ? 'Select Word Document (.docx)' : 'Change Word Document'}
            </Text>
          </TouchableOpacity>
          <Text style={styles.hintText}>
            Converts .docx pages into PDF with automatic table, font, and formatting conversion.
          </Text>
        </View>
      )}

      {activeOp === 'file_to_pdf' && (
        <View>
          <TouchableOpacity
            style={styles.pickButton}
            activeOpacity={0.8}
            onPress={handlePickTextFile}
          >
            <Ionicons name="folder-open" size={24} color={colors.primary} />
            <Text style={styles.pickButtonText}>
              {files.length === 0
                ? 'Select .txt, .md, .csv, or .log'
                : 'Change Selected File'}
            </Text>
          </TouchableOpacity>
          <Text style={styles.hintText}>
            Renders plain text, code, or markdown into a clean paginated PDF with margins.
          </Text>
        </View>
      )}

      {/* Selected File List */}
      {activeOp !== 'notes_to_pdf' && (
        <FileList
          files={files}
          onRemove={() => setFiles([])}
          onClear={() => {
            setFiles([]);
            setResult(null);
          }}
        />
      )}

      {/* Scratchpad Form */}
      {activeOp === 'notes_to_pdf' && (
        <View style={styles.card}>
          <Text style={styles.label}>Document Title</Text>
          <TextInput
            style={styles.titleInput}
            placeholder="e.g. Meeting Minutes, Project Notes"
            placeholderTextColor={colors.textDim}
            value={noteTitle}
            onChangeText={setNoteTitle}
          />

          <Text style={[styles.label, { marginTop: 12 }]}>Document Body / Notes</Text>
          <TextInput
            style={styles.bodyInput}
            placeholder="Type or paste text here..."
            placeholderTextColor={colors.textDim}
            value={noteContent}
            onChangeText={setNoteContent}
            multiline
            textAlignVertical="top"
          />
        </View>
      )}

      {/* Action Button */}
      {(files.length > 0 || activeOp === 'notes_to_pdf') && (
        <TouchableOpacity
          style={[styles.processBtn, loading && styles.processBtnDisabled]}
          activeOpacity={0.8}
          disabled={loading}
          onPress={handleProcess}
        >
          {loading ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator color="#fff" />
              <Text style={styles.loadingText}>{progressMsg || 'Generating PDF...'}</Text>
            </View>
          ) : (
            <>
              <Ionicons name="document-text" size={20} color="#fff" />
              <Text style={styles.processBtnText}>
                {activeOp === 'word_to_pdf'
                  ? 'Convert Word to PDF'
                  : activeOp === 'file_to_pdf'
                  ? 'Convert File to PDF'
                  : 'Export Notes as PDF'}
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
            <Text style={styles.resultTitle}>PDF Generated!</Text>
            <Text style={styles.resultSummary}>{result.summary}</Text>
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
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  hintText: {
    fontSize: 12,
    color: colors.textDim,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 8,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: 16,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
    marginBottom: 6,
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
    paddingVertical: 10,
    fontSize: 14,
    minHeight: 180,
    lineHeight: 20,
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
