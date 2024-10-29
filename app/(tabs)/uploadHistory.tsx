import { useState, useEffect, useCallback } from 'react';
import { StyleSheet, TouchableOpacity, View, FlatList, Image, ActivityIndicator } from 'react-native';
import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';
import { router } from 'expo-router';
import { theme } from '../styles/theme';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface Upload {
  id: string;
  filename: string;
  createdAt: string;
  // Add any other upload properties you need
}

interface Style {
  id: string;
  name: string;
  thumbnailUrl?: string;
  uploads: Upload[];
}

export default function UploadHistoryScreen() {
  const [selectedStyle, setSelectedStyle] = useState<Style | null>(null);
  const [styles, setStyles] = useState<Style[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    loadStyles();
  }, []);

  const loadStyles = async () => {
    try {
      const accessToken = await AsyncStorage.getItem('accessToken');
      const baseUrl = await AsyncStorage.getItem('baseUrl');
      
      console.log('Fetching styles from:', `${baseUrl}/api/styles`);
      console.log('Using token:', accessToken);
      
      const response = await fetch(`${baseUrl}/api/styles`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json',
        },
      });
      
      const data = await response.json();
      console.log('Received styles:', data);
      setStyles(data);
    } catch (error) {
      console.error('Error loading styles:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadStyles();
    setRefreshing(false);
  }, []);

  const renderUpload = ({ item }: { item: Upload }) => (
    <View style={styles.uploadItem}>
      <ThemedText>{item.filename}</ThemedText>
      <ThemedText style={styles.uploadDate}>
        {new Date(item.createdAt).toLocaleDateString()}
      </ThemedText>
    </View>
  );

  const renderStyle = ({ item }: { item: Style }) => (
    <TouchableOpacity 
      style={styles.styleCard}
      onPress={() => setSelectedStyle(selectedStyle?.id === item.id ? null : item)}
    >
      <View style={styles.styleHeader}>
        <View style={styles.styleInfo}>
          <ThemedText style={styles.styleName}>{item.name}</ThemedText>
          <ThemedText style={styles.fileCount}>{item.uploads.length} files</ThemedText>
        </View>
        <Ionicons 
          name={selectedStyle?.id === item.id ? "chevron-down" : "chevron-forward"} 
          size={24} 
          color={theme.colors.textSecondary} 
        />
      </View>
      
      {selectedStyle?.id === item.id && (
        <View style={styles.uploadsList}>
          {item.uploads.length > 0 ? (
            <FlatList
              data={item.uploads}
              renderItem={renderUpload}
              keyExtractor={upload => upload.id}
              scrollEnabled={false}
            />
          ) : (
            <ThemedText style={styles.noUploads}>No uploads yet</ThemedText>
          )}
          <TouchableOpacity 
            style={styles.uploadButton}
            onPress={() => {
              AsyncStorage.setItem('styleId', item.id);
              router.push('/upload');
            }}
          >
            <Ionicons name="cloud-upload" size={20} color={theme.colors.primary} />
            <ThemedText style={styles.uploadButtonText}>Upload More</ThemedText>
          </TouchableOpacity>
        </View>
      )}
    </TouchableOpacity>
  );

  return (
    <ThemedView style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <ThemedText style={styles.title}>Styles</ThemedText>
        <TouchableOpacity 
          style={styles.newUploadButton}
          onPress={() => router.push('/upload')}
        >
          <Ionicons name="add" size={24} color={theme.colors.surface} />
          <ThemedText style={styles.newUploadText}>New Style</ThemedText>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={theme.colors.primary} />
        </View>
      ) : styles.length > 0 ? (
        <FlatList
          data={styles}
          renderItem={renderStyle}
          keyExtractor={item => item.id}
          refreshing={refreshing}
          onRefresh={onRefresh}
          contentContainerStyle={[
            styles.list,
            { paddingBottom: insets.bottom + theme.spacing.md }
          ]}
        />
      ) : (
        <View style={styles.centered}>
          <Ionicons name="images-outline" size={48} color={theme.colors.textSecondary} />
          <ThemedText style={styles.emptyText}>No styles yet</ThemedText>
        </View>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: theme.spacing.lg,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
  },
  newUploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.primary,
    padding: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
    gap: theme.spacing.sm,
  },
  newUploadText: {
    color: theme.colors.surface,
    fontWeight: '500',
  },
  list: {
    padding: theme.spacing.md,
  },
  styleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  styleThumbnail: {
    width: 60,
    height: 60,
    borderRadius: theme.borderRadius.sm,
  },
  placeholderThumbnail: {
    width: 60,
    height: 60,
    borderRadius: theme.borderRadius.sm,
    backgroundColor: theme.colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  styleInfo: {
    flex: 1,
    marginLeft: theme.spacing.md,
  },
  styleName: {
    fontSize: 16,
    fontWeight: '500',
  },
  fileCount: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginTop: 4,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    marginTop: theme.spacing.md,
    color: theme.colors.textSecondary,
    fontSize: 16,
  },
  styleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  uploadsList: {
    marginTop: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    paddingTop: theme.spacing.md,
  },
  uploadItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
  },
  uploadDate: {
    color: theme.colors.textSecondary,
    fontSize: 14,
  },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.sm,
    marginTop: theme.spacing.sm,
    borderRadius: theme.borderRadius.sm,
    borderWidth: 1,
    borderColor: theme.colors.primary,
    gap: theme.spacing.sm,
  },
  uploadButtonText: {
    color: theme.colors.primary,
    fontWeight: '500',
  },
  noUploads: {
    textAlign: 'center',
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.sm,
  },
});
