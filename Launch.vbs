' Universal File Converter - Silent Windows Launcher
' Launches the app using pythonw.exe with 0 window style (no console/cmd prompt)
Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
strDir = fso.GetParentFolderName(WScript.ScriptFullName)
strScript = chr(34) & strDir & "\UniversalConverter.pyw" & chr(34)
WshShell.Run "pythonw.exe " & strScript, 0, False
Set WshShell = Nothing
Set fso = Nothing
