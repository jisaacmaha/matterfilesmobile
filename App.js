import 'react-native-gesture-handler';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import HomeScreen from './screens/HomeScreen';
import ScannerScreen from './screens/ScannerScreen';
import UploadScreen from './screens/UploadScreen';
import { StatusBar } from 'expo-status-bar';

const Stack = createNativeStackNavigator();

export default function App() {
  return (
    <>
      <StatusBar style="auto" />
      <NavigationContainer>
        <Stack.Navigator initialRouteName="Home">
          <Stack.Screen 
            name="Home" 
            component={HomeScreen}
            options={{ title: 'Style Files' }}
          />
          <Stack.Screen 
            name="Scanner" 
            component={ScannerScreen}
            options={{ title: 'Scan Barcode' }}
          />
          <Stack.Screen 
            name="Upload" 
            component={UploadScreen}
            options={{ title: 'Upload Photo' }}
          />
        </Stack.Navigator>
      </NavigationContainer>
    </>
  );
}
