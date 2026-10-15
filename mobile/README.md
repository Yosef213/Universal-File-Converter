# 📱 Universal File Converter — Mobile (iOS & Android)

A modern, fast, and **100% private & offline** mobile application for document, PDF, and image processing. Your files never leave your device.

---

## 🌟 Highlights

- 🔒 **100% On-Device & Private**: Zero cloud servers, zero tracking, no accounts needed. All document processing happens strictly on your smartphone hardware.
- 📦 **Standalone Installable App**: Runs natively on your phone as a standalone app with its own home screen icon and storage access.
- ⚡ **Full Feature Parity**:
  - **PDF Studio**: Word, Excel, Text, PNG/JPG rendering, Merge, Split, Extract, Rotate, Compress, Encrypt, Decrypt.
  - **Word & Documents Studio**: Word (.docx) to PDF, Text/MD/CSV to PDF, Scratchpad Notes to PDF.
  - **Image Studio**: Images to PDF (Fit or A4), Format conversion (PNG, JPG, WEBP), and 25-100% downscaling / quality compression.
  - **Storage & Sharing**: One-tap "Save to Folder" via Android Storage Access Framework (Downloads folder) + native share sheet.

---

## 🛠️ Complete Supported Operations

### 📄 1. PDF Studio
| Operation | Description | Options |
|---|---|---|
| **To Word** | Converts PDF pages into editable `.docx` documents. | Page range |
| **To Excel** | Detects tables and exports into `.xlsx` spreadsheet sheets. | Page range |
| **To Text** | Extracts clean selectable text into `.txt` format. | Page range |
| **To Images** | Converts document pages to PNG or JPG images. | Page range, DPI (150/300) |
| **Merge PDFs** | Joins multiple PDFs into a single unified document. | Custom output name |
| **Split Pages** | Splits document into individual 1-page PDF files. | Page range |
| **Extract Pages** | Extracts custom page sequences (e.g. `1-3, 5, 8-`). | Custom page spec |
| **Rotate Pages** | Rotates orientation (90° CW, 180°, 270° CW). | Angle, page range |
| **Compress & Optimize** | Reduces file size using lossless or balanced downsampling. | Light / Balanced / Strong |
| **Protect Document** | Adds AES-256 password encryption to lock file. | Password |
| **Unlock Document** | Decrypts and saves an unprotected PDF copy. | Current password |

---

### 📝 2. Word & Documents Studio
| Operation | Description |
|---|---|
| **Word (.docx) to PDF** | Converts `.docx` files to PDF with tables, styles, and image support. |
| **Text / Markdown to PDF** | Converts `.txt`, `.md`, `.log`, `.csv` into clean paginated PDFs. |
| **Scratchpad Notes to PDF** | Type or paste notes and export formatted PDFs with headers. |

---

### 🖼️ 3. Image Studio
| Operation | Description | Options |
|---|---|---|
| **Combine into PDF** | Binds selected images into a multi-page PDF document. | Fit to Image, Standard A4 |
| **Batch Format & Resize** | Converts between PNG, JPG, and WEBP with downscaling. | Format, Scale (25-100%), Quality |

---

## 🚀 Building & Installing Standalone APK

### Local Android Build
From the `mobile` folder, run:
```bash
npx expo prebuild --platform android
cd android
./gradlew assembleRelease
```
The resulting standalone APK will be generated at:
`android/app/build/outputs/apk/release/app-release.apk`
Transfer this `.apk` to your phone and install it directly!
