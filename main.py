"""
Universal File Converter
========================

A modern, high-performance desktop tool for converting and editing PDFs,
Word documents, images, and text files.

Features
--------
* Modern Fluent / Linear-inspired UI with adaptive Light & Dark themes
* Windows 11/10 immersive dark title bar integration
* Drag & drop files or full folders (via tkinterdnd2)
* Batch processing with live progress, ETA, and cancellation
* PDF Studio: Word (.docx), Excel (.xlsx), text (.txt), PNG, JPG, merge,
  split, extract pages, rotate, compress/optimize, password protect & unlock
* Word to PDF via Microsoft Word with headless LibreOffice fallback
* Image Studio: image-to-PDF, multi-image combine, format conversion & resize
* Text to PDF with automatic word wrap, page numbering, and Unicode fonts
* Smart collision detection, activity terminal drawer, and settings persistence
"""

from __future__ import annotations

import functools
import importlib
import io
import json
import locale
import logging
import os
import queue
import re
import shutil
import subprocess
import sys
import tempfile
import threading
import time
import tkinter as tk
import traceback
from dataclasses import dataclass
from pathlib import Path
from tkinter import filedialog, messagebox

import customtkinter as ctk

# GUI launches (pythonw.exe) have no console; prevent crashes if libraries write to stdout/stderr
if sys.stdout is None:
    sys.stdout = open(os.devnull, "w", encoding="utf-8")
if sys.stderr is None:
    sys.stderr = open(os.devnull, "w", encoding="utf-8")

try:
    from tkinterdnd2 import DND_FILES, TkinterDnD
    DND_AVAILABLE = True
except Exception:
    DND_AVAILABLE = False


# Set explicit AppUserModelID on Windows so the taskbar displays our custom icon
if sys.platform.startswith("win"):
    try:
        import ctypes
        ctypes.windll.shell32.SetCurrentProcessExplicitAppUserModelID("universal.file.converter.desktop.pro")
    except Exception:
        pass

APP_NAME = "Universal File Converter"
APP_VERSION = "2.2 Pro"
SETTINGS_PATH = Path.home() / ".universal_file_converter.json"

# --------------------------------------------------------------------------
# Modern Design Tokens & Color Palette (Light, Dark)
# --------------------------------------------------------------------------
THEME_BG = ("#F8FAFC", "#0B0F19")          # Deep canvas slate
SURFACE_BG = ("#FFFFFF", "#111827")        # Elevated card surface
SURFACE_CARD = ("#F1F5F9", "#172033")      # Inner card / row surface
SURFACE_HOVER = ("#E2E8F0", "#1F2B42")     # Hover state
BORDER_COLOR = ("#E2E8F0", "#1F293D")      # Subtle clean borders
BORDER_STRONG = ("#CBD5E1", "#2E3B55")

TEXT_PRIMARY = ("#0F172A", "#F8FAFC")
TEXT_MUTED = ("#64748B", "#94A3B8")
TEXT_DIM = ("#94A3B8", "#64748B")

ACCENT_PRIMARY = ("#4F46E5", "#6366F1")    # Modern Indigo
ACCENT_HOVER = ("#4338CA", "#4F46E5")
ACCENT_TEXT = "#FFFFFF"

COLOR_SUCCESS = ("#059669", "#10B981")    # Emerald
COLOR_WARN = ("#D97706", "#F59E0B")       # Amber
COLOR_DANGER = ("#DC2626", "#EF4444")     # Rose / Red
COLOR_DANGER_HOVER = ("#B91C1C", "#DC2626")

DROP_ACTIVE_BG = ("#EEF2FF", "#182038")    # Glow effect during drag-over
DROP_ACTIVE_BORDER = ("#6366F1", "#818CF8")

CATEGORY_COLORS = {
    "pdf": ("#DC2626", "#EF4444"),         # Red
    "word": ("#2563EB", "#3B82F6"),        # Blue
    "image": ("#059669", "#10B981"),       # Emerald
    "text": ("#7C3AED", "#8B5CF6"),        # Violet
}
CATEGORY_NAMES = {"pdf": "PDF", "word": "Word", "image": "Image", "text": "Text"}
CATEGORY_BADGES = {"pdf": "PDF", "word": "DOC", "image": "IMG", "text": "TXT"}

CATEGORIES: dict[str, set[str]] = {
    "pdf": {".pdf"},
    "word": {".docx", ".doc", ".rtf", ".odt"},
    "image": {".png", ".jpg", ".jpeg", ".bmp", ".webp", ".gif", ".tif", ".tiff"},
    "text": {".txt", ".md", ".log", ".csv"},
}
SUPPORTED_EXTS = set().union(*CATEGORIES.values())
MAX_VISIBLE_ROWS = 200


def category_of(path: Path) -> str | None:
    ext = path.suffix.lower()
    for cat, exts in CATEGORIES.items():
        if ext in exts:
            return cat
    return None


def apply_windows_theme(window, is_dark: bool) -> None:
    """Make the native Windows 10/11 title bar dark or light to match the app theme."""
    if not sys.platform.startswith("win"):
        return
    try:
        import ctypes
        hwnd = ctypes.windll.user32.GetParent(window.winfo_id()) or window.winfo_id()
        val = ctypes.c_int(1 if is_dark else 0)
        # DWMWA_USE_IMMERSIVE_DARK_MODE (20 for Win11 / modern Win10, 19 for older Win10)
        ctypes.windll.dwmapi.DwmSetWindowAttribute(hwnd, 20, ctypes.byref(val), ctypes.sizeof(val))
    except Exception:
        pass


# --------------------------------------------------------------------------
# Operations Registry
# --------------------------------------------------------------------------
@dataclass(frozen=True)
class Operation:
    key: str
    label: str
    category: str
    description: str
    icon: str = "✦"
    options: tuple[str, ...] = ()
    combine: bool = False
    min_files: int = 1


OPERATIONS: list[Operation] = [
    Operation("pdf_to_docx", "Convert to Word (.docx)", "pdf",
              "Converts each PDF into an editable Word document with preserved layout.",
              icon="📄", options=("pages",)),
    Operation("pdf_to_xlsx", "Extract Tables to Excel (.xlsx)", "pdf",
              "Detects tables on each page and exports them to structured Excel worksheets.",
              icon="📊", options=("pages",)),
    Operation("pdf_to_txt", "Extract Text (.txt)", "pdf",
              "Extracts all selectable text while maintaining page headings.",
              icon="📑", options=("pages",)),
    Operation("pdf_to_png", "Render to PNG Images", "pdf",
              "Renders high-definition, lossless PNG images from PDF pages.",
              icon="🖼️", options=("pages", "dpi")),
    Operation("pdf_to_jpg", "Render to JPG Images", "pdf",
              "Converts pages to compact JPG images with adjustable compression quality.",
              icon="🖼️", options=("pages", "dpi", "quality")),
    Operation("pdf_merge", "Merge Multiple PDFs into One", "pdf",
              "Merges all queued PDFs into a single continuous document in the specified order.",
              icon="🔗", options=("output_name",), combine=True, min_files=2),
    Operation("pdf_split", "Split into Single Pages", "pdf",
              "Splits each page (or specified range) into an individual standalone PDF file.",
              icon="✂️", options=("pages",)),
    Operation("pdf_extract", "Extract Specific Pages", "pdf",
              "Creates a new PDF containing only selected pages in your specified sequence.",
              icon="📑", options=("pages_required",)),
    Operation("pdf_rotate", "Rotate Document Pages", "pdf",
              "Permanently rotates all or selected pages clockwise or counter-clockwise.",
              icon="🔄", options=("rotation", "pages")),
    Operation("pdf_compress", "Compress & Optimize Size", "pdf",
              "Shrinks PDF file size by downsampling images and cleaning metadata structures.",
              icon="🗜️", options=("compress_level",)),
    Operation("pdf_protect", "Encrypt with Password", "pdf",
              "Secures the PDF using military-grade AES-256 encryption.",
              icon="🔒", options=("new_password",)),
    Operation("pdf_unlock", "Remove Password Protection", "pdf",
              "Removes encryption and exports an unprotected PDF copy using the current password.",
              icon="🔓", options=("password",)),
    Operation("word_to_pdf", "Convert to PDF", "word",
              "Generates high-fidelity PDF documents using Word or LibreOffice headless engine.",
              icon="📄"),
    Operation("img_to_pdf", "Convert Each Image to PDF", "image",
              "Converts each individual image into a crisp standalone PDF.",
              icon="📄", options=("page_size",)),
    Operation("img_combine", "Combine Images into One PDF", "image",
              "Binds all queued images together into a single multi-page PDF book.",
              icon="📚", options=("page_size", "output_name"), combine=True),
    Operation("img_convert", "Convert Format & Resize", "image",
              "Batch converts image formats (PNG, JPG, WEBP, BMP) with resolution scaling.",
              icon="🪄", options=("image_format", "quality", "scale")),
    Operation("txt_to_pdf", "Convert to Formatted PDF", "text",
              "Formats plain text or Markdown into a clean PDF with word wrap and page numbering.",
              icon="📄", options=("font", "font_size")),
]
OPS_BY_KEY = {op.key: op for op in OPERATIONS}
DEFAULT_OUTPUT_NAMES = {"pdf_merge": "merged_document", "img_combine": "combined_album"}

DPI_CHOICES = ("72", "150", "200", "300", "600")
ROTATIONS = {"90° Clockwise": 90, "180° Upside Down": 180, "90° Counter-CW": 270}
COMPRESS_LEVELS = {"Light (lossless)": None, "Balanced (150 DPI)": (150, 75), "Strong (96 DPI)": (96, 55)}
PAGE_SIZE_CHOICES = ("Fit to Image", "A4 Document", "US Letter")
PAGE_SIZES_PT = {"A4 Document": (595.28, 841.89), "US Letter": (612.0, 792.0)}
IMAGE_FORMATS = {"PNG": ("PNG", ".png"), "JPG": ("JPEG", ".jpg"), "WEBP": ("WEBP", ".webp"), "BMP": ("BMP", ".bmp")}
SCALE_CHOICES = ("100%", "75%", "50%", "25%")
FONT_CHOICES = ("Sans-serif", "Serif", "Monospace")
FONT_SIZE_CHOICES = ("9", "10", "11", "12", "14")
APPEARANCES = ("System", "Light", "Dark")

PERSISTED_OPTIONS = ("dpi", "quality", "rotation", "compress_level", "page_size",
                     "image_format", "scale", "font", "font_size")


# --------------------------------------------------------------------------
# Helper Functions
# --------------------------------------------------------------------------
class CancelledError(Exception):
    """Raised inside a worker when user clicks cancel."""


class MissingDependency(RuntimeError):
    def __init__(self, package: str, pip_name: str):
        super().__init__(f"This operation requires \u201c{package}\u201d.\n"
                         f"Install it via:  pip install {pip_name}")


def require(module_name: str, pip_name: str | None = None):
    try:
        return importlib.import_module(module_name)
    except ImportError as exc:
        raise MissingDependency(module_name, pip_name or module_name) from exc


def import_pymupdf():
    try:
        import pymupdf
        return pymupdf
    except ImportError:
        try:
            import fitz
            return fitz
        except ImportError as exc:
            raise MissingDependency("PyMuPDF", "pymupdf") from exc


def human_size(num: float) -> str:
    for unit in ("B", "KB", "MB", "GB"):
        if num < 1024 or unit == "GB":
            return f"{num:.0f} {unit}" if unit == "B" else f"{num:.1f} {unit}"
        num /= 1024
    return f"{num:.1f} GB"


