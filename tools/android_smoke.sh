#!/usr/bin/env bash
# Runs on the Android emulator in GitHub Actions. Adds to smoke-report.txt:
# start time, idle CPU, memory, crashes (old vs new), updating over the old version, and the back button.
set -u
PKG=com.allforone.app
REPORT=smoke-report.txt

measure() {
  local apk="$1" label="$2"
  adb uninstall "$PKG" >/dev/null 2>&1 || true
  if ! adb install -r "$apk" >/dev/null 2>&1; then echo "- $label: could not install" >> "$REPORT"; return 1; fi
  adb logcat -c
  local start
  start=$(adb shell am start -W -n "$PKG/.MainActivity" | tr -d '\r' | awk -F': ' '/TotalTime/{print $2}')
  sleep 25   # let it settle on the first screen
  local app_pid
  app_pid=$(adb shell pidof "$PKG" | tr -d '\r')
  if [ -z "$app_pid" ]; then
    echo "- $label: the app closed by itself (crash)" >> "$REPORT"
    adb logcat -d | grep -E "FATAL|AndroidRuntime" | head -20 >> "$REPORT"
    return 1
  fi
  # The app process plus the web view's renderer process
  local pids="$app_pid $(adb shell ps -A -o PID,NAME | tr -d '\r' | awk '/sandboxed_process/ {print $1}')"
  ticks() { local t=0 v p; for p in $pids; do v=$(adb shell cat /proc/$p/stat 2>/dev/null | tr -d '\r' | awk '{print $14+$15}'); t=$((t + ${v:-0})); done; echo "$t"; }
  local t0 t1 cpu mem=0 m p crashes size
  t0=$(ticks); sleep 30; t1=$(ticks)
  cpu=$(awk -v a="$t0" -v b="$t1" 'BEGIN{printf "%.2f", (b-a)/100/30*100}')
  for p in $pids; do m=$(adb shell dumpsys meminfo "$p" | tr -d '\r' | awk '/TOTAL PSS:/{print $3; exit}'); mem=$((mem + ${m:-0})); done
  crashes=$(adb logcat -d | grep -cE "FATAL EXCEPTION")
  size=$(stat -c %s "$apk")
  echo "- $label: APK $((size / 1024)) KB, opens in ${start:-?} ms, idle CPU ${cpu}% of one core, memory $((mem / 1024)) MB, crashes $crashes" >> "$REPORT"
  [ "$crashes" = "0" ]
}

echo "Emulator test (Android 14)" >> "$REPORT"
update_note="- Updating over the old version: no old version to test"
if [ -f prev/ALL-FOR-ONE.apk ]; then
  measure prev/ALL-FOR-ONE.apk "Old build" || true
  # The old build is still installed: install the new one straight over it, like a phone update
  if out=$(adb install -r ALL-FOR-ONE.apk 2>&1); then
    update_note="- Updating over the old version: works, no uninstall needed"
  else
    reason=$(echo "$out" | grep -oE 'INSTALL_FAILED_[A-Z_]+' | head -1)
    update_note="- Updating over the old version: needs uninstall first (${reason:-failed})"
  fi
fi
measure ALL-FOR-ONE.apk "This build"
status=$?
echo "$update_note" >> "$REPORT"

# Back button on the first screen should tuck the app away, not crash it
adb shell input keyevent 4; sleep 3
resumed=$(adb shell dumpsys activity activities | tr -d '\r' | grep -m1 -E "mResumedActivity|topResumedActivity")
if [ -n "$(adb shell pidof $PKG | tr -d '\r')" ] && ! echo "$resumed" | grep -q "$PKG"; then
  echo "- Back button on the first screen: puts the app in the background (no crash)" >> "$REPORT"
else
  echo "- Back button on the first screen: unexpected (${resumed:-no info})" >> "$REPORT"
fi
adb shell am start -n "$PKG/.MainActivity" >/dev/null 2>&1; sleep 3
adb exec-out screencap -p > smoke-screen.png
echo "" >> "$REPORT"
echo "Idle CPU is measured over 30 seconds on the first screen." >> "$REPORT"
cat "$REPORT"
exit $status
