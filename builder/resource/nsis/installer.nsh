!macro customInstall
  !ifdef CHANNEL
    FileOpen $0 "$INSTDIR\channel.txt" "w"
    FileWrite $0 "${CHANNEL}"
    FileClose $0
  !endif
!macroend