import { StyleSheet, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';
import { theme } from '../styles/theme';
import { useRouter } from 'expo-router';

export default function HomeScreen() {
  const router = useRouter();
  
  return (
    <ThemedView style={styles.container}>
      <ThemedText style={styles.title}>Welcome to Matter Style Files Uploader</ThemedText>
      
      <TouchableOpacity 
        style={styles.button}
        onPress={() => router.push('/scanner')}
      >
        <ThemedText style={styles.buttonText}>Scan QR Code (in style files</ThemedText>
      </TouchableOpacity>

      {/* <TouchableOpacity 
        style={[styles.button, styles.secondaryButton]}
        onPress={() => router.push('/upload')}
      >
        <ThemedText style={styles.secondaryButtonText}>Upload Photo</ThemedText>
      </TouchableOpacity> */}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.lg,
    backgroundColor: theme.colors.background,
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    marginBottom: theme.spacing.xl,
    color: theme.colors.text,
  },
  button: {
    backgroundColor: theme.colors.primary,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    width: '100%',
    marginBottom: theme.spacing.md,
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
