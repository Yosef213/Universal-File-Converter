#!/usr/bin/env pythonw
"""
Universal File Converter - GUI Launcher (No Console)
Double-clicking this file on Windows launches the app directly via pythonw
without displaying any command prompt or terminal window.
"""

import os
import sys

# Ensure current directory is in path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from main import main

if __name__ == "__main__":
    main()
