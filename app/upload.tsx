import { useState, useEffect } from 'react';
import { StyleSheet, Image, TouchableOpacity, Alert, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Camera } from 'expo-camera';
import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';
import { router } from 'expo-router';
import { theme } from './styles/theme';
import { Ionicons } from '@expo/vector-icons';
import { ImageAnnotator } from '@/components/ImageAnnotator';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface ImageAsset {
  uri: string;
  uploaded: boolean;
  hasAnnotations?: boolean;
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
    console.log('Loading saved annotations:', savedAnnotations);
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

  const pickImages = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true, // Enable multiple selection
      selectionLimit: 10, // Optional: limit number of selections
      quality: 1,
    });

    if (!result.canceled) {
      const newImages = result.assets.map(asset => ({
        uri: asset.uri,
        uploaded: false
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

    if (!result.canceled) {
      const newImage = {
        uri: result.assets[0].uri,
        uploaded: false
      };
      setImages(prev => [...prev, newImage]);
    }
  };

  const handleUpload = async () => {
    if (images.length === 0) return;
    setUploading(true);

    try {
      const { styleId, uniqueId, baseUrl } = global.uploadContext;
      const uploadUrl = `${baseUrl}/api/mobile-upload`;
      
      const results = await Promise.all(
        images.map(async (image, index) => {
          if (image.uploaded) return null;

          const formData = new FormData();
          formData.append('image', {
            uri: image.uri,
            type: 'image/jpeg',
            name: `upload_${index}.jpg`,
          } as any);
          formData.append('styleId', styleId);
          formData.append('uniqueId', uniqueId);

          // Add annotations if they exist
          const storageKey = `annotations_${image.uri}`;
          const annotations = await AsyncStorage.getItem(storageKey);
          console.log('Retrieved annotations for upload:', annotations); // Debug log
          
          if (annotations) {
            formData.append('annotations', annotations);
            console.log('Added annotations to formData:', annotations); // Debug log
          }

          // Log the entire formData
          console.log('FormData entries:');
          for (let [key, value] of formData.entries()) {
            console.log(key, value);
          }

          const response = await fetch(uploadUrl, {
            method: 'POST',
            body: formData,
            headers: {
              'Accept': 'application/json',
              'Content-Type': 'multipart/form-data',
            },
          });

          if (!response.ok) {
            const errorText = await response.text();
            console.error('Upload response error:', errorText); // Debug log
            throw new Error(`Upload failed for image ${index + 1}`);
          }

          // Clean up annotations from storage after successful upload
          await AsyncStorage.removeItem(storageKey);
          console.log('Cleaned up annotations for:', storageKey); // Debug log

          return index;
        })
      );

      const successfulUploads = results.filter(result => result !== null).length;
      
      setImages(prev => prev.map((img, idx) => ({
        ...img,
        uploaded: results.includes(idx) || img.uploaded
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
    }
  };

  const removeImage = (index: number) => {
    setImages(prev => prev.filter((_, idx) => idx !== index));
  };

  const handleImagePress = async (index: number) => {
    setSelectedImageIndex(index);
    const annotations = await loadSavedAnnotations(images[index].uri);
    setLoadedAnnotations(annotations);
    setShowAnnotator(true);
  };

  const handleAnnotatedImage = async (annotations: AnnotationData) => {
    try {
      if (selectedImageIndex !== null) {
        console.log('Saving annotations:', annotations); // Debug log
        
        // Save annotations to AsyncStorage
        const storageKey = `annotations_${images[selectedImageIndex].uri}`;
        await AsyncStorage.setItem(
          storageKey, 
          JSON.stringify(annotations)
        );

        // Verify the save worked by reading it back
        const savedAnnotations = await AsyncStorage.getItem(storageKey);
        console.log('Verified saved annotations:', savedAnnotations); // Debug log

        // Update local state
        setImages(prev => prev.map((img, idx) => 
          idx === selectedImageIndex 
            ? { ...img, hasAnnotations: true } 
            : img
        ));
      }
      setShowAnnotator(false);
      setSelectedImageIndex(null);
    } catch (error) {
      console.error('Error saving annotations:', error);
      Alert.alert('Error', 'Failed to save annotations');
    }
  };

  const renderImage = (image: ImageAsset, index: number) => (
    <TouchableOpacity 
      key={index} 
      style={styles.imageContainer}
      onPress={() => handleImagePress(index)}
    >
      <Image source={{ uri: image.uri }} style={styles.imagePreview} />
      <TouchableOpacity 
        style={styles.removeButton}
        onPress={() => removeImage(index)}
      >
        <Ionicons name="close-circle" size={24} color={theme.colors.error} />
      </TouchableOpacity>
      {image.uploaded && (
        <View style={styles.uploadedBadge}>
          <Ionicons name="checkmark-circle" size={24} color={theme.colors.success} />
        </View>
      )}
      {image.hasAnnotations && (
        <View style={styles.annotationBadge}>
          <Ionicons name="create" size={16} color={theme.colors.primary} />
        </View>
      )}
    </TouchableOpacity>
  );

  return (
    <ThemedView style={styles.container}>
      <View style={styles.header}>
        <ThemedText style={styles.title}>Upload Style Files</ThemedText>
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
              {uploading ? 'Uploading...' : `Upload ${images.length} Images`}
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
  },
  uploadedBadge: {
    position: 'absolute',
    bottom: -10,
    right: -10,
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
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
});
