#!/usr/bin/env bash
# Runs on the Android emulator in GitHub Actions.
# Installs each APK, opens it, then measures start time, idle CPU, memory and crashes.
# Compares the previous release (prev/ALL-FOR-ONE.apk, if any) with the new build.
set -u
PKG=com.allforone.app
REPORT=smoke-report.txt
: > "$REPORT"

measure() {
  local apk="$1" label="$2"
  adb uninstall "$PKG" >/dev/null 2>&1 || true
  if ! adb install -r "$apk" >/dev/null 2>&1; then echo "$label: could not install" >> "$REPORT"; return 1; fi
  adb logcat -c
  local start
  start=$(adb shell am start -W -n "$PKG/.MainActivity" | tr -d '\r' | awk -F': ' '/TotalTime/{print $2}')
  sleep 25   # let it settle on the first screen
  local app_pid
  app_pid=$(adb shell pidof "$PKG" | tr -d '\r')
  if [ -z "$app_pid" ]; then
    echo "$label: the app closed by itself (crash)" >> "$REPORT"
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
  echo "$label | APK $((size / 1024)) KB | opens in ${start:-?} ms | idle CPU ${cpu}% of one core | memory $((mem / 1024)) MB | crashes $crashes" >> "$REPORT"
  [ "$crashes" = "0" ]
}

if [ -f prev/ALL-FOR-ONE.apk ]; then measure prev/ALL-FOR-ONE.apk "Before (old build)" || true; fi
measure ALL-FOR-ONE.apk "After (this build)"
status=$?
adb exec-out screencap -p > smoke-screen.png
echo "" >> "$REPORT"
echo "Measured on an Android 14 emulator, sitting on the first screen. Idle CPU is over 30 seconds." >> "$REPORT"
cat "$REPORT"
exit $status
