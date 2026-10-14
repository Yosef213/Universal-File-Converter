"""
Build Standalone Windows Executable (.exe)
===========================================
Runs PyInstaller with full assets, custom icon, and windowless GUI flags.

Usage:
    python build_exe.py

The standalone executable will be output to:
    dist/UniversalFileConverter.exe
"""

import os
import shutil
import subprocess
import sys
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
ICON_PATH = BASE_DIR / "assets" / "icon.ico"
MAIN_SCRIPT = BASE_DIR / "main.py"


def build():
    print("=" * 60)
    print("Building Universal File Converter Standalone Executable (.exe)")
    print("=" * 60)

    # PyInstaller command arguments
    cmd = [
        sys.executable, "-m", "PyInstaller",
        "--noconsole",                                # Windowed GUI mode (no cmd window)
        "--onefile",                                  # Single standalone executable
        "--name=UniversalFileConverter",
        f"--icon={ICON_PATH}",                        # Windows application icon
        f"--add-data={BASE_DIR / 'assets'}{os.pathsep}assets",  # Include asset files
        "--collect-all=customtkinter",               # Package CustomTkinter themes & assets
        "--collect-all=tkinterdnd2",                 # Package Drag & Drop binaries
        "--clean",
        str(MAIN_SCRIPT)
    ]

    print("Running:", " ".join(cmd))
    res = subprocess.run(cmd, cwd=str(BASE_DIR))
    if res.returncode == 0:
        exe_path = BASE_DIR / "dist" / "UniversalFileConverter.exe"
        print("\n" + "=" * 60)
        print(f"SUCCESS: Executable created at:\n{exe_path}")
        print("=" * 60)
    else:
        print("\nBuild failed with exit code:", res.returncode)


if __name__ == "__main__":
    build()
