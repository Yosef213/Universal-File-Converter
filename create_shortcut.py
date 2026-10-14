"""
Creates a Windows Desktop Shortcut for Universal File Converter
with the custom application icon and pythonw windowless launcher.
"""

import os
import sys
from pathlib import Path


def create_shortcut():
    base_dir = Path(__file__).resolve().parent
    icon_path = base_dir / "assets" / "icon.ico"
    target_script = base_dir / "UniversalConverter.pyw"

    # Find pythonw.exe
    python_dir = Path(sys.executable).parent
    pythonw = python_dir / "pythonw.exe"
    if not pythonw.exists():
        pythonw = Path(sys.executable)

    # Windows Script Host
    import win32com.client
    shell = win32com.client.Dispatch("WScript.Shell")
    desktop = shell.SpecialFolders("Desktop")
    shortcut_path = os.path.join(desktop, "Universal File Converter.lnk")

    shortcut = shell.CreateShortCut(shortcut_path)
    shortcut.TargetPath = str(pythonw)
    shortcut.Arguments = f'"{target_script}"'
    shortcut.WorkingDirectory = str(base_dir)
    if icon_path.exists():
        shortcut.IconLocation = f"{icon_path}, 0"
    shortcut.Description = "Universal File Converter - Modern Desktop Tool"
    shortcut.save()
    print(f"Created shortcut at: {shortcut_path}")


if __name__ == "__main__":
    create_shortcut()
