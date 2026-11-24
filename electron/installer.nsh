; ============================================================================
;  CASH YOU — مثبت Windows بأسلوب Windows 11 الداكن
;
;  يُضمَّن هذا الملف تلقائياً من electron-builder (nsis.include في package.json)
;  قبل سكربت electron-builder الأصلي، لذا:
;   • تعريفات MUI_BGCOLOR / MUI_TEXTCOLOR هنا تُقرأ بواسطة MUI2 (فهو يستخدم
;     !ifndef ولن يستبدلها).
;   • صور الترويسة واللوحة الجانبية والأيقونة تُعرَّف من إعدادات package.json
;     (installerHeader / installerSidebar / uninstallerSidebar / installerIcon)
;     ولا يجوز تكرارها هنا لأن electron-builder يعرّفها بنفسه.
;
;  ملاحظة: معالج NSIS لا يدعم تشكيل النصوص العربية داخل صفحاته؛ لذلك تبقى
;  نصوص المعالج إنجليزية قصيرة، بينما التطبيق نفسه عربي كامل RTL.
; ============================================================================

; ---------- هوية الإصدار ----------
!define CY_APP_NAME "CASH YOU"
!define CY_APP_TAGLINE "Arabic POS & Sales System"

; ---------- ألوان Windows 11 Dark ----------
; تُطبَّق على خلفيات صفحات MUI القياسية (الترحيب، النهاية، شريط التقدم).
!define MUI_BGCOLOR "0B1220"                          ; #0B1220 — Ink
!define MUI_TEXTCOLOR "EDF3FF"                        ; #EDF3FF — Text primary
!define MUI_INSTFILESPAGE_COLORS "9AA9C4 0B1220"      ; نص تفاصيل النسخ / الخلفية
!define MUI_INSTFILESPAGE_PROGRESSBAR "smooth"        ; شريط تقدم ناعم كـ Win11

; ---------- ترويسة عامة ----------
!macro customHeader
  ; إظهار تفاصيل الملفات أثناء التثبيت يعطي إحساس لوحة النسخ في Win11.
  ShowInstDetails show
  ShowUninstDetails show
!macroend

; ---------- صفحة الترحيب ----------
!macro customWelcomePage
  !define MUI_WELCOMEPAGE_TITLE "${CY_APP_NAME}"
  !define MUI_WELCOMEPAGE_TEXT "Welcome to CASH YOU — Arabic POS & Sales System.$\r$\n$\r$\nThis wizard installs the CASH YOU desktop app on your computer. You can pick a different install folder next.$\r$\n$\r$\nClick Next to continue."
  !insertmacro MUI_PAGE_WELCOME
!macroend

; ---------- صفحة النهاية ----------
!macro customFinishPage
  !define MUI_FINISHPAGE_TITLE "CASH YOU is ready"
  !define MUI_FINISHPAGE_TEXT "CASH YOU has been installed successfully.$\r$\n$\r$\nA shortcut is on your desktop and in the Start menu. On first launch, enter the activation code provided by technical support."
  !ifndef HIDE_RUN_AFTER_FINISH
    Function CYStartApp
      ${if} ${isUpdated}
        StrCpy $1 "--updated"
      ${else}
        StrCpy $1 ""
      ${endif}
      ${StdUtils.ExecShellAsUser} $0 "$launchLink" "open" "$1"
    FunctionEnd
    !define MUI_FINISHPAGE_RUN
    !define MUI_FINISHPAGE_RUN_FUNCTION "CYStartApp"
    !define MUI_FINISHPAGE_RUN_TEXT "Run CASH YOU now"
  !endif
  !insertmacro MUI_PAGE_FINISH
!macroend

; ---------- صفحة الترحيب عند إلغاء التثبيت ----------
!macro customUnWelcomePage
  !define MUI_WELCOMEPAGE_TITLE "Uninstall CASH YOU"
  !define MUI_WELCOMEPAGE_TEXT "This will remove CASH YOU from your computer.$\r$\n$\r$\nYour saved business data is not deleted. Click Next to continue."
  !insertmacro MUI_UNPAGE_WELCOME
!macroend
