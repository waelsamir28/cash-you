const TIPS = [
  "يمكنك تعليق أي فاتورة بالضغط على Ctrl+D واستكمالها لاحقاً في أي وقت.",
  "يدعم CASH YOU باركود الميزان (EAN-13) وكاميرا الموبايل وقارئ USB.",
  "تعمل قاعدة البيانات المحلية (PGlite) تلقائياً بدون أي تثبيت خارجي.",
  "يمكنك قفل الشاشة مؤقتاً بالضغط على Ctrl+L وفتحها بكلمة المرور.",
  "أرسل الفواتير للعملاء عبر واتساب أو صدّرها كملف PDF بضغطة واحدة.",
  "استخدم Ctrl+K للبحث السريع في أي شاشة أو صنف داخل البرنامج.",
];

let installedExePath = "";
let tipTimer = null;

function setStep(idx) {
  document.querySelectorAll(".pane").forEach((el, i) => el.classList.toggle("active", i === idx));
  document.querySelectorAll(".step").forEach((el, i) => {
    el.classList.toggle("active", i === idx);
    el.classList.toggle("done", i < idx);
  });
}

function startTips() {
  let i = 0;
  const el = document.getElementById("tip-text");
  if (tipTimer) clearInterval(tipTimer);
  tipTimer = setInterval(() => {
    i = (i + 1) % TIPS.length;
    el.textContent = TIPS[i];
  }, 3500);
}

window.addEventListener("DOMContentLoaded", async () => {
  const defaults = await window.installerAPI.getDefaults();
  document.getElementById("install-dir").value = defaults.installDir;
  document.getElementById("ver-badge").textContent = `v${defaults.version}`;

  document.getElementById("btn-min").onclick = () => window.installerAPI.minimize();
  document.getElementById("btn-close").onclick = () => window.installerAPI.close();

  document.getElementById("to-step-1").onclick = () => setStep(1);
  document.getElementById("back-to-0").onclick = () => setStep(0);

  document.getElementById("btn-browse").onclick = async () => {
    const input = document.getElementById("install-dir");
    const picked = await window.installerAPI.browseDir(input.value);
    if (picked) input.value = picked;
  };

  window.installerAPI.onProgress(({ pct, status }) => {
    document.getElementById("progress-fill").style.width = `${pct}%`;
    document.getElementById("progress-pct").textContent = `${pct}%`;
    document.getElementById("status-text").textContent = status;
  });

  document.getElementById("start-install").onclick = async () => {
    setStep(2);
    startTips();
    try {
      const res = await window.installerAPI.runInstall({
        installDir: document.getElementById("install-dir").value,
        desktopShortcut: document.getElementById("opt-desktop").checked,
        startMenuShortcut: document.getElementById("opt-startmenu").checked,
        autoStart: document.getElementById("opt-autostart").checked,
      });
      installedExePath = res.exePath || "";
      if (tipTimer) clearInterval(tipTimer);
      setStep(3);
    } catch (err) {
      if (tipTimer) clearInterval(tipTimer);
      const errEl = document.getElementById("install-error");
      errEl.textContent = err?.message || "حدث خطأ غير متوقع أثناء التثبيت.";
      errEl.classList.remove("hidden");
    }
  };

  document.getElementById("btn-finish").onclick = () => {
    const shouldLaunch = document.getElementById("opt-launch").checked;
    window.installerAPI.launchApp(shouldLaunch ? installedExePath : "");
  };
});
