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
import { FileService } from '../services/fileService';

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
      const directory = `${FileSystem.documentDirectory}converted/`;
      const dirInfo = await FileSystem.getInfoAsync(directory);

      if (!dirInfo.exists) {
        setFiles([]);
        setLoading(false);
        return;
      }

      const fileNames = await FileSystem.readDirectoryAsync(directory);
      const fileList: StoredFile[] = [];

      for (const name of fileNames) {
        const fileUri = `${directory}${name}`;
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
      const mime = file.name.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg';
      await FileService.shareFile(file.uri, mime);
    } catch {
      Alert.alert('Share Error', 'Could not open share menu.');
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
            const directory = `${FileSystem.documentDirectory}converted/`;
            await FileSystem.deleteAsync(directory, { idempotent: true });
            setFiles([]);
          },
        },
      ]
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Converted Documents</Text>
        {files.length > 0 && (
          <TouchableOpacity onPress={handleClearAll}>
            <Text style={styles.clearAllText}>Clear All</Text>
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
      ) : files.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="folder-open-outline" size={48} color={colors.textDim} />
          <Text style={styles.emptyTitle}>No Converted Files Yet</Text>
          <Text style={styles.emptySubtitle}>
            Files you convert or export will appear here for quick access and sharing.
          </Text>
        </View>
      ) : (
        files.map((file) => (
          <View key={file.uri} style={styles.fileCard}>
            <View style={styles.fileIconBox}>
              <Ionicons
                name={file.name.endsWith('.pdf') ? 'document-text' : 'image'}
                size={24}
                color={colors.primary}
              />
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
              onPress={() => handleShare(file)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="share-outline" size={20} color={colors.primary} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() => handleDelete(file)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="trash-outline" size={20} color={colors.rose} />
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
    marginLeft: 4,
  },
});
