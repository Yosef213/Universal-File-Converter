import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system/legacy';
import { colors } from '../theme/colors';
import { FileService, OUTPUT_DIR } from '../services/fileService';

interface StoredFile {
  name: string;
  uri: string;
  size: number;
  modificationTime: number;
}

export const HistoryScreen: React.FC = () => {
  const [files, setFiles] = useState<StoredFile[]>([]);
  const [loading, setLoading] = useState(true);

  const loadFiles = async () => {
    try {
      setLoading(true);
      await FileService.ensureOutputDir();
      const dirInfo = await FileSystem.getInfoAsync(OUTPUT_DIR);

      if (!dirInfo.exists) {
        setFiles([]);
        setLoading(false);
        return;
      }

      const fileNames = await FileSystem.readDirectoryAsync(OUTPUT_DIR);
      const fileList: StoredFile[] = [];

      for (const name of fileNames) {
        const fileUri = `${OUTPUT_DIR}${name}`;
        const info = await FileSystem.getInfoAsync(fileUri);
        if (info.exists) {
          fileList.push({
            name,
            uri: fileUri,
            size: info.size || 0,
            modificationTime: info.modificationTime || Date.now(),
          });
        }
      }

      fileList.sort((a, b) => b.modificationTime - a.modificationTime);
      setFiles(fileList);
    } catch (err) {
      console.error('Failed to load history:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFiles();
  }, []);

  const handleShare = async (file: StoredFile) => {
    try {
      await FileService.shareFile(file.uri);
    } catch {
      Alert.alert('Share Error', 'Could not open share menu.');
    }
  };

  const handleSaveToDevice = async (file: StoredFile) => {
    try {
      const count = await FileService.saveToDeviceFolder([file.uri]);
      if (count > 0) {
        Alert.alert('Saved!', `Exported ${file.name} to device storage.`);
      }
    } catch {
      Alert.alert('Save Error', 'Could not export file to device storage.');
    }
  };

  const handleSaveAllToDevice = async () => {
    if (!files.length) return;
    try {
      const count = await FileService.saveToDeviceFolder(files.map((f) => f.uri));
      if (count > 0) {
        Alert.alert('Saved!', `Exported ${count} file(s) to device storage.`);
      }
    } catch {
      Alert.alert('Save Error', 'Could not export files.');
    }
  };

  const handleDelete = async (file: StoredFile) => {
    try {
      await FileSystem.deleteAsync(file.uri, { idempotent: true });
      setFiles(files.filter((f) => f.uri !== file.uri));
    } catch {
      Alert.alert('Delete Error', 'Failed to delete file.');
    }
  };

  const handleClearAll = () => {
    Alert.alert(
      'Clear All Converted Files?',
      'This will remove all processed files from app storage.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete All',
          style: 'destructive',
          onPress: async () => {
            await FileSystem.deleteAsync(OUTPUT_DIR, { idempotent: true });
            setFiles([]);
          },
        },
      ]
    );
  };

  const getIcon = (name: string): keyof typeof Ionicons.glyphMap => {
    const ext = name.split('.').pop()?.toLowerCase();
    if (ext === 'pdf') return 'document-text';
    if (ext === 'docx' || ext === 'doc') return 'document';
    if (ext === 'xlsx' || ext === 'xls' || ext === 'csv') return 'grid';
    if (ext === 'png' || ext === 'jpg' || ext === 'jpeg' || ext === 'webp') return 'image';
    return 'reader';
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Converted Documents ({files.length})</Text>
        {files.length > 0 && (
          <View style={styles.topActions}>
            <TouchableOpacity onPress={handleSaveAllToDevice} style={styles.topBtn}>
              <Ionicons name="download-outline" size={16} color={colors.emerald} />
              <Text style={styles.saveAllText}>Save All</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleClearAll} style={styles.topBtn}>
              <Ionicons name="trash-outline" size={16} color={colors.rose} />
              <Text style={styles.clearAllText}>Clear</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
      ) : files.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="folder-open-outline" size={48} color={colors.textDim} />
          <Text style={styles.emptyTitle}>No Converted Files Yet</Text>
          <Text style={styles.emptySubtitle}>
            Files you convert or export will appear here for quick access, sharing, and saving to device storage.
          </Text>
        </View>
      ) : (
        files.map((file) => (
          <View key={file.uri} style={styles.fileCard}>
            <View style={styles.fileIconBox}>
              <Ionicons name={getIcon(file.name)} size={22} color={colors.primary} />
            </View>
            <View style={styles.fileMeta}>
              <Text style={styles.fileName} numberOfLines={1}>
                {file.name}
              </Text>
              <Text style={styles.fileDetails}>
                {FileService.formatBytes(file.size)} •{' '}
                {new Date(file.modificationTime).toLocaleDateString()}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() => handleSaveToDevice(file)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="download-outline" size={19} color={colors.emerald} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() => handleShare(file)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="share-outline" size={19} color={colors.primary} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() => handleDelete(file)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="trash-outline" size={19} color={colors.rose} />
            </TouchableOpacity>
          </View>
        ))
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
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  topActions: {
    flexDirection: 'row',
    gap: 12,
  },
  topBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  saveAllText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.emerald,
  },
  clearAllText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.rose,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 20,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginTop: 14,
  },
  emptySubtitle: {
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
  },
  fileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: 12,
    marginBottom: 10,
  },
  fileIconBox: {
    width: 38,
    height: 38,
    borderRadius: 8,
    backgroundColor: colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  fileMeta: {
    flex: 1,
    marginRight: 8,
  },
  fileName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  fileDetails: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 3,
  },
  actionBtn: {
    padding: 6,
    marginLeft: 2,
  },
});
