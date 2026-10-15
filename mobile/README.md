# 📱 Universal File Converter — Mobile (iOS & Android)

A modern, fast, and **100% private & offline** mobile application for document and image processing. Your files never leave your device.

---

## 🌟 Highlights

- 🔒 **100% On-Device & Private**: Zero cloud servers, zero external API calls. All PDF and image manipulations happen locally on your smartphone.
- 📱 **Cross-Platform**: Full support for iOS (iPhone/iPad) and Android.
- ⚡ **Instant Testing via QR Code**: Run the app live on your physical phone in seconds via Expo Go without needing Xcode, Android Studio, or a Mac.
- 🎨 **Modern Fluent UI**: Dark mode, haptic-ready buttons, native share sheets, and smooth tab navigation.

---

## 🛠️ Supported Operations

### 📄 PDF Studio
- **Merge PDFs**: Select multiple PDF documents from your phone and combine them in order into a single unified file.
- **Split Pages**: Split each page of a PDF into individual 1-page PDF documents.
- **Extract Pages**: Extract custom page sequences (e.g., `1-3, 5, 8-`).
- **Rotate Pages**: Rotate pages 90°, 180°, or 270° clockwise.

### 🖼️ Image Studio
- **Images to PDF**: Combine photos from your camera roll or files into a multi-page PDF document (supports *Fit to Image* or *Standard A4* layout).
- **Format Conversion**: Convert between JPEG, PNG, and WebP.
- **Compression & Quality**: Downscale and compress image size (Maximum 95%, Balanced 80%, Compact 50%).

### ✍️ Text & Notes Studio
- **Text to PDF**: Type or paste notes, markdown, or summaries and export a crisp, paginated PDF with automatic line-wrapping and page numbers.

### 📁 File Manager & Sharing
- Native system share sheet integration (AirDrop, WhatsApp, Google Drive, Save to Files).
- Document directory browser with file size and creation date.

---

## 🚀 How to Run on Your Phone (Quick Start)

### 1. Install Expo Go on Your Mobile Device
- **iPhone / iPad**: Download **Expo Go** from the [Apple App Store](https://apps.apple.com/app/expo-go/id982107779).
- **Android**: Download **Expo Go** from the [Google Play Store](https://play.google.com/store/apps/details?id=host.exp.exponent).

### 2. Start the Development Server
In your terminal, navigate to the `mobile` directory and launch Expo:

```bash
cd mobile
npx expo start
```

### 3. Scan the QR Code
- **On iPhone**: Open the default **Camera** app, point it at the QR code in your terminal, and tap the yellow **"Open in Expo Go"** banner.
- **On Android**: Open the **Expo Go** app, tap **"Scan QR Code"**, and scan the QR code.

The app will bundle and open immediately on your device with live hot-reloading!

---

## 📦 Building Standalone Installers (APK / IPA)

You can build standalone installable apps for distribution without needing Android Studio or a Mac by using **EAS (Expo Application Services)**:

### 1. Install EAS CLI
```bash
npm install -g eas-cli
```

### 2. Log In & Configure
```bash
eas login
eas build:configure
```

### 3. Generate Android APK (Install directly on Android phones)
```bash
eas build -p android --profile preview
```
This will compile the APK in the cloud and give you a download link to install directly on any Android device.

### 4. Generate iOS Build
```bash
eas build -p ios --profile preview
```
*(Requires a free or paid Apple Developer account)*
