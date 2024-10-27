# Matter Style Files Mobile App

A React Native mobile application built with Expo that enables Matter users to scan QR codes and upload style files directly from their mobile devices. This app streamlines the process of uploading style files by allowing users to capture and submit files immediately after scanning a valid QR code..

## Features

- QR Code scanning with real-time validation
- Secure file upload system
- Integration with Matter's backend services
- Clean, intuitive user interface
- Real-time upload status feedback
- Error handling and validation
- Automatic navigation flow

## Technical Stack

- **Framework**: React Native with Expo
- **Navigation**: Expo Router (file-based)
- **Camera**: expo-camera
- **Styling**: Custom themed components
- **State Management**: React hooks
- **Network**: Fetch API for uploads

## Project Structure

```
app/
├── (tabs)/
│   └── index.tsx      # Home screen
├── scanner.tsx        # QR code scanner
├── upload.tsx         # File upload screen
├── _layout.tsx        # Navigation layout
└── styles/
    └── theme.ts       # Theme configuration
```

## Setup Instructions

1. Install the Expo Go app on your mobile device:
   - [Expo Go for iOS](https://apps.apple.com/app/expo-go/id982107779)
   - [Expo Go for Android](https://play.google.com/store/apps/details?id=host.exp.exponent)

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npx expo start
```

4. Run on your device:
   - Scan QR code with Expo Go app (iOS/Android)
   - Press 'i' for iOS simulator
   - Press 'a' for Android emulator

## Development Flow

1. **Home Screen (`app/(tabs)/index.tsx`)**
   - Entry point for the app
   - Contains the scan QR code button
   - Handles navigation to scanner

2. **Scanner Screen (`app/scanner.tsx`)**
   - Manages camera permissions
   - Validates QR code format
   - Extracts style ID and unique identifier
   - Navigates to upload on successful scan

3. **Upload Screen (`app/upload.tsx`)**
   - Handles file selection
   - Manages upload process
   - Provides feedback on upload status
   - Returns to home on completion

## API Integration

The app expects QR codes in the following format:
```
http://[server-url]/mobile-upload/[style-id]/[unique-id]
```

Upload endpoint:
```
POST http://[server-url]/api/mobile-upload
Content-Type: multipart/form-data

{
  image: [file],
  styleId: [string],
  uniqueId: [string]
}
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## Support

For internal support, contact the Matter development team.

## License

This project is private and proprietary to Matter.
