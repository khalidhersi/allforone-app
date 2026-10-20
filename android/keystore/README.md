# Test signing key

Signs the APKs built on GitHub so each new version installs over the old one.

- It's kept in this private repo for convenience. Don't make the repo public.
- For the Play Store, turn on Play App Signing. Google then signs the app with its own key, and this one only uploads.
- To move it out of the repo later: add `ANDROID_KEYSTORE_B64` (base64 of the .jks) and `ANDROID_KEYSTORE_PASSWORD` as GitHub Actions secrets, then delete this folder.
