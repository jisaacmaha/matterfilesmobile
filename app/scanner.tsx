import { useState, useEffect } from 'react';
import { StyleSheet, View, TouchableOpacity } from 'react-native';
import { BarCodeScanner } from 'expo-barcode-scanner';
import { router } from 'expo-router';
import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';
import { theme } from './styles/theme';

export default function ScannerScreen() {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [scanned, setScanned] = useState(false);

  useEffect(() => {
    const getCameraPermissions = async () => {
      const { status } = await BarCodeScanner.requestPermissionsAsync();
      setHasPermission(status === 'granted');
    };

    getCameraPermissions();
  }, []);

  const handleBarCodeScanned = ({ data }: { type: string; data: string }) => {
    if (scanned) return;
    
    try {
      console.log('QR Code scanned:', data);
      
      const url = new URL(data);
      const pathParts = url.pathname.split('/');
      const styleId = pathParts[2];
      const uniqueId = pathParts[3];

      if (styleId && uniqueId) {
        setScanned(true);
        global.uploadContext = {
          styleId,
          uniqueId,
          baseUrl: url.origin
        };
        
        router.push('/upload');
      }
    } catch (error) {
      console.error('Scanner error:', error);
      alert('Invalid QR Code format');
      setScanned(false);
    }
  };

  if (hasPermission === null) {
    return (
      <ThemedView style={styles.container}>
        <ThemedText>Requesting camera permission...</ThemedText>
      </ThemedView>
    );
  }

  if (hasPermission === false) {
    return (
      <ThemedView style={styles.container}>
        <ThemedText>No access to camera</ThemedText>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <BarCodeScanner
        style={StyleSheet.absoluteFillObject}
        onBarCodeScanned={scanned ? undefined : handleBarCodeScanned}
        barCodeTypes={[BarCodeScanner.Constants.BarCodeType.qr]}
      >
        <View style={styles.overlay}>
          <View style={styles.scanFrame} />
          <ThemedText style={styles.instructions}>
            Position the QR code within the frame
          </ThemedText>
        </View>

        {scanned && (
          <TouchableOpacity 
            style={styles.rescanButton}
            onPress={() => setScanned(false)}
          >
            <ThemedText style={styles.buttonText}>Scan Again</ThemedText>
          </TouchableOpacity>
        )}
      </BarCodeScanner>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanFrame: {
    width: 250,
    height: 250,
    borderWidth: 2,
    borderColor: theme.colors.surface,
    borderRadius: theme.borderRadius.md,
  },
  instructions: {
    color: theme.colors.surface,
    fontSize: 16,
    marginTop: theme.spacing.lg,
    textAlign: 'center',
    paddingHorizontal: theme.spacing.lg,
  },
  rescanButton: {
    position: 'absolute',
    bottom: theme.spacing.xl,
    alignSelf: 'center',
    backgroundColor: theme.colors.primary,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.borderRadius.md,
  },
  buttonText: {
    color: theme.colors.surface,
    fontSize: 16,
    fontWeight: '500',
  },
});