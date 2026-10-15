# ⚡ Universal File Converter 

<div align="center">

![Application Icon](assets/icon.png)

**A modern, private, and high-performance desktop tool for converting and manipulating PDFs, Word documents, images, and text files.**

[![Python](https://img.shields.io/badge/Python-3.10%2B-blue?style=for-the-badge&logo=python)](https://python.org)
[![CustomTkinter](https://img.shields.io/badge/GUI-CustomTkinter-6366F1?style=for-the-badge)](https://github.com/TomSchimansky/CustomTkinter)
[![License: MIT](https://img.shields.io/badge/License-MIT-emerald?style=for-the-badge)](LICENSE)
[![Platform](https://img.shields.io/badge/Desktop-Windows%20%7C%20macOS%20%7C%20Linux-black?style=for-the-badge)](https://github.com)
[![Mobile](https://img.shields.io/badge/Mobile-iOS%20%7C%20Android-000000?style=for-the-badge&logo=expo&logoColor=white)](mobile)

</div>

---

## 🌟 Key Highlights

- 🔒 **100% Private & Offline**: No cloud servers, no file size limits, and no subscriptions. All document processing stays completely local on your device.
- 🎨 **Modern Fluent / Linear UI**: Adaptive Light & Dark themes, Windows 11 immersive dark title bar integration, and clean typography.
- 📥 **Drag & Drop Workspace**: Drop single files or entire directory trees directly into the window.
- ⚡ **Batch Processing & Reordering**: Queue multiple documents, reorder items for merging or combining, and sort alphabetically with a click.
- 🛡️ **Zero Console Window**: Launches seamlessly without opening command prompt windows via `UniversalConverter.pyw` or the native desktop shortcut.
- 📊 **Real-time Live Engine**: Deterministic progress reporting, non-blocking cancellation, activity log drawer, and automatic collision protection.

---

## 🛠️ Supported Operations

### 📄 PDF Studio
| Operation | Description | Options |
|---|---|---|
| **Convert to Word** | Turns PDF pages into editable `.docx` documents. | Page range |
| **Extract to Excel** | Automatically detects tables and exports each page to `.xlsx` sheets. | Page range |
| **Extract Text** | Extracts all selectable text into clean `.txt` format. | Page range |
| **Render to PNG / JPG** | Converts pages to high-resolution images. | Page range, DPI (72-600), Quality |
| **Merge PDFs** | Joins multiple PDFs in queue order into a single unified document. | Output file name |
| **Split Pages** | Splits each document page into individual PDF files. | Page range |
| **Extract Pages** | Extracts custom page sequences (e.g. `1-3, 5, 8-`). | Custom page spec |
| **Rotate Pages** | Rotates orientation (90° CW, 180°, 90° CCW). | Angle, page range |
| **Compress & Optimize** | Downsamples images and strips redundant streams for smaller size. | Light / Balanced / Strong |
| **Encrypt & Protect** | Adds password encryption using AES-256 standard. | Password |
| **Remove Password** | Decrypts and saves an unprotected PDF copy. | Current password |

### 📝 Word Documents
| Operation | Description |
|---|---|
| **Convert to PDF** | Converts `.docx`, `.doc`, `.rtf`, `.odt` to PDF using native Microsoft Word automation with automatic headless LibreOffice fallback. |

### 🖼️ Image Studio
| Operation | Description | Options |
|---|---|---|
| **Image to PDF** | Converts individual images to standalone PDF pages. | Fit to Image, A4, US Letter |
| **Combine into PDF** | Binds all queued images into a multi-page PDF document. | Page layout, output name |
| **Batch Format & Resize** | Converts between PNG, JPG, WEBP, and BMP with downscaling options (25% to 100%). | Target format, quality, scale |

### 📑 Plain Text & Markdown
| Operation | Description | Options |
|---|---|---|
| **Text to PDF** | Renders `.txt`, `.md`, `.log`, `.csv` into clean PDFs with automatic word-wrapping, page numbers, and Unicode system fonts. | Font family, font size |

---

## 🚀 Quick Start

### 1. Requirements & Installation
Ensure you have Python 3.10 or higher installed. Clone this repository and install dependencies:

```bash
git clone https://github.com/Yosef213/Universal-File-Converter.git
cd Universal-File-Converter
pip install -r requirements.txt
```

### 2. Launching the Application
- **Option A (No Console / Direct GUI)**: Double-click **`UniversalConverter.pyw`** or **`Launch.vbs`**.
- **Option B (Desktop Shortcut)**: Run `python create_shortcut.py` once to place a shortcut on your Desktop with the custom icon.
- **Option C (Terminal)**:
  ```bash
  python main.py
  ```

---

## 📦 Building Standalone Windows Executable (.exe)

You can compile a single standalone `.exe` that runs on any Windows machine without requiring Python:

```bash
pip install pyinstaller
python build_exe.py
```

The resulting executable will be saved in `dist/UniversalFileConverter.exe` with:
- Windowed mode (`--noconsole`) — no terminal popup.
- Embedded multi-resolution application icon.
- Bundled UI themes and drag & drop libraries.

---

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `Ctrl + O` | Browse and add files |
| `Ctrl + Enter` | Start conversion |
| `Escape` | Cancel active operation |

---

---

## 📱 Mobile Application (iOS & Android)

A complete companion mobile application is located in the [`mobile/`](mobile/) folder. It runs **100% on-device** with zero cloud servers or subscriptions, maintaining total privacy for all document and image operations.

### Quick Start (Live on Physical Phone via Expo Go)

1. Install **Expo Go** on your [iPhone / iPad](https://apps.apple.com/app/expo-go/id982107779) or [Android](https://play.google.com/store/apps/details?id=host.exp.exponent).
2. Start the dev server:
   ```bash
   cd mobile
   npx expo start
   ```
3. Scan the generated QR code with your iPhone Camera or Android Expo Go app to launch and test immediately!

For full mobile documentation, feature list, and standalone APK/IPA compilation, see [`mobile/README.md`](mobile/README.md).

---

## 🏗️ Architecture

```
Universal-File-Converter/
├── assets/                  # High-res logos and application icons
├── mobile/                  # Native iOS & Android React Native (Expo) app
│   ├── src/
│   │   ├── components/      # UI components (Header, FileList, etc.)
│   │   ├── screens/         # Studios (PDF, Image, Text, History)
│   │   ├── services/        # 100% offline engines (pdf-lib, image)
│   │   └── theme/           # Fluent dark palette
│   ├── App.tsx              # Mobile root container & bottom navigation
│   └── package.json         # Mobile dependencies
├── main.py                  # Desktop application engine & CustomTkinter UI
├── UniversalConverter.pyw   # Windowless Python entrypoint (no cmd)
├── Launch.vbs               # Silent VBS launcher
├── create_shortcut.py       # Desktop shortcut installer script
├── build_exe.py             # PyInstaller executable builder
├── requirements.txt         # Python dependencies
├── .gitignore               # Git exclude rules
├── LICENSE                  # MIT License
└── README.md                # Documentation
```

### Core Design Principles
- **Privacy First**: Neither the desktop nor mobile application ever upload documents or images to the cloud. All computation is strictly on-device.
- **Thread Safety**: UI interactions and background worker operations are decoupled through thread-safe channels.
- **Fail-Safe Output**: Auto-incrementing naming ensures no file is accidentally overwritten unless explicitly enabled.

---

## 📄 License

Distributed under the **MIT License**. See [`LICENSE`](LICENSE) for details.
