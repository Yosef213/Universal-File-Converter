import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FileItem } from '../types';
import { colors } from '../theme/colors';
import { FileService } from '../services/fileService';

interface FileListProps {
  files: FileItem[];
  onRemove: (id: string) => void;
  onClear: () => void;
}

export const FileList: React.FC<FileListProps> = ({ files, onRemove, onClear }) => {
  if (files.length === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>
          Selected Files ({files.length})
        </Text>
        <TouchableOpacity onPress={onClear} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.clearText}>Clear All</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.list} nestedScrollEnabled>
        {files.map((file, index) => (
          <View key={file.id} style={styles.fileItem}>
            <View style={styles.iconContainer}>
              <Ionicons
                name={file.type === 'pdf' ? 'document-text' : file.type === 'image' ? 'image' : 'document'}
                size={20}
                color={colors.primary}
              />
            </View>
            <View style={styles.fileInfo}>
              <Text style={styles.fileName} numberOfLines={1} ellipsizeMode="middle">
                {index + 1}. {file.name}
              </Text>
              <Text style={styles.fileSize}>
                {file.size ? FileService.formatBytes(file.size) : 'Ready'}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => onRemove(file.id)}
              style={styles.removeBtn}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="close-circle" size={20} color={colors.textDim} />
            </TouchableOpacity>
          </View>
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 12,
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  clearText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.rose,
  },
  list: {
    maxHeight: 180,
  },
  fileItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  fileInfo: {
    flex: 1,
    marginRight: 8,
  },
  fileName: {
    fontSize: 14,
    color: colors.text,
    fontWeight: '500',
  },
  fileSize: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
  },
  removeBtn: {
    padding: 4,
  },
});
