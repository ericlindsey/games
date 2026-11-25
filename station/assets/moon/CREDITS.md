# Moon maps

From the **CGI Moon Kit**, NASA's Scientific Visualization Studio
(https://svs.gsfc.nasa.gov/4720/). Visualizer Ernie Wright (STC), scientist
Noah Petro (NASA/GSFC). Data: LRO LROC WAC colour mosaic (the December 2025
version) and LRO LOLA digital elevation model.

Credit: NASA's Scientific Visualization Studio. NASA imagery and data are not
copyrighted (https://www.nasa.gov/nasa-brand-center/images-and-media/).

Converted with `tools/moon_maps.py` from `lroc_color_16bit_srgb_4k.tif` and
`ldem_16_uint.tif`:

| file | what | size |
|---|---|---|
| moon_color_4k.jpg | colour, 4096×2048, sRGB JPEG q85 (High quality) | 1.4 MB |
| moon_color_2k.jpg | colour, 2048×1024 (Medium and Low) | 0.36 MB |
| moon_height_2k.webp | elevation, 2048×1024, 8 m steps in two bytes, lossless | 1.7 MB |

All are equirectangular, centred on 0° longitude, north up.
