from PIL import Image, ImageDraw, ImageFont
import os

def main():
   # size of image
   width = 320
   height = 15

   backgroundcolor = (225,225,225,255)
   color = (0,0,0,255)
   text = "TOKEN funscript - No Mapping, Data, or Duration Available"

   # init canvas
   im = Image.new('RGBA', (width, height), backgroundcolor)
   draw = ImageDraw.Draw(im)
   font_path = os.path.join(os.path.dirname(__file__), "voltergoldfish.ttf")
   font = ImageFont.truetype(font_path, 9)

   if text != "":
      # Position (x, y) in pixels from top-left corner
      x, y = 10, 3
      bbox = draw.textbbox((x, y), text, font=font)  # (left, top, right, bottom)
      draw.rectangle(bbox, fill=backgroundcolor)
      draw.text((x, y), text, font=font, fill=color)

   # save image
   im.save(f"./{text}.png")

main()
