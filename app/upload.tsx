import { useState, useEffect, useRef } from 'react';
import { StyleSheet, Image, TouchableOpacity, Alert, View, Modal, ActivityIndicator } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Camera } from 'expo-camera';
import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';
import { router } from 'expo-router';
import { theme } from './styles/theme';
import { Ionicons } from '@expo/vector-icons';
import { ImageAnnotator } from '@/components/ImageAnnotator';
import { captureRef } from 'react-native-view-shot';

import AsyncStorage from '@react-native-async-storage/async-storage';

interface ImageAsset {
  uri: string;
  uploaded: boolean;
  hasAnnotations?: boolean;
  annotations?: AnnotationData;
  thumbnailUri?: string;
  selected?: boolean;
}

interface AnnotationData {
  paths: any[];
  texts: any[];
  icons: any[];
  rectangles: any[];
  measurements: any[];
}

// Add a function to load saved annotations
const loadSavedAnnotations = async (imageUri: string) => {
  try {
    const storageKey = `annotations_${imageUri}`;
    const savedAnnotations = await AsyncStorage.getItem(storageKey);
    // console.log('Loading saved annotations:', savedAnnotations);
    return savedAnnotations ? JSON.parse(savedAnnotations) : null;
  } catch (error) {
    console.error('Error loading annotations:', error);
    return null;
  }
};

