# The setup file's additions to electron-builder's NSIS scripts (docs/plan/20 section 4), included by
# electron-builder.config.ts (nsis.include) into the setup file and into its uninstaller.
#
# customUnInstall runs in the uninstaller's section, after xDesign is closed and before its files are
# removed (electron-builder's one-click uninstaller ends with Quit, so nothing of ours can run after
# them). A newer setup file runs the old uninstaller with /S and --updated: then it does nothing. Run by
# hand, it removes the copy of the setup file the installer keeps for electron-updater (xDesign has none),
# and asks whether to remove the data folder too, No by default. The one-click uninstaller turns itself
# silent after its own "Are you sure" question, so the question has no /SD (a silent run would skip it):
# /S on the command line is read here instead, as electron-builder's un.onInit reads it.

!macro customUnInstall
  ${ifNot} ${isUpdated}
    Delete "$LOCALAPPDATA\${APP_INSTALLER_STORE_FILE}"
    ${GetParent} "$LOCALAPPDATA\${APP_INSTALLER_STORE_FILE}" $R0
    RMDir $R0

    ${GetParameters} $R0
    ClearErrors
    ${GetOptions} $R0 "/S" $R1
    ${if} ${Errors}
      MessageBox MB_YESNO|MB_ICONQUESTION|MB_DEFBUTTON2 "Also remove your designs?$\r$\n$\r$\nYes removes the designs, backups and settings in %APPDATA%\xDesign.$\r$\nNo keeps them for the next time you install xDesign." IDNO +2
      RMDir /r "$APPDATA\xDesign"
    ${endIf}
  ${endIf}
!macroend
