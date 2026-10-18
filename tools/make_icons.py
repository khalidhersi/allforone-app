"""Draw the ALL FOR ONE price-tag icon and splash screens for Android."""
import glob, os
from PIL import Image, ImageDraw, ImageFont

BLUE = (29, 91, 242, 255)
WHITE = (255, 255, 255, 255)
BG = (246, 247, 249, 255)
INK = (15, 27, 45, 255)
RES = 'android/app/src/main/res'

def tag(draw, cx, cy, w, h, hole_fill):
    notch = h * 0.5
    x0, x1 = cx - w / 2, cx + w / 2
    y0, y1 = cy - h / 2, cy + h / 2
    draw.polygon([(x0 + notch, y0), (x1, y0), (x1, y1), (x0 + notch, y1), (x0, cy)], fill=BLUE)
    r = h * 0.11
    hx = x0 + notch * 0.95
    draw.ellipse([hx - r, cy - r, hx + r, cy + r], fill=hole_fill)

def square_icon(size, round_=False):
    S = 1024
    im = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    if round_:
        d.ellipse([0, 0, S - 1, S - 1], fill=WHITE)
    else:
        d.rounded_rectangle([0, 0, S - 1, S - 1], radius=int(S * 0.22), fill=WHITE)
    tag(d, S / 2, S / 2, S * 0.62, S * 0.40, WHITE)
    return im.resize((size, size), Image.LANCZOS)

def foreground(size):
    S = 1080  # 108dp canvas; keep the tag inside the 66dp safe zone
    im = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    tag(d, S / 2, S / 2, S * 0.46, S * 0.30, WHITE)
    return im.resize((size, size), Image.LANCZOS)

for f in glob.glob(f'{RES}/mipmap-*/ic_launcher.png'):
    n = Image.open(f).size[0]; square_icon(n).save(f)
for f in glob.glob(f'{RES}/mipmap-*/ic_launcher_round.png'):
    n = Image.open(f).size[0]; square_icon(n, round_=True).save(f)
for f in glob.glob(f'{RES}/mipmap-*/ic_launcher_foreground.png'):
    n = Image.open(f).size[0]; foreground(n).save(f)

font_path = next((p for p in ['/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', '/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf'] if os.path.exists(p)), None)
for f in glob.glob(f'{RES}/drawable*/splash.png'):
    w, h = Image.open(f).size
    im = Image.new('RGBA', (w, h), BG)
    d = ImageDraw.Draw(im)
    unit = min(w, h)
    tag(d, w / 2, h / 2 - unit * 0.06, unit * 0.22, unit * 0.14, BG)
    if font_path:
        font = ImageFont.truetype(font_path, max(12, int(unit * 0.065)))
        text = 'ALL FOR ONE'
        tw = d.textlength(text, font=font)
        d.text(((w - tw) / 2, h / 2 + unit * 0.06), text, font=font, fill=INK)
    im.convert('RGB').save(f)
print('icons and splash done; font:', font_path)
