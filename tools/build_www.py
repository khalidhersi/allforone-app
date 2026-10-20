"""Build www/index.html (the Android app + installable web app) from the app page.

Usage: python3 tools/build_www.py path/to/app-page.html
"""
import re, sys

src = open(sys.argv[1], encoding='utf-8').read()
head = '''<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#F6F7F9">
<meta name="description" content="One search across eBay, Vinted, Facebook Marketplace, Gumtree and more.">
<link rel="manifest" href="manifest.webmanifest">
<link rel="icon" href="icons/icon-192.png">
<link rel="apple-touch-icon" href="icons/icon-192.png">
<link rel="preload" href="fonts/manrope.woff2" as="font" type="font/woff2" crossorigin>
<style>
@font-face{font-family:"Manrope";font-style:normal;font-weight:200 800;font-display:swap;src:url(fonts/manrope.woff2) format("woff2")}
:root{color-scheme:light;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}
body{margin:0;font:14px system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
img{max-width:100%}
[hidden]{display:none!important}
</style>
</head>
<body>
'''
tail = '''
<script>
(function () {
  var isNative = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
  if (isNative) {
    // Open marketplace links in the phone's browser (or the site's own app) instead of inside this app
    document.addEventListener('click', function (e) {
      var a = e.target.closest && e.target.closest('a[href^="http"]');
      if (!a) return;
      e.preventDefault();
      window.location.href = a.href;
    }, true);
  } else if ('serviceWorker' in navigator && location.protocol === 'https:') {
    window.addEventListener('load', function () { navigator.serviceWorker.register('sw.js').catch(function () {}); });
  }
})();
</script>
</body>
</html>
'''
# The font ships inside the app, so drop the Google Fonts download (saves a network trip on every launch)
src = re.sub(r'<link rel="preconnect"[^>]*>\n?', '', src)
src = re.sub(r'<link rel="stylesheet" href="https://fonts.googleapis.com[^>]*>\n?', '', src)
out = head + src.rstrip('\n') + '\n' + tail
# Safe edges: also honour the inset values Capacitor injects on Android
out = re.sub(r'env\(safe-area-inset-(top|bottom|left|right),\s*0px\)', r'max(env(safe-area-inset-\1,0px),var(--safe-area-inset-\1,0px))', out)
open('www/index.html', 'w', encoding='utf-8').write(out)
print('built www/index.html', len(out), 'bytes')
