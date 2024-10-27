import { useState, useEffect } from 'react';
import { StyleSheet, Image, TouchableOpacity, Alert, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Camera } from 'expo-camera';
import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';
import { router } from 'expo-router';
import { theme } from './styles/theme';
import { Ionicons } from '@expo/vector-icons';

export default function UploadScreen() {
  const [image, setImage] = useState<string | null>(null);

  const takePhoto = async () => {
    const { status } = await Camera.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Camera permission is required to take photos');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [4, 3],
      quality: 1,
    });

    if (!result.canceled) {
      setImage(result.assets[0].uri);
      handleUpload(result.assets[0].uri);
    }
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 1,
    });

    if (!result.canceled) {
      setImage(result.assets[0].uri);
      handleUpload(result.assets[0].uri);
    }
  };

  const handleUpload = async (imageUri: string) => {
    try {
      const { styleId, uniqueId, baseUrl } = global.uploadContext;
      const uploadUrl = `${baseUrl}/api/mobile-upload`;

      console.log('Starting upload to:', uploadUrl);

      const formData = new FormData();
      formData.append('image', {
        uri: imageUri,
        type: 'image/jpeg',
        name: 'upload.jpg',
      } as any);
      formData.append('styleId', styleId);
      formData.append('uniqueId', uniqueId);

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
        throw new Error(`Server responded with ${response.status}: ${errorText}`);
      }

      Alert.alert('Success', 'Image uploaded successfully!', [
        {
          text: 'OK',
          onPress: () => router.replace('/(tabs)') // Go back to home
        }
      ]);
    } catch (error) {
      console.error('Upload error details:', error);
      Alert.alert('Upload Failed', 'Could not upload image. Please try again.');
    }
  };

  const testConnection = async () => {
    try {
      const { baseUrl } = global.uploadContext;
      console.log('Testing connection to:', baseUrl);
      const response = await fetch(baseUrl);
      console.log('Connection test response:', response.status);
    } catch (error) {
      console.error('Connection test failed:', error);
    }
  };

  useEffect(() => {
    testConnection();
  }, []);

  return (
    <ThemedView style={styles.container}>
      <View style={styles.header}>
        <ThemedText style={styles.title}>Upload Style File</ThemedText>
      </View>

      <View style={styles.content}>
        {image ? (
          <Image source={{ uri: image }} style={styles.preview} />
        ) : (
          <View style={styles.placeholder}>
            <Ionicons name="image-outline" size={48} color={theme.colors.textSecondary} />
            <ThemedText style={styles.placeholderText}>No image selected</ThemedText>
          </View>
        )}

        <View style={styles.buttonContainer}>
          <TouchableOpacity style={[styles.button, styles.secondaryButton]} onPress={pickImage}>
            <ThemedText style={styles.secondaryButtonText}>Choose Photo</ThemedText>
          </TouchableOpacity>

          <TouchableOpacity style={styles.button} onPress={takePhoto}>
            <ThemedText style={styles.buttonText}>Take Photo</ThemedText>
          </TouchableOpacity>
        </View>
      </View>
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
});
