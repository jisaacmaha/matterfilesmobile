import { StyleSheet, View, TouchableOpacity, Text } from 'react-native';

export default function HomeScreen({ navigation }) {
  return (
    <View style={styles.container}>
      <TouchableOpacity 
        style={styles.button}
        onPress={() => navigation.navigate('Scanner')}
      >
        <Text style={styles.buttonText}>Scan Barcode</Text>
      </TouchableOpacity>

      <TouchableOpacity 
        style={styles.button}
        onPress={() => navigation.navigate('Upload')}
      >
        <Text style={styles.buttonText}>Upload Photo</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  button: {
    backgroundColor: '#007AFF',
    padding: 20,
    borderRadius: 10,
    width: '100%',
    marginBottom: 10,
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    textAlign: 'center',
  },
});