export default function UploadScreen() {
  const [images, setImages] = useState<ImageAsset[]>([]);
  const [uploading, setUploading] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(null);
  const [showAnnotator, setShowAnnotator] = useState(false);
  const [loadedAnnotations, setLoadedAnnotations] = useState<AnnotationData | null>(null);
  const imageAnnotatorRef = useRef<ImageAnnotator>(null);

  // Add new state for tracking progress
  const [uploadProgress, setUploadProgress] = useState<{[key: string]: number}>({});

  const [styleName, setStyleName] = useState<string>('');

  useEffect(() => {
    loadStyleInfo();
  }, []);

  const loadStyleInfo = async () => {
    try {
      const styleId = await AsyncStorage.getItem('styleId');
      const accessToken = await AsyncStorage.getItem('accessToken');
      const baseUrl = await AsyncStorage.getItem('baseUrl');
      
      const response = await fetch(`${baseUrl}/api/styles/${styleId}`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json',
        },
      });
      
      const data = await response.json();
      setStyleName(data.name);
    } catch (error) {
      console.error('Error loading style info:', error);
    }
  };

  const pickImages = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      selectionLimit: 10,
      quality: 1,
    });

    if (!result.canceled) {
      const newImages = result.assets.map(asset => ({
        uri: asset.uri,
        uploaded: false,
        selected: false
      }));
      setImages(prev => [...prev, ...newImages]);
    }
  };

  const takePhoto = async () => {
    const { status } = await Camera.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Camera permission is required to take photos');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      quality: 1,
    });

    // console.log('Camera result:', result);

    if (!result.canceled) {
      const newImage = {
        uri: result.assets[0].uri,
        uploaded: false
      };
      setImages(prev => [...prev, newImage]);
    }
  };

  const handleUpload = async () => {
    const selectedImages = images.filter(img => img.selected);
    if (selectedImages.length === 0) {
      Alert.alert('No Images Selected', 'Please select at least one image to upload.');
      return;
    }
    setUploading(true);

    try {
      const styleId = await AsyncStorage.getItem('styleId')
      const accessToken = await AsyncStorage.getItem('accessToken')
      const baseUrl = await AsyncStorage.getItem('baseUrl')
      const uploadUrl = `${baseUrl}/api/styles/${styleId}/files`;
      
      const results = await Promise.all(
        selectedImages.map(async (image) => {
          if (image.uploaded) return null;

          const formData = new FormData();
          formData.append('file', {
            uri: (image.annotations && image.annotations.thumbnailUri) ? image.annotations.thumbnailUri : image.uri,
            type: 'image/jpeg',
            name: `upload_${Date.now()}.jpg`,
          } as any);

          return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            
            xhr.upload.onprogress = (event) => {
              if (event.lengthComputable) {
                const progress = (event.loaded / event.total) * 100;
                setUploadProgress(prev => ({
                  ...prev,
                  [image.uri]: progress
                }));
              }
            };

            xhr.onload = () => {
              if (xhr.status === 200) {
                resolve(image.uri);
              } else {
                reject(new Error('Upload failed'));
              }
            };

            xhr.onerror = () => {
              reject(new Error('Upload failed'));
            };

            xhr.open('POST', uploadUrl);
            xhr.setRequestHeader('Accept', 'application/json');
            xhr.setRequestHeader('Authorization', `Bearer ${accessToken}`);
            xhr.send(formData);
          });
        })
      );

      const successfulUploads = results.filter(result => result !== null).length;
      
      setImages(prev => prev.map(img => ({
        ...img,
        uploaded: results.includes(img.uri) || img.uploaded
      })));

      Alert.alert(
        'Upload Complete', 
        `Successfully uploaded ${successfulUploads} images`,
        [
          {
            text: 'OK',
            onPress: () => {
              if (images.every(img => img.uploaded)) {
                router.replace('/(tabs)');
              }
            }
          }
        ]
      );
    } catch (error) {
      console.error('Upload error:', error);
      Alert.alert('Upload Failed', 'Some images could not be uploaded. Please try again.');
    } finally {
      setUploading(false);
      // Clear progress after upload completes
      setUploadProgress({});
    }
  };

  const removeImage = (index: number) => {
    setImages(prev => prev.filter((_, idx) => idx !== index));
  };

  const handleImagePress = async (index: number) => {
    setSelectedImageIndex(index);
    // console.log('Selected image index:', index);
    // console.log('image:', images);
    const annotations = await loadSavedAnnotations(images[index].uri);
    setLoadedAnnotations(annotations);
    setShowAnnotator(true);
  };

  const handleAnnotatedImage = async (annotations: AnnotationData) => {
    try {
      if (selectedImageIndex !== null) {
        // console.log('Saving annotations:', annotations);
        
        // Save annotations to AsyncStorage
        const storageKey = `annotations_${images[selectedImageIndex].uri}`;
        await AsyncStorage.setItem(
          storageKey, 
          JSON.stringify(annotations)
        );

        // Verify the save worked by reading it back
        const savedAnnotations = await AsyncStorage.getItem(storageKey);
        // console.log('Verified saved annotations:', savedAnnotations);

        // Update local state
        setImages(prev => prev.map((img, idx) => 
          idx === selectedImageIndex 
            ? { 
                ...img, 
                hasAnnotations: true, 
                annotations: savedAnnotations ? JSON.parse(savedAnnotations) : undefined,
              } 
            : img
        ));
        // console.log('Updated images state:', images);
      }
      setShowAnnotator(false);
      setSelectedImageIndex(null);
    } catch (error) {
      console.error('Error saving annotations:', error);
      Alert.alert('Error', 'Failed to save annotations');
    }
  };

  const toggleImageSelection = (index: number) => {
    setImages(prev => prev.map((img, idx) => 
      idx === index ? { ...img, selected: !img.selected } : img
    ));
  };

  const renderImage = (image: ImageAsset, index: number) => (
    <TouchableOpacity 
      key={index} 
      style={[styles.imageContainer, image.selected && styles.selectedImageContainer]}
      onLongPress={() => handleImagePress(index)}
      onPress={() => toggleImageSelection(index)}
    >
      <Image 
        source={{ uri: (image.annotations && image.annotations.thumbnailUri) ? image.annotations.thumbnailUri : image.uri }} 
        style={styles.imagePreview} 
      />
      
      {image.selected && (
        <View style={styles.selectionBadge}>
          <Ionicons name="checkmark-circle" size={24} color={theme.colors.primary} />
        </View>
      )}
      <TouchableOpacity 
        style={styles.removeButton}
        onPress={() => removeImage(index)}
      >
        <Ionicons name="close-circle" size={24} color={theme.colors.error} />
      </TouchableOpacity>
      {image.uploaded && (
        <View style={styles.uploadedBadge}>
          <ThemedText style={styles.uploadedText}>Uploaded</ThemedText>
        </View>
      )}
      {image.hasAnnotations && (
        <View style={styles.annotationBadge}>
          <Ionicons name="create" size={16} color={theme.colors.primary} />
        </View>
      )}
      {uploadProgress[image.uri] !== undefined && !image.uploaded && (
        <View style={styles.progressBarContainer}>
          <View style={[styles.progressBar, { width: `${uploadProgress[image.uri]}%` }]} />
          <ThemedText style={styles.progressText}>
            {Math.round(uploadProgress[image.uri])}%
          </ThemedText>
        </View>
      )}
    </TouchableOpacity>
  );

  return (
    <ThemedView style={styles.container}>
      <View style={styles.header}>
        <View>
          <ThemedText style={styles.title}>Upload Files</ThemedText>
          {styleName && (
            <ThemedText style={styles.subtitle}>Style: {styleName}</ThemedText>
          )}
        </View>
      </View>

      <View style={styles.content}>
        {images.length > 0 ? (
          <View style={styles.imageGrid}>
            {images.map((image, index) => renderImage(image, index))}
          </View>
        ) : (
          <View style={styles.placeholder}>
            <Ionicons name="images-outline" size={48} color={theme.colors.textSecondary} />
            <ThemedText style={styles.placeholderText}>No images selected</ThemedText>
          </View>
        )}

        <View style={styles.buttonContainer}>
          <TouchableOpacity 
            style={[styles.button, styles.secondaryButton]} 
            onPress={pickImages}
          >
            <ThemedText style={styles.secondaryButtonText}>Choose Photos</ThemedText>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.button} 
            onPress={takePhoto}
          >
            <ThemedText style={styles.buttonText}>Take Photo</ThemedText>
          </TouchableOpacity>
        </View>

        {images.length > 0 && (
          <TouchableOpacity 
            style={[styles.uploadButton, uploading && styles.uploadingButton]} 
            onPress={handleUpload}
            disabled={uploading}
          >
            <ThemedText style={styles.uploadButtonText}>
              {uploading ? 'Uploading...' : `Upload ${images.filter(img => img.selected).length} Selected Images`}
            </ThemedText>
          </TouchableOpacity>
        )}
      </View>

      {showAnnotator && selectedImageIndex !== null && (
        <ImageAnnotator
          imageUri={images[selectedImageIndex].uri}
          visible={showAnnotator}
          onClose={() => {
            setShowAnnotator(false);
            setLoadedAnnotations(null);
          }}
          onSave={handleAnnotatedImage}
          initialAnnotations={loadedAnnotations}
        />
      )}

      <Modal
        visible={uploading}
        transparent={true}
        animationType="fade"
      >
        <View style={styles.modalOverlay}>
          <View style={styles.progressDialog}>
            <ThemedText style={styles.progressTitle}>Uploading Images</ThemedText>
            
            {Object.entries(uploadProgress).map(([uri, progress]) => (
              <View key={uri} style={styles.progressItem}>
                <Image 
                  source={{ uri }} 
                  style={styles.progressThumb} 
                />
                <View style={styles.progressBarContainer}>
                  <View style={[styles.progressBar, { width: `${progress}%` }]} />
                  <ThemedText style={styles.progressText}>{Math.round(progress)}%</ThemedText>
                </View>
              </View>
            ))}

            <ActivityIndicator 
              style={styles.progressSpinner} 
              color={theme.colors.primary} 
            />
          </View>
        </View>
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    padding: theme.spacing.lg,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: theme.colors.text,
  },
  subtitle: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginTop: 4,
  },
  content: {
    flex: 1,
    padding: theme.spacing.lg,
  },
  preview: {
    width: '100%',
    height: 300,
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing.lg,
  },
  placeholder: {
    width: '100%',
    height: 300,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
  },
  placeholderText: {
    marginTop: theme.spacing.sm,
    color: theme.colors.textSecondary,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: theme.spacing.md,
  },
  button: {
    flex: 1,
    backgroundColor: theme.colors.primary,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
  },
  secondaryButton: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  buttonText: {
    color: theme.colors.surface,
    fontSize: 16,
    fontWeight: '500',
  },
  secondaryButtonText: {
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: '500',
  },
  imageGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.lg,
  },
  imageContainer: {
    width: '31%',
    aspectRatio: 1,
    position: 'relative',
  },
  imagePreview: {
    width: '100%',
    height: '100%',
    borderRadius: theme.borderRadius.sm,
  },
  removeButton: {
    position: 'absolute',
    top: -10,
    right: -10,
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    zIndex: 1,
  },
  uploadedBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: theme.colors.success + '99',
    borderTopLeftRadius: theme.borderRadius.sm,
    padding: 4,
  },
  uploadedText: {
    fontSize: 10,
    color: theme.colors.surface,
    fontWeight: '500',
  },
  uploadButton: {
    backgroundColor: theme.colors.primary,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
    marginTop: theme.spacing.md,
  },
  uploadingButton: {
    opacity: 0.7,
  },
  uploadButtonText: {
    color: theme.colors.surface,
    fontSize: 16,
    fontWeight: '500',
  },
  annotationBadge: {
    position: 'absolute',
    bottom: -10,
    left: -10,
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    padding: 4,
  },
  thumbnailContainer: {
    height: 100, // Set a height for the thumbnail
    overflow: 'hidden',
    marginBottom: theme.spacing.md,
  },
  thumbnail: {
    width: '100%',
    height: '100%',
  },
  selectedImageContainer: {
    borderWidth: 2,
    borderColor: theme.colors.primary,
  },
  selectionBadge: {
    position: 'absolute',
    top: -10,
    left: -10,
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    padding: 4,
    zIndex: 1,
  },
  progressBarContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    height: 24,
    justifyContent: 'center',
  },
  progressBar: {
    position: 'absolute',
    left: 0,
    height: '100%',
    backgroundColor: theme.colors.primary + '80', // semi-transparent
  },
  progressText: {
    fontSize: 10,
    color: theme.colors.surface,
    textAlign: 'center',
    fontWeight: '600',
    zIndex: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.lg,
  },
  progressDialog: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    width: '90%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  progressTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: theme.spacing.lg,
    textAlign: 'center',
  },
  progressItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  progressThumb: {
    width: 40,
    height: 40,
    borderRadius: theme.borderRadius.sm,
    marginRight: theme.spacing.md,
  },
  progressBarContainer: {
    flex: 1,
    height: 24,
    backgroundColor: theme.colors.border,
    borderRadius: theme.borderRadius.sm,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: theme.colors.primary,
  },
  progressText: {
    position: 'absolute',
    width: '100%',
    textAlign: 'center',
    lineHeight: 24,
    color: theme.colors.surface,
    fontWeight: '600',
  },
  progressSpinner: {
    marginTop: theme.spacing.lg,
  },
});
