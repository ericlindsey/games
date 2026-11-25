"""Build the Moon's web maps from NASA SVS's CGI Moon Kit (https://svs.gsfc.nasa.gov/4720/).

    python3 tools/moon_maps.py <dir with the downloads> assets/moon

Needs (pip): numpy, pillow, tifffile, imagecodecs. Inputs, from the kit's page:
    lroc_color_16bit_srgb_4k.tif   LROC WAC colour, 2025 version, sRGB 16-bit
    ldem_16_uint.tif               LOLA elevation, uint16 half-metres above 1727.4 km

Outputs:
    moon_color_4k.jpg, moon_color_2k.jpg   equirectangular, centred on 0° longitude
    moon_height_2k.webp                    2048×1024 lossless; height h (m above 1737.4 km)
        v = round((h + 10000) / 8); R = v >> 8; G = v & 255, mirrored (255 - G) when R is
        odd, so the low byte runs smoothly instead of jumping (compresses better).
Prints the colour map's mean linear luminance, which station/src/sky.js scales to the
Moon's real mean albedo (MOON_MAP_MEAN there).
"""
import sys
import numpy as np
import tifffile
from PIL import Image

src, out = sys.argv[1], sys.argv[2]

c = tifffile.imread(f'{src}/lroc_color_16bit_srgb_4k.tif').astype(np.float32) / 65535.0
lin = np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)
print('colour map mean linear luminance', float((lin @ np.array([0.2126, 0.7152, 0.0722])).mean()))
img = Image.fromarray(np.clip(c * 255 + 0.5, 0, 255).astype(np.uint8))
img.save(f'{out}/moon_color_4k.jpg', quality=85, optimize=True, progressive=True)
img.resize((2048, 1024), Image.LANCZOS).save(f'{out}/moon_color_2k.jpg', quality=85, optimize=True, progressive=True)

h = tifffile.imread(f'{src}/ldem_16_uint.tif').astype(np.float32) * 0.5 - 10000.0     # metres
hf = np.asarray(Image.fromarray(h, mode='F').resize((2048, 1024), Image.LANCZOS))
v = np.clip(np.round((hf + 10000.0) / 8.0), 0, 65535).astype(np.uint16)
hi = (v >> 8).astype(np.uint8)
lo = (v & 255).astype(np.uint8)
lo = np.where(hi & 1, 255 - lo, lo).astype(np.uint8)
rgb = np.zeros((1024, 2048, 3), np.uint8)
rgb[..., 0], rgb[..., 1] = hi, lo
Image.fromarray(rgb).save(f'{out}/moon_height_2k.webp', lossless=True, quality=100, method=6)
print('height range m', float(hf.min()), float(hf.max()))
