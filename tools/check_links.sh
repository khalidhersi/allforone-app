#!/usr/bin/env bash
# Opens one search link per marketplace (same format the app builds) and records what comes back.
set -u
REPORT=smoke-report.txt
UA='Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36'
check() {
  local name="$1" url="$2" word="$3" code hit
  code=$(curl -sL -m 20 -A "$UA" -H 'Accept-Language: en-GB' -o page.html -w '%{http_code}' "$url" || echo 000)
  if grep -qi "$word" page.html 2>/dev/null; then hit="mentions \"$word\""; else hit="no mention of \"$word\""; fi
  case "$code" in
    200) title=$(tr '\n' ' ' < page.html | grep -oiE '<title[^>]*>[^<]{0,90}' | head -1 | sed -E 's/<title[^>]*>//I; s/&amp;/\&/g; s/ +/ /g')
         echo "- $name: opens (200), $hit, page title: \"${title:-none}\"" ;;
    403|429|503) echo "- $name: blocks automatic checks ($code), check by hand" ;;
    *) echo "- $name: returned $code, check by hand" ;;
  esac
}
{
  echo "Marketplace links"
  check "eBay" "https://www.ebay.co.uk/sch/i.html?_nkw=ps5&_udhi=300&_sop=15&LH_PrefLoc=1" ps5
  check "Facebook" "https://www.facebook.com/marketplace/search/?query=ps5&maxPrice=300&sortBy=price_ascend&exact=false" ps5
  check "Gumtree" "https://www.gumtree.com/search?search_category=all&q=ps5&search_location=uk&max_price=300&sort=price_lowest_first" ps5
  check "Vinted" "https://www.vinted.co.uk/catalog?search_text=ps5&price_to=300&currency=GBP&order=price_low_to_high" ps5
  check "Depop" "https://www.depop.com/search/?q=nike+dunk" dunk
  check "Preloved" "https://www.preloved.co.uk/search?keyword=ps5" ps5
  check "CeX" "https://uk.webuy.com/search?stext=ps5" ps5
  check "Back Market" "https://www.backmarket.co.uk/en-gb/search?q=iphone+13" iphone
  check "AutoTrader" "https://www.autotrader.co.uk/car-search?postcode=LS14AP&radius=25&price-to=5000&sort=price-asc&keywords=fiesta" fiesta
  check "eBay sold prices" "https://www.ebay.co.uk/sch/i.html?_nkw=ps5&LH_Sold=1&LH_Complete=1&_sop=13&LH_PrefLoc=1" ps5
  echo ""
} >> "$REPORT"
rm -f page.html
tail -13 "$REPORT"
