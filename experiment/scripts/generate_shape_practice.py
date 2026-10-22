"""Generate 61 antialiased square-to-circle tutorial PNGs (requires Pillow)."""
from pathlib import Path
from PIL import Image, ImageDraw

output = Path(__file__).resolve().parents[1] / "stimuli/examples/square_to_circle"
output.mkdir(parents=True, exist_ok=True)
for frame in range(61):
    image = Image.new("RGBA", (1024, 1024), (255, 255, 255, 0))
    draw = ImageDraw.Draw(image)
    draw.rounded_rectangle((192, 192, 832, 832), radius=320 * frame / 60, fill=(128, 128, 128, 255))
    image.resize((512, 512), Image.Resampling.LANCZOS).save(output / f"{frame}.png")
print(f"Saved 61 shape frames to {output}")
