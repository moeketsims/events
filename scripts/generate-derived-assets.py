"""Generate derived assets from the official CUT logo files in public/brand/.

Outputs:
  public/icons/          PWA icons (192, 512, maskable 512), apple-touch-icon 180
  public/og-image.png    1200x630 social/preview image
  public/placeholders/   event banner placeholder 1600x600
  supabase/seed/lots/    six 1200x900 branded lot placeholder images for the demo seed

Run: python scripts/generate-derived-assets.py
Requires Pillow. Uses Windows system fonts (Bahnschrift, Segoe UI) with a DejaVu/Arial fallback.
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
BRAND = ROOT / "public" / "brand"
CUT_950 = (0, 23, 56)
CUT_900 = (0, 50, 97)
CUT_100 = (230, 238, 246)
GOLD = (251, 185, 39)
WHITE = (255, 255, 255)
INK_700 = (55, 65, 81)

def font(size, bold=False):
    candidates = [
        "C:/Windows/Fonts/bahnschrift.ttf",
        "C:/Windows/Fonts/seguisb.ttf" if bold else "C:/Windows/Fonts/segoeui.ttf",
        "C:/Windows/Fonts/arialbd.ttf" if bold else "C:/Windows/Fonts/arial.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    ]
    for c in candidates:
        if Path(c).exists():
            f = ImageFont.truetype(c, size)
            if "bahnschrift" in c:
                try: f.set_variation_by_name("SemiBold Condensed" if bold else "Condensed")
                except Exception: pass
            return f
    return ImageFont.load_default()

def fit_logo(path, box_w, box_h):
    im = Image.open(path).convert("RGBA")
    im.thumbnail((box_w, box_h), Image.LANCZOS)
    return im

def plate(size, logo_path, pad_ratio=0.14, radius_ratio=0.18, bg=WHITE):
    """Square white plate with the full logo (symbol + name), respecting the isolation area."""
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(canvas)
    d.rounded_rectangle((0, 0, size - 1, size - 1), radius=int(size * radius_ratio), fill=bg)
    pad = int(size * pad_ratio)
    logo = fit_logo(logo_path, size - 2 * pad, size - 2 * pad)
    canvas.alpha_composite(logo, ((size - logo.width) // 2, (size - logo.height) // 2))
    return canvas

def icons():
    out = ROOT / "public" / "icons"; out.mkdir(parents=True, exist_ok=True)
    v = BRAND / "logo-v-lg.png"
    for s in (192, 512):
        plate(s, v).save(out / f"icon-{s}.png")
    # maskable: no rounded corners, extra safe zone (icon must survive circular masks)
    m = Image.new("RGBA", (512, 512), WHITE)
    logo = fit_logo(v, 340, 340)
    m.alpha_composite(logo, ((512 - logo.width) // 2, (512 - logo.height) // 2))
    m.save(out / "icon-512-maskable.png")
    plate(180, v, radius_ratio=0.0).convert("RGB").save(out / "apple-touch-icon.png")
    print("icons ok")

def og_image():
    W, H = 1200, 630
    im = Image.new("RGB", (W, H), CUT_950)
    d = ImageDraw.Draw(im)
    # watermark
    wm = Image.open(BRAND / "watermark.png").convert("RGBA")
    wm.thumbnail((560, 560))
    alpha = wm.split()[3].point(lambda a: int(a * 0.08))
    wm.putalpha(alpha)
    im.paste(wm, (W - wm.width - 40, (H - wm.height) // 2), wm)
    # logo plate
    p = plate(200, BRAND / "logo-v-lg.png", pad_ratio=0.10, radius_ratio=0.12)
    im.paste(p, (72, 72), p)
    d.text((72, 330), "CUT Events", font=font(96, bold=True), fill=WHITE)
    d.text((72, 440), "Invitations · QR check-in · Live broadcasts · Digital auctions", font=font(34), fill=(168, 192, 218))
    d.rectangle((72, 520, 72 + 160, 526), fill=GOLD)
    d.text((72, 545), "Thinking Beyond", font=font(30), fill=GOLD)
    im.save(ROOT / "public" / "og-image.png", optimize=True)
    print("og-image ok")

def banner_placeholder():
    W, H = 1600, 600
    im = Image.new("RGB", (W, H), CUT_900)
    d = ImageDraw.Draw(im)
    for i in range(0, W, 80):
        d.line((i, 0, i - 300, H), fill=(0, 64, 114), width=2)
    p = plate(180, BRAND / "logo-h-lg.png", pad_ratio=0.10, radius_ratio=0.12)
    im.paste(p, (80, 60), p)
    d.text((80, 300), "Event banner placeholder", font=font(72, bold=True), fill=WHITE)
    d.text((80, 400), "Replace with the event's hero image (1600 × 600, under 400 KB)", font=font(32), fill=(200, 216, 234))
    out = ROOT / "public" / "placeholders"; out.mkdir(parents=True, exist_ok=True)
    im.save(out / "event-banner.jpg", quality=85, optimize=True)
    print("banner ok")

LOTS = [
    (1, "Weekend for two at a Clarens guesthouse"),
    (2, "Signed Cheetahs rugby jersey"),
    (3, "Original artwork by a CUT Design graduate"),
    (4, "Executive braai set"),
    (5, "A year of Hotel School Sunday lunches"),
    (6, "Sponsor a first-year's textbooks"),
]

def lot_placeholders():
    out = ROOT / "supabase" / "seed" / "lots"; out.mkdir(parents=True, exist_ok=True)
    W, H = 1200, 900
    for n, title in LOTS:
        im = Image.new("RGB", (W, H), CUT_100)
        d = ImageDraw.Draw(im)
        d.rectangle((0, 0, W, 14), fill=CUT_900)
        d.rounded_rectangle((80, 80, 320, 200), radius=24, fill=CUT_900)
        d.text((110, 100), f"LOT {n}", font=font(72, bold=True), fill=GOLD)
        d.text((80, 300), title, font=font(64, bold=True), fill=CUT_900)
        d.text((80, 420), "Placeholder image — replace with the donated item's photo", font=font(34), fill=INK_700)
        p = plate(160, BRAND / "logo-h-lg.png", pad_ratio=0.10, radius_ratio=0.12)
        im.paste(p, (W - 160 - 80, H - 160 - 80), p)
        im.save(out / f"lot-{n}.jpg", quality=82, optimize=True)
    print("lot placeholders ok")

if __name__ == "__main__":
    icons(); og_image(); banner_placeholder(); lot_placeholders()
