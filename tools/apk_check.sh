#!/usr/bin/env bash
# Checks the APK's signature and basic details before the emulator test. Starts smoke-report.txt.
set -u
REPORT=smoke-report.txt
BT=$(ls -d "$ANDROID_HOME"/build-tools/* | sort -V | tail -1)
{
  echo "APK checks"
  if "$BT/apksigner" verify --verbose ALL-FOR-ONE.apk > apksigner.txt 2>&1; then
    schemes=$(grep -E "Verified using v[0-9].*: true" apksigner.txt | sed -E 's/Verified using (v[0-9][^ ]*).*/\1/' | tr '\n' ' ')
    echo "- Signature: valid (${schemes})"
  else
    echo "- Signature: INVALID"; head -5 apksigner.txt
  fi
  "$BT/aapt2" dump badging ALL-FOR-ONE.apk > badging.txt 2>/dev/null
  echo "- $(grep -oE "versionCode='[0-9]+'|versionName='[^']+'" badging.txt | tr '\n' ' ')"
  echo "- Works on Android $(grep -oE "minSdkVersion:'[0-9]+'" badging.txt | grep -oE '[0-9]+') (SDK) and newer"
  echo "- Permissions: $(grep -oE "uses-permission: name='android.permission.[A-Z_]+'" badging.txt | sed -E "s/.*android.permission.//; s/'//" | tr '\n' ' ')"
  echo ""
} > "$REPORT"
cat "$REPORT"
