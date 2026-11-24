!macro customHeader
  !define MUI_BGCOLOR "111827"
  !define MUI_TEXTCOLOR "E5E7EB"
  !define MUI_INSTFILESPAGE_COLORS "CBD5E1 111827"
  !define MUI_INSTFILESPAGE_PROGRESSBAR "smooth"
  ShowInstDetails show
  ShowUninstDetails show
!macroend

!macro customWelcomePage
  !define MUI_WELCOMEPAGE_TITLE "Welcome to CASH YOU"
  !define MUI_WELCOMEPAGE_TEXT "A modern sales and point-of-sale experience for your business.$\r$\n$\r$\nThe setup wizard will guide you through installing CASH YOU. You can choose where the application is installed."
  !insertmacro MUI_PAGE_WELCOME
!macroend