def shorten(text: str, max_len: int) -> str:
    if len(text) <= max_len:
        return text
    tail = max(4, (max_len - 1) // 3)
    head = max_len - 1 - tail
    return text[:head] + "\u2026" + text[-tail:]


def natural_key(path: Path):
    parts = re.split(r"(\d+)", path.name, flags=re.ASCII)
    return [int(p) if i % 2 else p.lower() for i, p in enumerate(parts)]


def safe_filename(name: str) -> str:
    return re.sub(r'[<>:"/\\|?*\x00-\x1f]', "_", name).strip(" .")


def unique_path(path: Path) -> Path:
    if not path.exists():
        return path
    stem, suffix = path.stem, path.suffix
    n = 1
    while True:
        candidate = path.with_name(f"{stem} ({n}){suffix}")
        if not candidate.exists():
            return candidate
        n += 1


def norm_key(path: Path) -> str:
    try:
        return os.path.normcase(str(path.resolve()))
    except OSError:
        return os.path.normcase(str(path.absolute()))


def open_in_file_manager(path: Path) -> None:
    if sys.platform.startswith("win"):
        os.startfile(str(path))  # type: ignore[attr-defined]
    elif sys.platform == "darwin":
        subprocess.Popen(["open", str(path)])
    else:
        subprocess.Popen(["xdg-open", str(path)])


def choice(value, allowed, default):
    return value if value in allowed else default


def parse_page_spec(spec: str, page_count: int | None) -> list[int]:
    spec = spec.strip()
    if not spec:
        return list(range(page_count)) if page_count is not None else []
    indices: list[int] = []
    for raw in re.split(r"[,;]", spec):
        token = raw.strip()
        if not token:
            continue
        match = re.fullmatch(r"(\d*)\s*-\s*(\d*)", token, flags=re.ASCII)
        if match:
            first, last = match.groups()
            if not first and not last:
                raise ValueError(f"\u201c{token}\u201d is not a valid page range.")
            start = int(first) if first else 1
            end = int(last) if last else (page_count if page_count is not None else start)
        elif re.fullmatch(r"\d+", token, flags=re.ASCII):
            start = end = int(token)
        else:
            raise ValueError(f"\u201c{token}\u201d is not valid. Use format: 1-3, 5, 8-")
        if start < 1 or end < 1:
            raise ValueError("Page numbers must be 1 or greater.")
        if page_count is not None:
            for number in (start, end):
                if number > page_count:
                    raise ValueError(f"Page {number} exceeds total pages ({page_count}).")
        step = 1 if end >= start else -1
        indices.extend(range(start - 1, end - 1 + step, step))
    seen: set[int] = set()
    unique = [i for i in indices if not (i in seen or seen.add(i))]
    if page_count is not None and not unique:
        raise ValueError("No pages were selected.")
    return unique


def load_settings() -> dict:
    try:
        data = json.loads(SETTINGS_PATH.read_text(encoding="utf-8"))
        return data if isinstance(data, dict) else {}
    except (OSError, ValueError):
        return {}


def save_settings(data: dict) -> None:
    try:
        SETTINGS_PATH.write_text(json.dumps(data, indent=2), encoding="utf-8")
    except OSError:
        pass


def friendly_error(exc: BaseException) -> str:
    if isinstance(exc, PermissionError):
        name = f" \u201c{exc.filename}\u201d" if exc.filename else ""
        return f"File is in use{name}. Please close it in other apps and retry."
    if isinstance(exc, FileNotFoundError):
        return f"File not found: {exc.filename or exc}"
    if isinstance(exc, MemoryError):
        return "Out of memory. Try lower DPI or fewer pages at a time."
    message = str(exc).strip()
    return message or type(exc).__name__


# --------------------------------------------------------------------------
# Job Engine & Context (Background Thread Worker)
# --------------------------------------------------------------------------
@dataclass
class Job:
    op: Operation
    files: list[Path]
    options: dict
    output_dir: Path | None
    overwrite: bool


class JobContext:
    def __init__(self, job: Job, events: queue.Queue, cancel: threading.Event):
        self.job = job
        self.events = events
        self.cancel = cancel
        self.file_index = 0
        self.file_count = 1
        self.file_label = ""
        self._inputs = {norm_key(p) for p in job.files}
        self._produced: set[str] = set()
        self._word = None
        self._com_initialized = False

    def log(self, message: str, level: str = "info") -> None:
        self.events.put(("log", message, level))

    def check_cancel(self) -> None:
        if self.cancel.is_set():
            raise CancelledError()

    def set_file(self, index: int, count: int, label: str = "") -> None:
        self.file_index, self.file_count, self.file_label = index, count, label

    def progress(self, fraction: float, detail: str | None = None) -> None:
        fraction = max(0.0, min(1.0, fraction))
        overall = (self.file_index + fraction) / max(1, self.file_count)
        parts = [p for p in (self.file_label, detail) if p]
        self.events.put(("progress", overall, " \u2014 ".join(parts) if parts else None))

    def output_folder(self, src: Path) -> Path:
        folder = self.job.output_dir or src.parent
        folder.mkdir(parents=True, exist_ok=True)
        return folder

    def _claim(self, path: Path) -> Path:
        key = norm_key(path)
        if key in self._inputs or key in self._produced or (path.exists() and not self.job.overwrite):
            path = unique_path(path)
            while norm_key(path) in self._produced:
                path = unique_path(path.with_name(path.stem + "_" + path.suffix))
        self._produced.add(norm_key(path))
        return path

    def output_file(self, src: Path, filename: str) -> Path:
        return self._claim(self.output_folder(src) / filename)

    def output_subfolder(self, src: Path, name: str) -> Path:
        folder = self._claim(self.output_folder(src) / name)
        folder.mkdir(parents=True, exist_ok=True)
        return folder

    def word(self):
        if self._word is None:
            pythoncom = require("pythoncom", "pywin32")
            win32_client = require("win32com.client", "pywin32")
            pythoncom.CoInitialize()
            self._com_initialized = True
            word = win32_client.DispatchEx("Word.Application")
            word.Visible = False
            word.DisplayAlerts = 0
            try:
                word.AutomationSecurity = 3
            except Exception:
                pass
            self._word = word
        return self._word

    def close(self) -> None:
        if self._word is not None:
            try:
                self._word.Quit(0)
            except Exception:
                pass
            self._word = None
        if self._com_initialized:
            try:
                import pythoncom
                pythoncom.CoUninitialize()
            except Exception:
                pass
            self._com_initialized = False


def open_pdf(path: Path, password: str | None = None):
    pymupdf = import_pymupdf()
    doc = pymupdf.open(str(path))
    if doc.needs_pass:
        if password and doc.authenticate(password):
            return doc
        doc.close()
        if password:
            raise ValueError("Incorrect password for protected PDF.")
        raise ValueError("PDF is password-protected. Unlock it first.")
    return doc


def save_pdf(doc, path: Path, **extra) -> None:
    doc.save(str(path), garbage=3, deflate=True, **extra)


# --------------------------------------------------------------------------
# Operation Handlers
# --------------------------------------------------------------------------
def op_pdf_to_docx(src: Path, ctx: JobContext, opts: dict) -> list[Path]:
    doc = open_pdf(src)
    page_count = doc.page_count
    doc.close()
    indices = parse_page_spec(opts["pages"], page_count)
    converter_mod = require("pdf2docx")
    logging.getLogger().setLevel(logging.WARNING)
    out = ctx.output_file(src, src.stem + ".docx")
    ctx.progress(0.05, "Analyzing document layout\u2026")
    converter = converter_mod.Converter(str(src))
    try:
        if opts["pages"].strip():
            converter.convert(str(out), pages=indices)
        else:
            converter.convert(str(out))
    finally:
        converter.close()
    return [out]


def _clean_cell(value, illegal_re):
    if value is None:
        return ""
    text = illegal_re.sub("", str(value)).strip()
    if re.fullmatch(r"-?\d{1,15}", text):
        return int(text)
    if re.fullmatch(r"-?\d{1,15}\.\d+", text):
        return float(text)
    return text


def op_pdf_to_xlsx(src: Path, ctx: JobContext, opts: dict) -> list[Path]:
    open_pdf(src).close()
    pdfplumber = require("pdfplumber")
    openpyxl = require("openpyxl")
    from openpyxl.cell.cell import ILLEGAL_CHARACTERS_RE
    from openpyxl.styles import Font
    from openpyxl.utils import get_column_letter

    workbook = openpyxl.Workbook()
    workbook.remove(workbook.active)
    tables_found = 0
    with pdfplumber.open(str(src)) as pdf:
        indices = parse_page_spec(opts["pages"], len(pdf.pages))
        for n, idx in enumerate(indices, start=1):
            ctx.check_cancel()
            ctx.progress((n - 1) / len(indices), f"Scanning page {idx + 1}/{len(pdf.pages)}")
            tables = [t for t in pdf.pages[idx].extract_tables()
                      if t and any(any(cell not in (None, "") for cell in row) for row in t)]
            if not tables:
                continue
            sheet = workbook.create_sheet(f"Page {idx + 1}")
            for t_index, table in enumerate(tables):
                if t_index:
                    sheet.append([])
                for r_index, row in enumerate(table):
                    sheet.append([_clean_cell(c, ILLEGAL_CHARACTERS_RE) for c in row])
                    if r_index == 0:
                        for cell in sheet[sheet.max_row]:
                            cell.font = Font(bold=True)
                tables_found += 1
            for column in sheet.columns:
                width = max((len(str(c.value)) for c in column if c.value is not None), default=8)
                sheet.column_dimensions[get_column_letter(column[0].column)].width = min(60, width + 2)
    if not tables_found:
        raise ValueError("No tabular data detected in PDF.")
    out = ctx.output_file(src, src.stem + ".xlsx")
    workbook.save(str(out))
    ctx.log(f"   Exported {tables_found} table(s) to Excel", "success")
    return [out]


def op_pdf_to_txt(src: Path, ctx: JobContext, opts: dict) -> list[Path]:
    doc = open_pdf(src)
    try:
        indices = parse_page_spec(opts["pages"], doc.page_count)
        parts, has_text = [], False
        for n, idx in enumerate(indices, start=1):
            ctx.check_cancel()
            text = doc[idx].get_text("text", sort=True).rstrip()
            has_text = has_text or bool(text.strip())
            parts.append(f"===== Page {idx + 1} =====\n{text}\n")
            ctx.progress(n / len(indices), f"Reading page {idx + 1}/{doc.page_count}")
    finally:
        doc.close()
    if not has_text:
        ctx.log("   Notice: No selectable text found (PDF may be scanned image)", "warning")
    out = ctx.output_file(src, src.stem + ".txt")
    out.write_text("\n".join(parts), encoding="utf-8")
    return [out]


def op_pdf_to_images(src: Path, ctx: JobContext, opts: dict, fmt: str) -> list[Path]:
    pymupdf = import_pymupdf()
    image_mod = require("PIL.Image", "pillow")
    dpi = int(opts["dpi"])
    ext = ".jpg" if fmt == "JPEG" else ".png"
    doc = open_pdf(src)
    try:
        indices = parse_page_spec(opts["pages"], doc.page_count)
        if len(indices) == 1:
            suffix = "" if doc.page_count == 1 else f"_page_{indices[0] + 1}"
            targets = [ctx.output_file(src, f"{src.stem}{suffix}{ext}")]
        else:
            folder = ctx.output_subfolder(src, f"{src.stem}_{ext[1:]}")
            digits = len(str(doc.page_count))
            targets = [folder / f"{src.stem}_page_{i + 1:0{digits}d}{ext}" for i in indices]
        matrix = pymupdf.Matrix(dpi / 72, dpi / 72)
        for n, (idx, target) in enumerate(zip(indices, targets), start=1):
            ctx.check_cancel()
            ctx.progress((n - 1) / len(indices), f"Rendering page {idx + 1}/{doc.page_count}")
            pix = doc[idx].get_pixmap(matrix=matrix, alpha=False)
            image = image_mod.frombytes("RGB", (pix.width, pix.height), pix.samples)
            if fmt == "JPEG":
                image.save(target, "JPEG", quality=int(opts["quality"]), optimize=True, dpi=(dpi, dpi))
            else:
                image.save(target, "PNG", dpi=(dpi, dpi))
    finally:
        doc.close()
    if len(targets) > 1:
        ctx.log(f"   Saved {len(targets)} page images to folder \u201c{targets[0].parent.name}\u201d")
    return targets


def op_pdf_merge(files: list[Path], ctx: JobContext, opts: dict) -> list[Path]:
    pymupdf = import_pymupdf()
    name = safe_filename(opts["output_name"]) or DEFAULT_OUTPUT_NAMES["pdf_merge"]
    if not name.lower().endswith(".pdf"):
        name += ".pdf"
    result = pymupdf.open()
    try:
        for n, path in enumerate(files):
            ctx.check_cancel()
            ctx.progress(n / len(files), f"Merging {path.name} ({n + 1}/{len(files)})")
            doc = open_pdf(path)
            try:
                result.insert_pdf(doc)
            finally:
                doc.close()
        ctx.progress(0.95, "Compiling final PDF\u2026")
        out = ctx.output_file(files[0], name)
        save_pdf(result, out)
        ctx.log(f"   Merged {len(files)} files ({result.page_count} total pages)", "success")
    finally:
        result.close()
    return [out]


def op_pdf_split(src: Path, ctx: JobContext, opts: dict) -> list[Path]:
    pymupdf = import_pymupdf()
    doc = open_pdf(src)
    outputs = []
    try:
        indices = parse_page_spec(opts["pages"], doc.page_count)
        folder = ctx.output_subfolder(src, f"{src.stem}_pages")
        digits = len(str(doc.page_count))
        for n, idx in enumerate(indices, start=1):
            ctx.check_cancel()
            ctx.progress((n - 1) / len(indices), f"Splitting page {idx + 1}/{doc.page_count}")
            single = pymupdf.open()
            try:
                single.insert_pdf(doc, from_page=idx, to_page=idx)
                target = folder / f"{src.stem}_page_{idx + 1:0{digits}d}.pdf"
                save_pdf(single, target)
            finally:
                single.close()
            outputs.append(target)
    finally:
        doc.close()
    ctx.log(f"   Split into {len(outputs)} page file(s)", "success")
    return outputs


def op_pdf_extract(src: Path, ctx: JobContext, opts: dict) -> list[Path]:
    pymupdf = import_pymupdf()
    doc = open_pdf(src)
    try:
        indices = parse_page_spec(opts["pages_required"], doc.page_count)
        result = pymupdf.open()
        try:
            for n, idx in enumerate(indices, start=1):
                ctx.check_cancel()
                result.insert_pdf(doc, from_page=idx, to_page=idx)
                ctx.progress(n / len(indices))
            out = ctx.output_file(src, f"{src.stem}_extracted.pdf")
            save_pdf(result, out)
        finally:
            result.close()
    finally:
        doc.close()
    ctx.log(f"   Extracted {len(indices)} page(s)", "success")
    return [out]


def op_pdf_rotate(src: Path, ctx: JobContext, opts: dict) -> list[Path]:
    degrees = ROTATIONS[opts["rotation"]]
    doc = open_pdf(src)
    try:
        indices = parse_page_spec(opts["pages"], doc.page_count)
        for idx in indices:
            page = doc[idx]
            page.set_rotation((page.rotation + degrees) % 360)
        out = ctx.output_file(src, f"{src.stem}_rotated.pdf")
        save_pdf(doc, out)
    finally:
        doc.close()
    return [out]


def op_pdf_compress(src: Path, ctx: JobContext, opts: dict) -> list[Path]:
    level = COMPRESS_LEVELS[opts["compress_level"]]
    before = src.stat().st_size
    doc = open_pdf(src)
    try:
        if level and hasattr(doc, "rewrite_images"):
            target_dpi, quality = level
            ctx.progress(0.15, "Optimizing image compression\u2026")
            try:
                doc.rewrite_images(dpi_threshold=int(target_dpi * 1.2), dpi_target=target_dpi, quality=quality)
            except Exception as exc:
                ctx.log(f"   Notice: Image downsampling skipped: {exc}", "warning")
        ctx.check_cancel()
        ctx.progress(0.7, "Compacting streams\u2026")
        out = ctx.output_file(src, f"{src.stem}_compressed.pdf")
        doc.save(str(out), garbage=4, deflate=True, deflate_images=True, deflate_fonts=True,
                 clean=True, use_objstms=1)
    finally:
        doc.close()
    after = out.stat().st_size
    if after < before:
        saved = 100 * (before - after) / before
        ctx.log(f"   Saved {saved:.1f}% space: {human_size(before)} \u2192 {human_size(after)}", "success")
    else:
        ctx.log(f"   Already highly optimized ({human_size(before)} \u2192 {human_size(after)})", "warning")
    return [out]


def op_pdf_protect(src: Path, ctx: JobContext, opts: dict) -> list[Path]:
    pymupdf = import_pymupdf()
    password = opts["new_password"]
    doc = open_pdf(src)
    try:
        out = ctx.output_file(src, f"{src.stem}_protected.pdf")
        save_pdf(doc, out, encryption=pymupdf.PDF_ENCRYPT_AES_256, owner_pw=password, user_pw=password)
    finally:
        doc.close()
    return [out]


def op_pdf_unlock(src: Path, ctx: JobContext, opts: dict) -> list[Path]:
    pymupdf = import_pymupdf()
    doc = pymupdf.open(str(src))
    try:
        if not doc.needs_pass and not doc.is_encrypted:
            raise ValueError("This PDF is not encrypted or protected.")
        if doc.needs_pass and not doc.authenticate(opts["password"]):
            raise ValueError("Incorrect password provided.")
        out = ctx.output_file(src, f"{src.stem}_unlocked.pdf")
        save_pdf(doc, out, encryption=pymupdf.PDF_ENCRYPT_NONE)
    finally:
        doc.close()
    return [out]


def find_libreoffice() -> str | None:
    for name in ("soffice", "libreoffice"):
        found = shutil.which(name)
        if found:
            return found
    candidates = []
    for env in ("ProgramFiles", "ProgramFiles(x86)"):
        base = os.environ.get(env)
        if base:
            candidates.append(Path(base) / "LibreOffice" / "program" / "soffice.exe")
    candidates.append(Path("/Applications/LibreOffice.app/Contents/MacOS/soffice"))
    for candidate in candidates:
        if candidate.exists():
            return str(candidate)
    return None


def op_word_to_pdf(src: Path, ctx: JobContext, opts: dict) -> list[Path]:
    out = ctx.output_file(src, src.stem + ".pdf")
    errors = []
    if sys.platform.startswith("win"):
        try:
            ctx.progress(0.1, "Invoking Microsoft Word\u2026")
            word = ctx.word()
            document = word.Documents.Open(str(src.resolve()), False, True, False, "")
            try:
                document.ExportAsFixedFormat(str(out.resolve()), 17)  # wdExportFormatPDF
            finally:
                document.Close(0)
            return [out]
        except Exception as exc:
            errors.append(f"Word Engine: {exc}")
    ctx.check_cancel()
    soffice = find_libreoffice()
    if soffice:
        try:
            ctx.progress(0.3, "Converting via LibreOffice\u2026")
            flags = getattr(subprocess, "CREATE_NO_WINDOW", 0)
            with tempfile.TemporaryDirectory() as tmp:
                res = subprocess.run(
                    [soffice, "--headless", "--convert-to", "pdf", "--outdir", tmp, str(src)],
                    capture_output=True, text=True, timeout=300, creationflags=flags,
                )
                prod = Path(tmp) / (src.stem + ".pdf")
                if not prod.exists():
                    raise RuntimeError(res.stderr or res.stdout or "Conversion failed")
                shutil.move(str(prod), str(out))
            return [out]
        except Exception as exc:
            errors.append(f"LibreOffice Engine: {exc}")
    else:
        errors.append("LibreOffice: not installed")
    raise RuntimeError("Could not convert Word file.\n" + "\n".join(errors))


def _image_dpi(image) -> float:
    try:
        dpi = float(image.info.get("dpi", (0, 0))[0])
    except (TypeError, ValueError, IndexError):
        dpi = 0.0
    return dpi if dpi >= 50 else 96.0


def _encode_for_pdf(image) -> bytes:
    buffer = io.BytesIO()
    has_alpha = image.mode in ("RGBA", "LA", "PA") or (image.mode == "P" and "transparency" in image.info)
    if has_alpha:
        image.convert("RGBA").save(buffer, "PNG")
    elif image.mode in ("1", "L", "P"):
        image.convert("L" if image.mode in ("1", "L") else "RGB").save(buffer, "PNG")
    else:
        image.convert("RGB").save(buffer, "JPEG", quality=92)
    return buffer.getvalue()


def _image_pages(path: Path) -> list[tuple[bytes, int, int, float]]:
    image_mod = require("PIL.Image", "pillow")
    from PIL import ImageOps, ImageSequence

    with image_mod.open(path) as image:
        fmt = image.format
        orientation = image.getexif().get(0x0112, 1)
        dpi = _image_dpi(image)
        if fmt in ("JPEG", "PNG") and orientation == 1:
            return [(path.read_bytes(), image.width, image.height, dpi)]
        frames = ImageSequence.Iterator(image) if fmt == "TIFF" else [image]
        pages = []
        for frame in frames:
            upright = ImageOps.exif_transpose(frame)
            pages.append((_encode_for_pdf(upright), upright.width, upright.height, dpi))
        return pages


def _add_image_page(pdf, pymupdf, data: bytes, width: int, height: int, dpi: float, page_size: str):
    if page_size in PAGE_SIZES_PT:
        page_w, page_h = PAGE_SIZES_PT[page_size]
        if width > height:
            page_w, page_h = page_h, page_w
        page = pdf.new_page(width=page_w, height=page_h)
        margin = 28.35
        rect = pymupdf.Rect(margin, margin, page_w - margin, page_h - margin)
    else:
        page_w, page_h = width * 72 / dpi, height * 72 / dpi
        limit = 14400 / max(page_w, page_h)
        if limit < 1:
            page_w, page_h = page_w * limit, page_h * limit
        page = pdf.new_page(width=max(page_w, 3), height=max(page_h, 3))
        rect = page.rect
    page.insert_image(rect, stream=data, keep_proportion=True)


def op_img_to_pdf(src: Path, ctx: JobContext, opts: dict) -> list[Path]:
    pymupdf = import_pymupdf()
    pdf = pymupdf.open()
    try:
        for data, width, height, dpi in _image_pages(src):
            _add_image_page(pdf, pymupdf, data, width, height, dpi, opts["page_size"])
        out = ctx.output_file(src, src.stem + ".pdf")
        save_pdf(pdf, out)
    finally:
        pdf.close()
    return [out]


def op_img_combine(files: list[Path], ctx: JobContext, opts: dict) -> list[Path]:
    pymupdf = import_pymupdf()
    name = safe_filename(opts["output_name"]) or DEFAULT_OUTPUT_NAMES["img_combine"]
    if not name.lower().endswith(".pdf"):
        name += ".pdf"
    pdf = pymupdf.open()
    try:
        for n, path in enumerate(files):
            ctx.check_cancel()
            ctx.progress(n / len(files), f"Adding {path.name} ({n + 1}/{len(files)})")
            for data, width, height, dpi in _image_pages(path):
                _add_image_page(pdf, pymupdf, data, width, height, dpi, opts["page_size"])
        ctx.progress(0.95, "Compiling multi-page PDF\u2026")
        out = ctx.output_file(files[0], name)
        save_pdf(pdf, out)
        ctx.log(f"   Combined {len(files)} images into {pdf.page_count} PDF pages", "success")
    finally:
        pdf.close()
    return [out]


def op_img_convert(src: Path, ctx: JobContext, opts: dict) -> list[Path]:
    image_mod = require("PIL.Image", "pillow")
    from PIL import ImageOps

    pil_format, ext = IMAGE_FORMATS[opts["image_format"]]
    scale = int(opts["scale"].rstrip("%")) / 100
    quality = int(opts["quality"])
    with image_mod.open(src) as original:
        image = ImageOps.exif_transpose(original)
        if scale != 1:
            size = (max(1, round(image.width * scale)), max(1, round(image.height * scale)))
            image = image.resize(size, image_mod.Resampling.LANCZOS)
        save_args: dict = {}
        if pil_format == "JPEG":
            if image.mode in ("RGBA", "LA", "PA") or (image.mode == "P" and "transparency" in image.info):
                rgba = image.convert("RGBA")
                canvas = image_mod.new("RGB", rgba.size, (255, 255, 255))
                canvas.paste(rgba, mask=rgba.getchannel("A"))
                image = canvas
            elif image.mode != "RGB":
                image = image.convert("RGB")
            save_args = {"quality": quality, "optimize": True}
        elif pil_format == "WEBP":
            if image.mode not in ("RGB", "RGBA"):
                has_alpha = image.mode in ("LA", "PA") or "transparency" in image.info
                image = image.convert("RGBA" if has_alpha else "RGB")
            save_args = {"quality": quality, "method": 4}
        elif pil_format == "PNG":
            if image.mode in ("CMYK", "YCbCr", "LAB", "HSV"):
                image = image.convert("RGB")
        out = ctx.output_file(src, src.stem + ext)
        image.save(out, pil_format, **save_args)
    return [out]


def register_font(kind: str) -> str:
    pdfmetrics = require("reportlab.pdfbase.pdfmetrics", "reportlab")
    ttfonts = require("reportlab.pdfbase.ttfonts", "reportlab")
    name = f"UFC-{kind}"
    if name in pdfmetrics.getRegisteredFontNames():
        return name
    font_files = {
        "Sans-serif": ("arial.ttf", "segoeui.ttf", "DejaVuSans.ttf", "LiberationSans-Regular.ttf"),
        "Serif": ("times.ttf", "DejaVuSerif.ttf", "LiberationSerif-Regular.ttf"),
        "Monospace": ("consola.ttf", "cour.ttf", "DejaVuSansMono.ttf", "LiberationMono-Regular.ttf"),
    }
    font_dirs = [Path(os.environ.get("WINDIR", r"C:\Windows")) / "Fonts"]
    local = os.environ.get("LOCALAPPDATA")
    if local:
        font_dirs.append(Path(local) / "Microsoft" / "Windows" / "Fonts")
    for folder in font_dirs:
        for filename in font_files.get(kind, ()):
            path = folder / filename
            if path.exists():
                try:
                    pdfmetrics.registerFont(ttfonts.TTFont(name, str(path)))
                    return name
                except Exception:
                    continue
    return {"Sans-serif": "Helvetica", "Serif": "Times-Roman", "Monospace": "Courier"}.get(kind, "Helvetica")


def op_txt_to_pdf(src: Path, ctx: JobContext, opts: dict) -> list[Path]:
    canvas_mod = require("reportlab.pdfgen.canvas", "reportlab")
    from reportlab.lib.pagesizes import A4
    from reportlab.pdfbase.pdfmetrics import stringWidth

    font = register_font(opts["font"])
    size = float(opts["font_size"])
    leading = size * 1.35
    page_w, page_h = A4
    margin = 56.7
    max_w = page_w - 2 * margin

    raw = src.read_bytes()
    try:
        text = raw.decode("utf-8-sig")
    except UnicodeDecodeError:
        text = raw.decode(locale.getpreferredencoding(False) or "latin-1", errors="replace")
    lines = text.expandtabs(4).splitlines() or [""]

    out = ctx.output_file(src, src.stem + ".pdf")
    pdf = canvas_mod.Canvas(str(out), pagesize=A4)
    page_no = 1

    def footer():
        pdf.setFont(font, 8)
        pdf.setFillGray(0.5)
        pdf.drawCentredString(page_w / 2, margin / 2, str(page_no))
        pdf.setFillGray(0)
        pdf.setFont(font, size)

    pdf.setFont(font, size)
    y = page_h - margin - size
    for line in lines:
        segments = []
        if stringWidth(line, font, size) <= max_w:
            segments = [line]
        else:
            curr = ""
            for tok in re.findall(r"\S+|\s+", line):
                if stringWidth(curr + tok, font, size) <= max_w:
                    curr += tok
                else:
                    if curr.strip():
                        segments.append(curr.rstrip())
                    curr = tok
            if curr.strip():
                segments.append(curr)
        for seg in segments or [""]:
            if y < margin:
                footer()
                pdf.showPage()
                page_no += 1
                pdf.setFont(font, size)
                y = page_h - margin - size
            pdf.drawString(margin, y, seg)
            y -= leading
    footer()
    pdf.save()
    return [out]


HANDLERS = {
    "pdf_to_docx": op_pdf_to_docx,
    "pdf_to_xlsx": op_pdf_to_xlsx,
    "pdf_to_txt": op_pdf_to_txt,
    "pdf_to_png": functools.partial(op_pdf_to_images, fmt="PNG"),
    "pdf_to_jpg": functools.partial(op_pdf_to_images, fmt="JPEG"),
    "pdf_merge": op_pdf_merge,
    "pdf_split": op_pdf_split,
    "pdf_extract": op_pdf_extract,
    "pdf_rotate": op_pdf_rotate,
    "pdf_compress": op_pdf_compress,
    "pdf_protect": op_pdf_protect,
    "pdf_unlock": op_pdf_unlock,
    "word_to_pdf": op_word_to_pdf,
    "img_to_pdf": op_img_to_pdf,
    "img_combine": op_img_combine,
    "img_convert": op_img_convert,
    "txt_to_pdf": op_txt_to_pdf,
}


def run_job(job: Job, events: queue.Queue, cancel: threading.Event) -> None:
    ctx = JobContext(job, events, cancel)
    handler = HANDLERS[job.op.key]
    outputs: list[Path] = []
    failures: list[tuple[str, str]] = []
    cancelled = False
    try:
        if job.op.combine:
            ctx.set_file(0, 1)
            try:
                outputs += handler(job.files, ctx, job.options)
                ctx.log(f"   \u2713 Successfully generated {outputs[0].name}", "success")
            except CancelledError:
                cancelled = True
            except Exception as exc:
                traceback.print_exc()
                failures.append((job.op.label, friendly_error(exc)))
                ctx.log(f"   \u2717 {friendly_error(exc)}", "error")
        else:
            count = len(job.files)
            for i, src in enumerate(job.files):
                if cancel.is_set():
                    cancelled = True
                    break
                ctx.set_file(i, count, f"[{i + 1}/{count}] {src.name}")
                ctx.progress(0)
                ctx.log(f"[{i + 1}/{count}] {src.name}")
                try:
                    produced = handler(src, ctx, job.options)
                    outputs += produced
                    ctx.log(f"   \u2713 Saved {produced[0].name}" if len(produced) == 1 else f"   \u2713 Saved {len(produced)} files", "success")
                except CancelledError:
                    cancelled = True
                    break
                except Exception as exc:
                    traceback.print_exc()
                    failures.append((src.name, friendly_error(exc)))
                    ctx.log(f"   \u2717 {friendly_error(exc)}", "error")
                ctx.progress(1.0)
    finally:
        ctx.close()
        events.put(("done", outputs, failures, cancelled))


# --------------------------------------------------------------------------
# Modern CustomTkinter Application
# --------------------------------------------------------------------------
_APP_BASES = (ctk.CTk, TkinterDnD.DnDWrapper) if DND_AVAILABLE else (ctk.CTk,)


class ConverterApp(*_APP_BASES):
    POLL_MS = 60

    def __init__(self, initial_files: list[str] | None = None):
        self.settings = load_settings()
        self.current_theme = choice(self.settings.get("appearance"), APPEARANCES, "System")
        ctk.set_appearance_mode(self.current_theme)
        ctk.set_default_color_theme("blue")
        super().__init__()

        self.title(f"{APP_NAME} {APP_VERSION}")
        geometry = self.settings.get("geometry", "1160x780")
        self.geometry(geometry if re.fullmatch(r"\d{3,4}x\d{3,4}", str(geometry)) else "1160x780")
        self.minsize(980, 680)

        # State
        self.files: list[Path] = []
        self.busy = False
        self.show_activity_drawer = bool(self.settings.get("show_activity", False))
        self.events: queue.Queue = queue.Queue()
        self.cancel_event = threading.Event()
        self.worker: threading.Thread | None = None
        self.current_job: Job | None = None
        self.current_ops: list[Operation] = []
        self.current_op: Operation | None = None
        self.last_output_folder: Path | None = None
        self.job_started = 0.0
        self.password_entries: list[ctk.CTkEntry] = []

        # Typography
        self.font_brand = ctk.CTkFont(size=18, weight="bold")
        self.font_h2 = ctk.CTkFont(size=15, weight="bold")
        self.font_body = ctk.CTkFont(size=13)
        self.font_small = ctk.CTkFont(size=11)
        self.font_badge = ctk.CTkFont(size=11, weight="bold")
        self.font_mono = ctk.CTkFont(family="Consolas", size=11)

        self._create_variables()
        self._build_modern_ui()
        self._setup_drag_and_drop()
        self._bind_shortcuts()
        self.protocol("WM_DELETE_WINDOW", self._on_close)

        self._files_changed()
        self._log(f"Ready. Supported: {self._supported_summary()}")
        self._apply_icon()
        self._apply_titlebar_theme()

        if initial_files:
            self.add_paths(initial_files)
        self.after(self.POLL_MS, self._poll_events)

    def _apply_icon(self) -> None:
        base_dir = Path(__file__).resolve().parent
        ico_path = base_dir / "assets" / "icon.ico"
        png_path = base_dir / "assets" / "icon.png"
        if ico_path.exists():
            try:
                self.iconbitmap(str(ico_path))
            except Exception:
                pass
        if png_path.exists():
            try:
                from PIL import ImageTk
                img = ImageTk.PhotoImage(file=str(png_path))
                self.iconphoto(True, img)
                self._icon_ref = img
            except Exception:
                pass

    def _apply_titlebar_theme(self) -> None:
        mode = ctk.get_appearance_mode()
        apply_windows_theme(self, mode == "Dark")

    def _create_variables(self) -> None:
        saved = self.settings.get("options", {})
        if not isinstance(saved, dict):
            saved = {}
        try:
            quality = max(40, min(100, int(saved.get("quality", 90))))
        except (TypeError, ValueError):
            quality = 90
        self.opt_vars: dict[str, tk.Variable] = {
            "pages": tk.StringVar(self),
            "pages_required": tk.StringVar(self),
            "dpi": tk.StringVar(self, choice(saved.get("dpi"), DPI_CHOICES, "200")),
            "quality": tk.IntVar(self, quality),
            "output_name": tk.StringVar(self, "merged_document"),
            "rotation": tk.StringVar(self, choice(saved.get("rotation"), ROTATIONS, "90° Clockwise")),
            "compress_level": tk.StringVar(self, choice(saved.get("compress_level"), COMPRESS_LEVELS, "Balanced (150 DPI)")),
            "new_password": tk.StringVar(self),
            "confirm_password": tk.StringVar(self),
            "password": tk.StringVar(self),
            "page_size": tk.StringVar(self, choice(saved.get("page_size"), PAGE_SIZE_CHOICES, "Fit to Image")),
            "image_format": tk.StringVar(self, choice(saved.get("image_format"), IMAGE_FORMATS, "PNG")),
            "scale": tk.StringVar(self, choice(saved.get("scale"), SCALE_CHOICES, "100%")),
            "font": tk.StringVar(self, choice(saved.get("font"), FONT_CHOICES, "Sans-serif")),
            "font_size": tk.StringVar(self, choice(saved.get("font_size"), FONT_SIZE_CHOICES, "11")),
        }
        self.show_password = tk.BooleanVar(self, False)

        out_dir = self.settings.get("output_dir", "")
        self.output_dir = out_dir if isinstance(out_dir, str) and out_dir and os.path.isdir(out_dir) else ""
        mode = choice(self.settings.get("output_mode"), ("same", "custom"), "same")
        self.output_mode = tk.StringVar(self, mode if (mode == "same" or self.output_dir) else "same")
        self.overwrite_var = tk.BooleanVar(self, bool(self.settings.get("overwrite", False)))
        self.open_when_done_var = tk.BooleanVar(self, bool(self.settings.get("open_when_done", True)))
        last_dir = self.settings.get("last_open_dir", "")
        self.last_open_dir = last_dir if isinstance(last_dir, str) and os.path.isdir(last_dir) else str(Path.home())

    def _build_modern_ui(self) -> None:
        self.configure(fg_color=THEME_BG)
        self.grid_columnconfigure(0, weight=1)
        self.grid_rowconfigure(1, weight=1)

        # 1. Top Navbar / Header ----------------------------------------------
        header = ctk.CTkFrame(self, fg_color=SURFACE_BG, corner_radius=0, height=54, border_width=0)
        header.grid(row=0, column=0, sticky="ew", padx=0, pady=0)
        header.grid_columnconfigure(1, weight=1)

        brand_frame = ctk.CTkFrame(header, fg_color="transparent")
        brand_frame.grid(row=0, column=0, sticky="w", padx=(20, 10), pady=10)

        # Brand Badge Icon
        icon_badge = ctk.CTkLabel(brand_frame, text="⚡", font=ctk.CTkFont(size=14, weight="bold"),
                                  fg_color=ACCENT_PRIMARY, text_color="white", width=28, height=28, corner_radius=8)
        icon_badge.grid(row=0, column=0, padx=(0, 10))

        title_label = ctk.CTkLabel(brand_frame, text=APP_NAME, font=self.font_brand, text_color=TEXT_PRIMARY)
        title_label.grid(row=0, column=1, sticky="w")

        v_pill = ctk.CTkLabel(brand_frame, text=f" {APP_VERSION} ", font=ctk.CTkFont(size=10, weight="bold"),
                              fg_color=SURFACE_CARD, text_color=TEXT_MUTED, corner_radius=6)
        v_pill.grid(row=0, column=2, padx=(8, 0))

        # Navbar Controls (Right)
        nav_controls = ctk.CTkFrame(header, fg_color="transparent")
        nav_controls.grid(row=0, column=2, sticky="e", padx=(10, 20), pady=8)

        # Theme Selector Segmented
        ctk.CTkLabel(nav_controls, text="Theme", font=self.font_small, text_color=TEXT_MUTED).grid(row=0, column=0, padx=(0, 6))
        self.theme_segment = ctk.CTkSegmentedButton(
            nav_controls, values=list(APPEARANCES), command=self._change_appearance,
            selected_color=ACCENT_PRIMARY, selected_hover_color=ACCENT_HOVER,
            corner_radius=8, font=self.font_small, height=26, width=170
        )
        self.theme_segment.set(self.current_theme)
        self.theme_segment.grid(row=0, column=1, padx=(0, 12))

        # Activity Drawer Toggle Button
        self.activity_toggle_btn = ctk.CTkButton(
            nav_controls, text="Activity ▾" if self.show_activity_drawer else "Activity ▸",
            width=85, height=26, corner_radius=8, font=self.font_small,
            fg_color=SURFACE_CARD, hover_color=SURFACE_HOVER, text_color=TEXT_PRIMARY,
            command=self.toggle_activity_drawer
        )
        self.activity_toggle_btn.grid(row=0, column=2)

        # 2. Main Workspace Split (Left: File Studio, Right: Config Studio) ----
        body = ctk.CTkFrame(self, fg_color="transparent")
        body.grid(row=1, column=0, sticky="nsew", padx=20, pady=(16, 10))
        body.grid_columnconfigure(0, weight=6, uniform="workspace")
        body.grid_columnconfigure(1, weight=5, uniform="workspace")
        body.grid_rowconfigure(0, weight=1)

        self._build_left_files_panel(body)
        self._build_right_config_panel(body)

        # 3. Bottom Modern Dock (Progress & Action bar) ------------------------
        dock = ctk.CTkFrame(self, fg_color=SURFACE_BG, corner_radius=14, border_width=1,
                            border_color=BORDER_COLOR, height=64)
        dock.grid(row=2, column=0, sticky="ew", padx=20, pady=(0, 10))
        dock.grid_columnconfigure(1, weight=1)

        # Status indicator chip
        status_box = ctk.CTkFrame(dock, fg_color="transparent")
        status_box.grid(row=0, column=0, sticky="w", padx=(18, 10), pady=12)

        self.status_dot = ctk.CTkLabel(status_box, text="●", font=ctk.CTkFont(size=14),
                                       text_color=COLOR_SUCCESS)
        self.status_dot.grid(row=0, column=0, padx=(0, 6))

        self.status_label = ctk.CTkLabel(status_box, text="Ready", font=ctk.CTkFont(size=13, weight="bold"),
                                         text_color=TEXT_PRIMARY)
        self.status_label.grid(row=0, column=1, sticky="w")

        # Sleek progress bar
        self.progress = ctk.CTkProgressBar(dock, mode="determinate", height=8, corner_radius=4,
                                           progress_color=ACCENT_PRIMARY)
        self.progress.grid(row=0, column=1, sticky="ew", padx=14, pady=12)
        self.progress.set(0)

        # Action Buttons Dock
        actions = ctk.CTkFrame(dock, fg_color="transparent")
        actions.grid(row=0, column=2, sticky="e", padx=(10, 16), pady=10)

        self.open_folder_btn = ctk.CTkButton(
            actions, text="Open Folder", width=110, height=36, corner_radius=9,
            fg_color="transparent", border_width=1, border_color=BORDER_STRONG,
            text_color=TEXT_PRIMARY, hover_color=SURFACE_HOVER, state="disabled",
            font=self.font_small, command=self.open_output_folder
        )
        self.open_folder_btn.grid(row=0, column=0, padx=4)

        self.cancel_btn = ctk.CTkButton(
            actions, text="Cancel", width=80, height=36, corner_radius=9,
            fg_color="transparent", border_width=1, border_color=COLOR_DANGER,
            text_color=COLOR_DANGER, hover_color=(COLOR_DANGER[0], "#2D1518"), state="disabled",
            font=self.font_small, command=self.cancel_job
        )
        self.cancel_btn.grid(row=0, column=1, padx=4)

        self.start_btn = ctk.CTkButton(
            actions, text="Start Conversion  \u2794", width=165, height=36, corner_radius=9,
            fg_color=ACCENT_PRIMARY, hover_color=ACCENT_HOVER, text_color=ACCENT_TEXT,
            font=ctk.CTkFont(size=13, weight="bold"), command=self.start_job
        )
        self.start_btn.grid(row=0, column=2, padx=4)

        # 4. Collapsible Activity Terminal Drawer -----------------------------
        self.activity_drawer = ctk.CTkFrame(self, fg_color=SURFACE_BG, corner_radius=12,
                                           border_width=1, border_color=BORDER_COLOR)
        self.activity_drawer.grid_columnconfigure(0, weight=1)

        drawer_top = ctk.CTkFrame(self.activity_drawer, fg_color="transparent")
        drawer_top.grid(row=0, column=0, sticky="ew", padx=16, pady=(10, 4))
        drawer_top.grid_columnconfigure(0, weight=1)

        ctk.CTkLabel(drawer_top, text="Activity Log", font=ctk.CTkFont(size=12, weight="bold"),
                     text_color=TEXT_PRIMARY).grid(row=0, column=0, sticky="w")

        ctk.CTkButton(drawer_top, text="Clear", width=55, height=22, corner_radius=6,
                      font=self.font_small, fg_color=SURFACE_CARD, hover_color=SURFACE_HOVER,
                      text_color=TEXT_MUTED, command=self._clear_log).grid(row=0, column=1, padx=(0, 6))

        ctk.CTkButton(drawer_top, text="\u2715", width=26, height=22, corner_radius=6,
                      font=self.font_small, fg_color=SURFACE_CARD, hover_color=SURFACE_HOVER,
                      text_color=TEXT_MUTED, command=self.toggle_activity_drawer).grid(row=0, column=2)

        self.log_box = ctk.CTkTextbox(
            self.activity_drawer, height=130, wrap="word",
            font=self.font_mono, fg_color=SURFACE_CARD, corner_radius=8
        )
        self.log_box.grid(row=1, column=0, sticky="ew", padx=16, pady=(0, 12))
        self.log_box.tag_config("error", foreground="#EF4444")
        self.log_box.tag_config("warning", foreground="#F59E0B")
        self.log_box.tag_config("success", foreground="#10B981")
        self.log_box.tag_config("time", foreground="#64748B")
        self.log_box.configure(state="disabled")

        if self.show_activity_drawer:
            self.activity_drawer.grid(row=3, column=0, sticky="ew", padx=20, pady=(0, 12))

    def _build_left_files_panel(self, body) -> None:
        card = ctk.CTkFrame(body, fg_color=SURFACE_BG, corner_radius=14, border_width=1, border_color=BORDER_COLOR)
        card.grid(row=0, column=0, sticky="nsew", padx=(0, 8))
        card.grid_columnconfigure(0, weight=1)
        card.grid_rowconfigure(1, weight=1)

        # Panel Header & Toolbar
        top = ctk.CTkFrame(card, fg_color="transparent")
        top.grid(row=0, column=0, sticky="ew", padx=16, pady=(14, 10))
        top.grid_columnconfigure(1, weight=1)

        ctk.CTkLabel(top, text="Files Queue", font=self.font_h2, text_color=TEXT_PRIMARY).grid(row=0, column=0, sticky="w")
        self.count_badge = ctk.CTkLabel(top, text="0 files", font=self.font_small, text_color=TEXT_MUTED)
        self.count_badge.grid(row=0, column=1, sticky="w", padx=10)

        # Actions toolbar
        toolbar = ctk.CTkFrame(top, fg_color="transparent")
        toolbar.grid(row=0, column=2, sticky="e")

        self.add_btn = ctk.CTkButton(
            toolbar, text="+ Files", width=75, height=28, corner_radius=8,
            font=self.font_small, fg_color=ACCENT_PRIMARY, hover_color=ACCENT_HOVER,
            command=self.browse_files
        )
        self.add_btn.grid(row=0, column=0, padx=3)

        self.add_folder_btn = ctk.CTkButton(
            toolbar, text="+ Folder", width=75, height=28, corner_radius=8,
            font=self.font_small, fg_color=SURFACE_CARD, hover_color=SURFACE_HOVER,
            text_color=TEXT_PRIMARY, command=self.browse_folder
        )
        self.add_folder_btn.grid(row=0, column=1, padx=3)

        self.sort_btn = ctk.CTkButton(
            toolbar, text="A \u2192 Z", width=60, height=28, corner_radius=8,
            font=self.font_small, fg_color=SURFACE_CARD, hover_color=SURFACE_HOVER,
            text_color=TEXT_PRIMARY, command=self.sort_files
        )
        self.sort_btn.grid(row=0, column=2, padx=3)

        self.clear_btn = ctk.CTkButton(
            toolbar, text="Clear", width=55, height=28, corner_radius=8,
            font=self.font_small, fg_color=SURFACE_CARD, hover_color=SURFACE_HOVER,
            text_color=TEXT_MUTED, command=self.clear_files
        )
        self.clear_btn.grid(row=0, column=3, padx=(3, 0))

        # Scrollable file list container
        self.file_list_scroll = ctk.CTkScrollableFrame(
            card, fg_color=SURFACE_CARD, corner_radius=10, border_width=1, border_color=BORDER_COLOR
        )
        self.file_list_scroll.grid(row=1, column=0, sticky="nsew", padx=16, pady=(0, 10))
        self.file_list_scroll.grid_columnconfigure(0, weight=1)

        # Footer helper hints
        hints = ctk.CTkFrame(card, fg_color="transparent")
        hints.grid(row=2, column=0, sticky="ew", padx=16, pady=(0, 12))
        hints.grid_columnconfigure(0, weight=1)

        tip_text = "✦ Drag & drop anywhere  \u2022  Ctrl+O to add  \u2022  Ctrl+Enter to run" if DND_AVAILABLE else "✦ Ctrl+O to add  \u2022  Ctrl+Enter to run"
        ctk.CTkLabel(hints, text=tip_text, font=self.font_small, text_color=TEXT_MUTED, anchor="w").grid(row=0, column=0, sticky="w")

    def _build_right_config_panel(self, body) -> None:
        card = ctk.CTkScrollableFrame(body, fg_color=SURFACE_BG, corner_radius=14, border_width=1, border_color=BORDER_COLOR)
        card.grid(row=0, column=1, sticky="nsew", padx=(8, 0))
        card.grid_columnconfigure(0, weight=1)
        self.config_card = card

        # Section 1: Choose Action
        sec1 = ctk.CTkFrame(card, fg_color="transparent")
        sec1.grid(row=0, column=0, sticky="ew", padx=12, pady=(12, 6))
        sec1.grid_columnconfigure(0, weight=1)

        ctk.CTkLabel(sec1, text="1. Operation", font=self.font_h2, text_color=TEXT_PRIMARY).grid(row=0, column=0, sticky="w")

        self.op_menu = ctk.CTkOptionMenu(
            sec1, values=["Add files first"], command=self._on_operation_change,
            height=36, corner_radius=9, dynamic_resizing=False,
            fg_color=SURFACE_CARD, button_color=ACCENT_PRIMARY, button_hover_color=ACCENT_HOVER,
            dropdown_fg_color=SURFACE_BG, dropdown_hover_color=SURFACE_HOVER, dropdown_text_color=TEXT_PRIMARY,
            text_color=TEXT_PRIMARY, font=ctk.CTkFont(size=13, weight="bold")
        )
        self.op_menu.grid(row=1, column=0, sticky="ew", pady=(8, 4))

        # Description Callout Box
        self.desc_callout = ctk.CTkFrame(sec1, fg_color=SURFACE_CARD, corner_radius=8, border_width=1, border_color=BORDER_COLOR)
        self.desc_callout.grid(row=2, column=0, sticky="ew", pady=(4, 0))
        self.desc_callout.grid_columnconfigure(1, weight=1)

        self.desc_icon = ctk.CTkLabel(self.desc_callout, text="ℹ️", font=ctk.CTkFont(size=14))
        self.desc_icon.grid(row=0, column=0, padx=(10, 6), pady=8, sticky="nw")

        self.op_desc = ctk.CTkLabel(
            self.desc_callout, text="Add files on the left to see available operations.",
            font=self.font_small, text_color=TEXT_MUTED, justify="left", anchor="w", wraplength=280
        )
        self.op_desc.grid(row=0, column=1, padx=(0, 10), pady=8, sticky="ew")

        # Section 2: Dynamic Options
        self.sec2_title = ctk.CTkLabel(card, text="2. Configuration", font=self.font_h2, text_color=TEXT_PRIMARY)
        self.sec2_title.grid(row=1, column=0, sticky="w", padx=12, pady=(16, 6))

        self.options_container = ctk.CTkFrame(card, fg_color=SURFACE_CARD, corner_radius=10, border_width=1, border_color=BORDER_COLOR)
        self.options_container.grid(row=2, column=0, sticky="ew", padx=12, pady=(0, 6))
        self.options_container.grid_columnconfigure(1, weight=1)

        # Section 3: Output Destination
        ctk.CTkLabel(card, text="3. Destination", font=self.font_h2, text_color=TEXT_PRIMARY).grid(
            row=3, column=0, sticky="w", padx=12, pady=(16, 6)
        )

        out_box = ctk.CTkFrame(card, fg_color=SURFACE_CARD, corner_radius=10, border_width=1, border_color=BORDER_COLOR)
        out_box.grid(row=4, column=0, sticky="ew", padx=12, pady=(0, 12))
        out_box.grid_columnconfigure(0, weight=1)

        ctk.CTkRadioButton(
            out_box, text="Save in source directory", variable=self.output_mode, value="same",
            command=self._update_output_widgets, font=self.font_body,
            fg_color=ACCENT_PRIMARY, text_color=TEXT_PRIMARY
        ).grid(row=0, column=0, columnspan=2, sticky="w", padx=14, pady=(12, 4))

        ctk.CTkRadioButton(
            out_box, text="Save to custom folder:", variable=self.output_mode, value="custom",
            command=self._on_custom_output_selected, font=self.font_body,
            fg_color=ACCENT_PRIMARY, text_color=TEXT_PRIMARY
        ).grid(row=1, column=0, columnspan=2, sticky="w", padx=14, pady=4)

        custom_row = ctk.CTkFrame(out_box, fg_color="transparent")
        custom_row.grid(row=2, column=0, columnspan=2, sticky="ew", padx=14, pady=(2, 10))
        custom_row.grid_columnconfigure(0, weight=1)

        self.output_dir_label = ctk.CTkLabel(
            custom_row, text="", anchor="w", corner_radius=7,
            fg_color=SURFACE_BG, height=30, font=self.font_small
        )
        self.output_dir_label.grid(row=0, column=0, sticky="ew", padx=(0, 8))

        self.browse_out_btn = ctk.CTkButton(
            custom_row, text="Browse\u2026", width=80, height=30, corner_radius=7,
            font=self.font_small, fg_color=SURFACE_BG, hover_color=SURFACE_HOVER,
            text_color=TEXT_PRIMARY, border_width=1, border_color=BORDER_COLOR,
            command=self.choose_output_dir
        )
        self.browse_out_btn.grid(row=0, column=1)

        # Switches
        ctk.CTkSwitch(
            out_box, text="Overwrite existing files", variable=self.overwrite_var,
            progress_color=ACCENT_PRIMARY, font=self.font_body, text_color=TEXT_PRIMARY
        ).grid(row=3, column=0, columnspan=2, sticky="w", padx=14, pady=6)

        ctk.CTkSwitch(
            out_box, text="Open folder when completed", variable=self.open_when_done_var,
            progress_color=ACCENT_PRIMARY, font=self.font_body, text_color=TEXT_PRIMARY
        ).grid(row=4, column=0, columnspan=2, sticky="w", padx=14, pady=(4, 14))

        self._update_output_widgets()
        card.bind("<Configure>", self._on_config_resize)

    def _setup_drag_and_drop(self) -> None:
        self.dnd_enabled = False
        if not DND_AVAILABLE:
            return
        try:
            self.TkdndVersion = TkinterDnD._require(self)
            self.drop_target_register(DND_FILES)
            self.dnd_bind("<<Drop>>", self._on_drop)
            self.dnd_bind("<<DropEnter>>", self._on_drop_enter)
            self.dnd_bind("<<DropLeave>>", self._on_drop_leave)
            self.dnd_enabled = True
        except Exception:
            self.dnd_enabled = False

    def _bind_shortcuts(self) -> None:
        self.bind("<Control-o>", lambda _e: self.browse_files())
        self.bind("<Control-O>", lambda _e: self.browse_files())
        self.bind("<Control-Return>", lambda _e: self.start_job())
        self.bind("<Escape>", lambda _e: self.cancel_job())

    def _change_appearance(self, mode: str) -> None:
        ctk.set_appearance_mode(mode)
        self.settings["appearance"] = mode
        self.current_theme = mode
        self._apply_titlebar_theme()

    def toggle_activity_drawer(self) -> None:
        self.show_activity_drawer = not self.show_activity_drawer
        if self.show_activity_drawer:
            self.activity_drawer.grid(row=3, column=0, sticky="ew", padx=20, pady=(0, 12))
            self.activity_toggle_btn.configure(text="Activity ▾")
        else:
            self.activity_drawer.grid_forget()
            self.activity_toggle_btn.configure(text="Activity ▸")

    def _on_config_resize(self, event) -> None:
        try:
            self.op_desc.configure(wraplength=max(180, event.width - 60))
        except (tk.TclError, AttributeError):
            pass

    def _supported_summary(self) -> str:
        parts = []
        for cat, exts in CATEGORIES.items():
            parts.append(f"{CATEGORY_NAMES[cat]} ({' '.join(sorted(exts))})")
        return ", ".join(parts)

    # -------------------------------------------------------------------------
    # File Queue Management
    # -------------------------------------------------------------------------
    def browse_files(self) -> None:
        if self.busy:
            return
        patterns = " ".join(f"*{ext}" for ext in sorted(SUPPORTED_EXTS))
        filetypes = [("All Supported Formats", patterns)]
        for cat, exts in CATEGORIES.items():
            filetypes.append((f"{CATEGORY_NAMES[cat]} Files", " ".join(f"*{e}" for e in sorted(exts))))
        filetypes.append(("All Files", "*.*"))
        paths = filedialog.askopenfilenames(parent=self, title="Add Files to Convert",
                                            initialdir=self.last_open_dir, filetypes=filetypes)
        if paths:
            self.last_open_dir = str(Path(paths[0]).parent)
            self.add_paths(paths)

    def browse_folder(self) -> None:
        if self.busy:
            return
        folder = filedialog.askdirectory(parent=self, title="Import Folder of Supported Files",
                                         initialdir=self.last_open_dir)
        if folder:
            self.last_open_dir = folder
            self.add_paths([folder])

    def add_paths(self, paths) -> None:
        if self.busy:
            return
        existing = {norm_key(p) for p in self.files}
        added, duplicates, unsupported = 0, 0, []
        for raw in paths:
            path = Path(raw)
            if path.is_dir():
                try:
                    candidates = sorted((c for c in path.iterdir()
                                         if c.is_file() and c.suffix.lower() in SUPPORTED_EXTS), key=natural_key)
                except OSError as exc:
                    self._log(f"Cannot read directory {path.name}: {exc}", "error")
                    continue
                if not candidates:
                    self._log(f"No supported files found inside \u201c{path.name}\u201d", "warning")
            else:
                candidates = [path]
            for candidate in candidates:
                if not candidate.is_file():
                    continue
                if category_of(candidate) is None:
                    unsupported.append(candidate.name)
                    continue
                key = norm_key(candidate)
                if key in existing:
                    duplicates += 1
                    continue
                existing.add(key)
                self.files.append(candidate)
                added += 1
        if added:
            self._log(f"Imported {added} file(s) into workspace")
        if duplicates:
            self._log(f"Skipped {duplicates} duplicate item(s)", "warning")
        if unsupported:
            names = ", ".join(unsupported[:4]) + (" \u2026" if len(unsupported) > 4 else "")
            self._log(f"Unsupported files ignored: {names}", "warning")
        self._files_changed()

    def remove_file(self, index: int) -> None:
        if not self.busy and 0 <= index < len(self.files):
            del self.files[index]
            self._files_changed()

    def move_file(self, index: int, delta: int) -> None:
        target = index + delta
        if not self.busy and 0 <= index < len(self.files) and 0 <= target < len(self.files):
            self.files[index], self.files[target] = self.files[target], self.files[index]
            self._files_changed()

    def sort_files(self) -> None:
        if not self.busy and self.files:
            self.files.sort(key=natural_key)
            self._files_changed()

    def clear_files(self) -> None:
        if not self.busy and self.files:
            self.files.clear()
            self._files_changed()

    def _files_changed(self) -> None:
        self._render_file_list()
        total = 0
        for path in self.files:
            try:
                total += path.stat().st_size
            except OSError:
                pass
        if self.files:
            self.count_badge.configure(text=f"{len(self.files)} file(s) \u2022 {human_size(total)}")
        else:
            self.count_badge.configure(text="0 files")
        self._update_operations()

    def _render_file_list(self) -> None:
        for child in self.file_list_scroll.winfo_children():
            child.destroy()

        if not self.files:
            # Modern Empty Drop-zone
            empty = ctk.CTkFrame(self.file_list_scroll, fg_color="transparent")
            empty.grid(row=0, column=0, pady=60, sticky="nsew")
            empty.grid_columnconfigure(0, weight=1)

            ctk.CTkLabel(empty, text="📥", font=ctk.CTkFont(size=44)).grid(row=0, column=0, pady=(0, 6))
            ctk.CTkLabel(empty, text="Drag & Drop Files Here", font=ctk.CTkFont(size=18, weight="bold"),
                         text_color=TEXT_PRIMARY).grid(row=1, column=0, pady=(0, 4))
            ctk.CTkLabel(empty, text="or choose files using the buttons above",
                         font=self.font_body, text_color=TEXT_MUTED).grid(row=2, column=0, pady=(0, 16))

            # Supported pills row
            pills = ctk.CTkFrame(empty, fg_color="transparent")
            pills.grid(row=3, column=0)
            for col_idx, (cat, name) in enumerate((("pdf", "PDF"), ("word", "Word"), ("image", "Images"), ("text", "Text"))):
                chip = ctk.CTkLabel(pills, text=f" {name} ", font=ctk.CTkFont(size=11, weight="bold"),
                                    fg_color=SURFACE_BG, text_color=CATEGORY_COLORS[cat][1], corner_radius=6)
                chip.grid(row=0, column=col_idx, padx=4)
            return

        state = "disabled" if self.busy else "normal"
        last = len(self.files) - 1
        for i, path in enumerate(self.files[:MAX_VISIBLE_ROWS]):
            cat = category_of(path) or "text"
            row = ctk.CTkFrame(self.file_list_scroll, fg_color=SURFACE_BG, corner_radius=10,
                               border_width=1, border_color=BORDER_COLOR)
            row.grid(row=i, column=0, sticky="ew", pady=3, padx=(2, 6))
            row.grid_columnconfigure(2, weight=1)

            # Index
            ctk.CTkLabel(row, text=f"{i + 1}", width=24, font=self.font_small, text_color=TEXT_DIM).grid(
                row=0, column=0, rowspan=2, padx=(8, 2)
            )

            # Category badge
            badge_color = CATEGORY_COLORS.get(cat, CATEGORY_COLORS["text"])
            ctk.CTkLabel(row, text=CATEGORY_BADGES[cat], width=40, height=22, corner_radius=6,
                         fg_color=badge_color, text_color="white", font=self.font_badge).grid(
                row=0, column=1, rowspan=2, padx=6, pady=8
            )

            # Title & Meta
            ctk.CTkLabel(row, text=shorten(path.name, 48), font=ctk.CTkFont(size=13, weight="bold"),
                         text_color=TEXT_PRIMARY, anchor="w", height=18).grid(
                row=0, column=2, sticky="ew", pady=(6, 0)
            )

            try:
                meta = f"{human_size(path.stat().st_size)}  \u2022  {shorten(str(path.parent), 46)}"
            except OSError:
                meta = "Missing file!"
            ctk.CTkLabel(row, text=meta, anchor="w", text_color=TEXT_MUTED, font=self.font_small, height=16).grid(
                row=1, column=2, sticky="ew", pady=(0, 6)
            )

            # Action buttons: Up, Down, Remove
            for col, (symbol, cmd, enabled) in enumerate((
                ("\u25b2", lambda i=i: self.move_file(i, -1), i > 0),
                ("\u25bc", lambda i=i: self.move_file(i, 1), i < last),
                ("\u2715", lambda i=i: self.remove_file(i), True)
            ), start=3):
                is_delete = (col == 5)
                hover_col = COLOR_DANGER_HOVER if is_delete else SURFACE_HOVER
                text_col = COLOR_DANGER if is_delete else TEXT_PRIMARY
                btn = ctk.CTkButton(
                    row, text=symbol, width=28, height=26, corner_radius=6,
                    fg_color="transparent", hover_color=hover_col, text_color=text_col,
                    state=state if enabled else "disabled", font=self.font_small, command=cmd
                )
                btn.grid(row=0, column=col, rowspan=2, padx=(0, 8 if is_delete else 2))

        if len(self.files) > MAX_VISIBLE_ROWS:
            ctk.CTkLabel(self.file_list_scroll, text=f"\u2026 and {len(self.files) - MAX_VISIBLE_ROWS} more items",
                         font=self.font_small, text_color=TEXT_MUTED).grid(row=MAX_VISIBLE_ROWS, column=0, pady=8)

    # -------------------------------------------------------------------------
    # Drag & Drop Events
    # -------------------------------------------------------------------------
    def _on_drop(self, event):
        self._on_drop_leave(event)
        try:
            paths = self.tk.splitlist(event.data)
        except tk.TclError:
            paths = [event.data]
        self.add_paths(paths)
        return event.action

    def _on_drop_enter(self, event):
        if not self.busy:
            self.file_list_scroll.configure(fg_color=DROP_ACTIVE_BG, border_color=DROP_ACTIVE_BORDER)
        return event.action

    def _on_drop_leave(self, event):
        self.file_list_scroll.configure(fg_color=SURFACE_CARD, border_color=BORDER_COLOR)
        return event.action

    # -------------------------------------------------------------------------
    # Operation & Options Management
    # -------------------------------------------------------------------------
    def _update_operations(self) -> None:
        categories = {category_of(p) for p in self.files}
        if not categories:
            ops: list[Operation] = []
            message = "Add files on the left to see available operations."
            icon = "ℹ️"
        elif len(categories) > 1:
            ops = []
            kinds = ", ".join(sorted(CATEGORY_NAMES[c] for c in categories if c))
            message = f"Queue contains mixed file types ({kinds}). Please select files of a single format."
            icon = "⚠️"
        else:
            category = next(iter(categories))
            ops = [op for op in OPERATIONS if op.category == category]
            message = ""
            icon = "✦"

        self.current_ops = ops
        if not ops:
            self.op_menu.configure(values=["\u2014"], state="disabled")
            self.op_menu.set("Add files first" if not categories else "Mixed File Types")
            self.current_op = None
            self.desc_icon.configure(text=icon)
            self.op_desc.configure(text=message)
            self._build_options(None)
            self._update_start_state()
            return

        labels = [f"{op.icon}  {op.label}" for op in ops]
        self.op_menu.configure(values=labels, state="disabled" if self.busy else "normal")
        if self.current_op in ops:
            self._update_start_state()
            return

        remembered = self.settings.get("last_ops", {}).get(ops[0].category)
        selected = next((op for op in ops if op.key == remembered), ops[0])
        display_label = f"{selected.icon}  {selected.label}"
        self.op_menu.set(display_label)
        self._on_operation_change(display_label)

    def _on_operation_change(self, display_label: str) -> None:
        op = next((o for o in self.current_ops if f"{o.icon}  {o.label}" == display_label or o.label == display_label), None)
        self.current_op = op
        if op is None:
            return
        self.settings.setdefault("last_ops", {})[op.category] = op.key
        if "output_name" in op.options:
            curr = self.opt_vars["output_name"].get().strip()
            if not curr or curr in DEFAULT_OUTPUT_NAMES.values():
                self.opt_vars["output_name"].set(DEFAULT_OUTPUT_NAMES.get(op.key, "output"))
        self.desc_icon.configure(text=op.icon)
        self.op_desc.configure(text=op.description)
        self._build_options(op)
        self._update_start_state()

    def _build_options(self, op: Operation | None) -> None:
        for child in self.options_container.winfo_children():
            child.destroy()
        self.password_entries = []
        if op is None or not op.options:
            empty = ctk.CTkLabel(self.options_container, text="No extra configuration needed.",
                                 font=self.font_small, text_color=TEXT_MUTED)
            empty.grid(row=0, column=0, columnspan=2, padx=14, pady=16)
            return

        row = 0
        for key in op.options:
            row = self._build_option(key, row)

    def _option_row(self, row: int, label: str, widget, hint: str | None = None) -> int:
        ctk.CTkLabel(self.options_container, text=label, anchor="w", font=self.font_body,
                     text_color=TEXT_PRIMARY, width=90).grid(row=row, column=0, sticky="nw", padx=(14, 8), pady=(12, 0))
        widget.grid(row=row, column=1, sticky="ew", padx=(0, 14), pady=(10, 0))
        if hint:
            hint_lbl = ctk.CTkLabel(self.options_container, text=hint, anchor="w", justify="left",
                                    font=self.font_small, text_color=TEXT_MUTED, wraplength=240)
            hint_lbl.grid(row=row + 1, column=1, sticky="ew", padx=(0, 14), pady=(2, 0))
            return row + 2
        return row + 1

    def _segmented(self, key: str, values) -> ctk.CTkSegmentedButton:
        return ctk.CTkSegmentedButton(
            self.options_container, values=list(values), variable=self.opt_vars[key],
            selected_color=ACCENT_PRIMARY, selected_hover_color=ACCENT_HOVER,
            corner_radius=8, font=self.font_small, height=28
        )

    def _build_option(self, key: str, row: int) -> int:
        f = self.options_container
        v = self.opt_vars
        if key == "pages":
            entry = ctk.CTkEntry(f, textvariable=v["pages"], placeholder_text="e.g. 1-3, 5, 8- (or leave blank for all)",
                                 font=self.font_body, height=30, corner_radius=7)
            return self._option_row(row, "Page Range", entry, "Leave empty for all pages")
        if key == "pages_required":
            entry = ctk.CTkEntry(f, textvariable=v["pages_required"], placeholder_text="e.g. 1-3, 5, 8- (required)",
                                 font=self.font_body, height=30, corner_radius=7)
            return self._option_row(row, "Extract Pages", entry, "Pages will appear in specified order")
        if key == "dpi":
            return self._option_row(row, "Resolution", self._segmented("dpi", DPI_CHOICES), "DPI (300 is ideal for printing)")
        if key == "quality":
            box = ctk.CTkFrame(f, fg_color="transparent")
            box.grid_columnconfigure(0, weight=1)
            val_lbl = ctk.CTkLabel(box, text=f"{v['quality'].get()}%", font=self.font_small, width=38)
            slider = ctk.CTkSlider(box, from_=40, to=100, number_of_steps=60, variable=v["quality"],
                                   progress_color=ACCENT_PRIMARY, button_color=ACCENT_PRIMARY,
                                   command=lambda val: val_lbl.configure(text=f"{int(round(val))}%"))
            slider.grid(row=0, column=0, sticky="ew")
            val_lbl.grid(row=0, column=1, padx=(6, 0))
            return self._option_row(row, "Quality", box, "85% - 95% is optimal")
        if key == "output_name":
            entry = ctk.CTkEntry(f, textvariable=v["output_name"], height=30, corner_radius=7, font=self.font_body)
            return self._option_row(row, "File Name", entry, "Extension .pdf is added automatically")
        if key == "rotation":
            return self._option_row(row, "Orientation", self._segmented("rotation", ROTATIONS))
        if key == "compress_level":
            return self._option_row(row, "Profile", self._segmented("compress_level", COMPRESS_LEVELS),
                                    "Balanced provides best size/quality ratio")
        if key == "new_password":
            p1 = ctk.CTkEntry(f, textvariable=v["new_password"], show="\u2022", height=30, corner_radius=7)
            row = self._option_row(row, "Password", p1)
            p2 = ctk.CTkEntry(f, textvariable=v["confirm_password"], show="\u2022", height=30, corner_radius=7)
            row = self._option_row(row, "Confirm", p2)
            self.password_entries = [p1, p2]
            toggle = ctk.CTkCheckBox(f, text="Show password", variable=self.show_password,
                                     font=self.font_small, command=self._toggle_password)
            return self._option_row(row, "", toggle)
        if key == "password":
            entry = ctk.CTkEntry(f, textvariable=v["password"], show="\u2022", height=30, corner_radius=7)
            self.password_entries = [entry]
            row = self._option_row(row, "Password", entry, "Enter current unlock password")
            toggle = ctk.CTkCheckBox(f, text="Show password", variable=self.show_password,
                                     font=self.font_small, command=self._toggle_password)
            return self._option_row(row, "", toggle)
        if key == "page_size":
            return self._option_row(row, "Page Canvas", self._segmented("page_size", PAGE_SIZE_CHOICES))
        if key == "image_format":
            return self._option_row(row, "Target Format", self._segmented("image_format", IMAGE_FORMATS))
        if key == "scale":
            return self._option_row(row, "Scale Factor", self._segmented("scale", SCALE_CHOICES))
        if key == "font":
            return self._option_row(row, "Font Family", self._segmented("font", FONT_CHOICES))
        if key == "font_size":
            return self._option_row(row, "Font Size", self._segmented("font_size", FONT_SIZE_CHOICES))
        raise KeyError(key)

    def _toggle_password(self) -> None:
        show = "" if self.show_password.get() else "\u2022"
        for entry in self.password_entries:
            entry.configure(show=show)

    # -------------------------------------------------------------------------
    # Destination & Output Management
    # -------------------------------------------------------------------------
    def _on_custom_output_selected(self) -> None:
        if not self.output_dir:
            self.choose_output_dir()
        self._update_output_widgets()

    def choose_output_dir(self) -> None:
        if self.busy:
            return
        folder = filedialog.askdirectory(parent=self, title="Select Output Destination Directory",
                                         initialdir=self.output_dir or self.last_open_dir)
        if folder:
            self.output_dir = folder
            self.output_mode.set("custom")
        elif not self.output_dir:
            self.output_mode.set("same")
        self._update_output_widgets()

    def _update_output_widgets(self) -> None:
        is_custom = (self.output_mode.get() == "custom")
        text = shorten(self.output_dir, 38) if self.output_dir else "Click Browse to select folder"
        self.output_dir_label.configure(
            text=f"  {text}", text_color=TEXT_PRIMARY if is_custom else TEXT_MUTED
        )

    def open_output_folder(self) -> None:
        if self.last_output_folder and self.last_output_folder.exists():
            try:
                open_in_file_manager(self.last_output_folder)
            except OSError as exc:
                messagebox.showerror(APP_NAME, f"Cannot open folder:\n{exc}", parent=self)

    # -------------------------------------------------------------------------
    # Job Control & Execution
    # -------------------------------------------------------------------------
    def _update_start_state(self) -> None:
        op = self.current_op
        ready = not self.busy and op is not None and len(self.files) >= op.min_files
        self.start_btn.configure(state="normal" if ready else "disabled")
        if self.busy:
            return
        if op is not None and len(self.files) < op.min_files:
            self._set_status(f"Requires at least {op.min_files} file(s)", COLOR_WARN)
        elif op is not None:
            self._set_status(f"Ready: {op.label} ({len(self.files)} files)", COLOR_SUCCESS)
        elif self.files:
            self._set_status("Select files of matching category to begin", COLOR_WARN)
        else:
            self._set_status("Ready", COLOR_SUCCESS)

    def _validate(self, op: Operation, opts: dict) -> str | None:
        if len(self.files) < op.min_files:
            return f"\u201c{op.label}\u201d requires at least {op.min_files} file(s)."
        missing = [p.name for p in self.files if not p.is_file()]
        if missing:
            return "Some files are missing from disk:\n" + "\n".join(missing[:8])
        try:
            if "pages" in op.options:
                parse_page_spec(opts["pages"], None)
            if "pages_required" in op.options:
                if not opts["pages_required"].strip():
                    return "Please enter target page numbers (e.g. 1-3, 5)"
                parse_page_spec(opts["pages_required"], None)
        except ValueError as exc:
            return str(exc)
        if "new_password" in op.options:
            if not opts["new_password"]:
                return "Password field cannot be empty."
            if opts["new_password"] != opts["confirm_password"]:
                return "The passwords entered do not match."
        if "password" in op.options and not opts["password"]:
            return "Please provide the document password."
        if self.output_mode.get() == "custom" and not (self.output_dir and os.path.isdir(self.output_dir)):
            return "The selected destination directory does not exist."
        return None

    def start_job(self) -> None:
        if self.busy or self.current_op is None:
            return
        op = self.current_op
        opts = {key: var.get() for key, var in self.opt_vars.items()}
        problem = self._validate(op, opts)
        if problem:
            messagebox.showwarning("Check Settings", problem, parent=self)
            return
        out_dir = Path(self.output_dir) if self.output_mode.get() == "custom" else None
        job = Job(op, list(self.files), opts, out_dir, bool(self.overwrite_var.get()))
        self.current_job = job
        self.cancel_event.clear()
        self.progress.set(0)
        self.job_started = time.monotonic()
        self._set_busy(True)
        self._log(f"\u25b6 Starting: {op.label} on {len(job.files)} file(s)")
        self._set_status("Processing conversions\u2026", ACCENT_PRIMARY)
        self.worker = threading.Thread(target=run_job, args=(job, self.events, self.cancel_event), daemon=True)
        self.worker.start()

    def cancel_job(self) -> None:
        if self.busy and not self.cancel_event.is_set():
            self.cancel_event.set()
            self.cancel_btn.configure(state="disabled", text="Stopping\u2026")
            self._set_status("Cancelling after current task\u2026", COLOR_WARN)

    def _poll_events(self) -> None:
        try:
            while True:
                kind, *payload = self.events.get_nowait()
                if kind == "log":
                    self._log(*payload)
                elif kind == "progress":
                    fraction, text = payload
                    self.progress.set(fraction)
                    if text and not self.cancel_event.is_set():
                        self._set_status(f"{fraction * 100:.0f}% \u2022 {text}", ACCENT_PRIMARY)
                elif kind == "done":
                    self._on_job_done(*payload)
        except queue.Empty:
            pass
        except Exception:
            traceback.print_exc()
        self.after(self.POLL_MS, self._poll_events)

    def _on_job_done(self, outputs: list[Path], failures: list[tuple[str, str]], cancelled: bool) -> None:
        elapsed = time.monotonic() - self.job_started
        job = self.current_job
        self._set_busy(False)
        if outputs and job is not None:
            self.last_output_folder = job.output_dir or outputs[0].parent
            if outputs[0].parent.parent == (job.output_dir or job.files[0].parent):
                self.last_output_folder = outputs[0].parent.parent
            self.open_folder_btn.configure(state="normal")

        if cancelled:
            self.progress.set(0)
            self._set_status(f"Cancelled \u2014 {len(outputs)} file(s) created", COLOR_WARN)
            self._log("Operation cancelled by user.", "warning")
        elif failures:
            ok_count = (len(job.files) - len(failures)) if job and not job.op.combine else 0
            summary = "\n".join(f"\u2022 {name}: {msg}" for name, msg in failures[:6])
            if len(failures) > 6:
                summary += f"\n\u2026 and {len(failures) - 6} more errors (check Activity log)"
            if outputs:
                self._set_status(f"Completed with {len(failures)} error(s)", COLOR_WARN)
                messagebox.showwarning("Completed with Warnings", summary, parent=self)
            else:
                self.progress.set(0)
                self._set_status("Conversion failed", COLOR_DANGER)
                messagebox.showerror("Error", summary, parent=self)
            if not self.show_activity_drawer:
                self.toggle_activity_drawer()
        else:
            self.progress.set(1)
            self._set_status(f"Finished in {elapsed:.1f}s \u2014 {len(outputs)} file(s) generated", COLOR_SUCCESS)
            self._log(f"All tasks completed successfully in {elapsed:.1f}s.", "success")
            if self.open_when_done_var.get() and outputs:
                self.open_output_folder()
        self.cancel_btn.configure(text="Cancel")

    def _set_busy(self, busy: bool) -> None:
        self.busy = busy
        state = "disabled" if busy else "normal"
        for w in (self.add_btn, self.add_folder_btn, self.sort_btn, self.clear_btn, self.browse_out_btn):
            w.configure(state=state)
        self._set_tree_state(self.options_container, state)
        self.op_menu.configure(state="disabled" if busy or not self.current_ops else "normal")
        self.cancel_btn.configure(state="normal" if busy else "disabled")
        self.start_btn.configure(text="Processing\u2026" if busy else "Start Conversion  \u2794")
        self._render_file_list()
        self._update_start_state()

    def _set_tree_state(self, widget, state: str) -> None:
        for child in widget.winfo_children():
            if isinstance(child, (ctk.CTkButton, ctk.CTkEntry, ctk.CTkSegmentedButton, ctk.CTkSlider,
                                  ctk.CTkCheckBox, ctk.CTkRadioButton, ctk.CTkOptionMenu, ctk.CTkSwitch)):
                try:
                    child.configure(state=state)
                except (ValueError, tk.TclError):
                    pass
            elif isinstance(child, ctk.CTkFrame):
                self._set_tree_state(child, state)

    # -------------------------------------------------------------------------
    # Logging & Status
    # -------------------------------------------------------------------------
    def _set_status(self, text: str, color=COLOR_SUCCESS) -> None:
        self.status_label.configure(text=text)
        self.status_dot.configure(text_color=color)

    def _log(self, message: str, level: str = "info") -> None:
        self.log_box.configure(state="normal")
        self.log_box.insert("end", time.strftime("%H:%M:%S  "), "time")
        self.log_box.insert("end", message + "\n", level if level != "info" else None)
        self.log_box.see("end")
        self.log_box.configure(state="disabled")

    def _clear_log(self) -> None:
        self.log_box.configure(state="normal")
        self.log_box.delete("1.0", "end")
        self.log_box.configure(state="disabled")

    # -------------------------------------------------------------------------
    # Lifecycle & Persistence
    # -------------------------------------------------------------------------
    def _collect_settings(self) -> dict:
        data = dict(self.settings)
        data.update({
            "appearance": self.theme_segment.get(),
            "geometry": f"{self.winfo_width()}x{self.winfo_height()}",
            "output_mode": self.output_mode.get(),
            "output_dir": self.output_dir,
            "overwrite": bool(self.overwrite_var.get()),
            "open_when_done": bool(self.open_when_done_var.get()),
            "show_activity": bool(self.show_activity_drawer),
            "last_open_dir": self.last_open_dir,
            "options": {key: self.opt_vars[key].get() for key in PERSISTED_OPTIONS},
        })
        return data

    def _on_close(self) -> None:
        if self.busy:
            if not messagebox.askyesno(APP_NAME, "A conversion task is currently in progress.\nCancel and quit?", parent=self):
                return
            self.cancel_event.set()
            if self.worker is not None:
                self.worker.join(timeout=3)
        save_settings(self._collect_settings())
        self.destroy()


def main() -> None:
    app = ConverterApp(initial_files=sys.argv[1:])
    app.mainloop()


if __name__ == "__main__":
    main()
