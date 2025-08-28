from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from assets.config import Config

import json
import sys
import os
import re
import shutil
import math
import hashlib
from datetime import timedelta
from PIL import Image, ImageDraw, ImageFont
from typing import Dict, Any

import time
config:'Config'

SCENE_FRAGMENT = """
id
title
interactive_speed
files {
 id
 path
 duration
 fingerprint(type: "oshash")
}
"""

background = (0,0,0,255)
dupebackground = (255,255,255,255)

def dict_hash(dictionary: Dict[str, Any]) -> str:
    """MD5 hash of a dictionary."""
    dhash = hashlib.md5()
    # We need to sort arguments so that
    # {'a': 1, 'b': 2} is the same as
    # {'b': 2, 'a': 1}
    encoded = json.dumps(dictionary, sort_keys=True).encode()
    dhash.update(encoded)
    return dhash.hexdigest()

def lerp(a: int, b: int, t: float):
    """Linear interpolate on the scale given by a to b, using t as the point on that scale.
    """
    return int((1 - t) * a + t * b)

def colorlerp(a, b, t):
    r = lerp(a[0],b[0],t)
    g = lerp(a[1],b[1],t)
    b = lerp(a[2],b[2],t)
    return (r,g,b,255)

def speedtocolor(speed):
    # Match JS palette exactly
    heatmap = [
        [0, 0, 0],
        [30, 144, 255],
        [34, 139, 34],
        [255, 215, 0],
        [220, 20, 60],
        [147, 112, 219],
        [37, 22, 122],
    ]
    stepsize = 120

    # Clamp to black if <= 0
    if speed <= 0:
        return (*heatmap[0], 255)

    # Clamp to final color if > 600
    if speed > 600:
        return (*heatmap[6], 255)

    # JS adds 60 before dividing into bins
    speed += 60

    # Determine indices
    lower_index = int(speed // stepsize)
    upper_index = lower_index + 1
    frac = min(1.0, max(0.0, (speed - lower_index * stepsize) / stepsize))

    # Get the two colors
    c1 = heatmap[lower_index]
    c2 = heatmap[upper_index]

    return colorlerp(c1, c2, frac)

def opposite_color(color):
    if color == (255,0,0,255):
       return (0,0,0,255)
    r, g, b, a = color
    return (255 - r, 255 - g, 255 - b, a)

def ms_to_time(ms: int) -> str:
    td = timedelta(milliseconds=ms)
    total_seconds = int(td.total_seconds())
    hours, remainder = divmod(total_seconds, 3600)
    minutes, seconds = divmod(remainder, 60)
    if hours:
        return f"{hours}:{minutes:02d}:{seconds:02d}"
    return f"{minutes}:{seconds:02d}"

def update_tags(ids, tag_id, mode='ADD'):
    config.log.debug(f'processing: {mode} tag {tag_id} on scene ids: {ids}')
    config.stash.call_GQL("mutation BulkSceneUpdate($input: BulkSceneUpdateInput!) {\n  bulkSceneUpdate(input: $input) { id } } ",{
        'input': {'ids': ids,
                  'tag_ids': {
                      'mode': mode,
                      'ids': [tag_id]
                  }
                 }
    })

def make_heatmap(funscriptpath, heatmappath, sceneduration, text, backgroundcolor=(0,0,0,255), timedisplay=False):
   # read the funscript
   try:
     with open(funscriptpath, 'br') as fun_file:
        fun_data = json.load(fun_file)
   except json.JSONDecodeError as e:
     config.log.error(f"Error: {funscriptpath} file is not valid JSON ({e})")
     shutil.copyfile(os.path.join(os.path.dirname(__file__), "broken.png"), heatmappath)
   except OSError as e:
     config.log.error(f"Error: Could not open {funscriptpath} ({e})")
     shutil.copyfile(os.path.join(os.path.dirname(__file__), "missing.png"), heatmappath)

   action_length = len(fun_data['actions'])
   # log.debug(f"action length = {action_length}")

   script_duration = fun_data['actions'][-1]["at"]
   last_time = script_duration
   if last_time < 0:
         last_time = 60000

   # OPTIONALLY use actual duration of video length to ensure all align
   flagtime = False
   if sceneduration:
      last_time  = sceneduration * 1000
      if (last_time + 10000) < script_duration:
         # hmm, the funscript length is over 10+ secs longer than the video
         flagtime = True

   # size of image
   width = 320
   height = 15

   # init canvas
   im = Image.new('RGBA', (width, height), backgroundcolor)
   draw = ImageDraw.Draw(im)

   font_path = os.path.join(os.path.dirname(__file__), "voltergoldfish.ttf")
   font = ImageFont.truetype(font_path, 9)

   actions = fun_data['actions']

   # scaling factor
   xscale = width / last_time

   speeds, positions = [], []
   m = 0  # previous x pixel

   for i in range(1, len(actions)):
        prev = actions[i - 1]
        curr = actions[i]
        if prev["at"] is None:
           continue
        if prev["pos"] is None:
           continue
        if curr["at"] is None:
           curr['at'] = prev["at"]
        if curr["pos"] is None:
           curr['pos'] = prev["pos"]

        b = int(xscale * curr["at"])  # current x pixel

        # Compute speed
        dt = curr["at"] - prev["at"]
        dp = curr["pos"] - prev["pos"]
        if dt > 0:
            speed = abs(dp) / dt * 1000
            speeds.append(speed)
            if len(speeds) > 50:
                speeds.pop(0)

        # Push positions (limit 15)
        positions.append(curr["pos"])
        if len(positions) > 15:
            positions.pop(0)

        if speeds:
            avg_speed = sum(speeds) / len(speeds)
            color = speedtocolor(avg_speed)
        else:
            color = backgroundcolor

        # Split positions into halves
        sorted_pos = sorted(positions)
        mid = len(sorted_pos) // 2
        lower = sorted_pos[:mid] or [0]
        upper = sorted_pos[mid:] or [100]

        I = sum(lower) / len(lower)
        j = sum(upper) / len(upper)

        N = height * (I / 100.0)
        R = height * (j / 100.0)

        # Draw rectangle
        draw.rectangle([min(m, b), min(height - N, height - R),
                max(m, b), max(height - N, height - R)], fill=color)

        m = b

   # Text labeling

   if flagtime:
      backgroundcolor = (255,0,0,255)
   if text != "":
      # Position (x, y) in pixels from top-left corner
      x, y = 2, 2
      bbox = draw.textbbox((x, y), text, font=font)  # (left, top, right, bottom)
      draw.rectangle(bbox, fill=backgroundcolor)
      draw.text((x, y), text, font=font, fill=opposite_color(backgroundcolor))

   if timedisplay:
      # Get bounding box of duration
      timetext = ms_to_time(int(script_duration))
      # Create a dummy image just for measurement
      dummy_img = Image.new("RGB", (1, 1))
      dummy_draw = ImageDraw.Draw(dummy_img)
      # Get bounding box
      bbox = dummy_draw.textbbox((0, 0), timetext, font=font)
      text_width = bbox[2] - bbox[0]
      text_height = bbox[3] - bbox[1]
      # Compute correct position (aligned right, 2px margin)
      x = width - text_width - 2
      y = 2
      bbox_at_pos = (x-1, y-1, x + text_width+1, y + text_height+1)
      draw.rectangle(bbox_at_pos, fill=backgroundcolor)
      draw.text((x, y), timetext, font=font, fill=opposite_color(backgroundcolor))

   # save image
   # log.debug(heatmappath)
   im.save(heatmappath)

   return

def remap_scene(scene, funscripts, genpath, remapconfig):
   sceneduration = scene['files'][0]['duration']

   scenehash = scene['files'][0]['fingerprint']
   heatmappath = genpath + "/interactive_heatmaps/" + scenehash + ".png"

   images_list = []
   action_list = []
   funscriptcount = len(funscripts)
   funcount = 0
   sorting_funscripts = {}
   sceneflag = False

   # presort
   for funscript in funscripts:
       funcount += 1
       label = ""
       if os.path.isfile(funscript):
          scenepath = os.path.splitext(os.path.basename(scene['files'][0]['path']))[0]
          funlabel = os.path.splitext(os.path.basename(funscript))[0]

          # due to the way Stash chokes on generating for primary tokens, we'll check contents here...
          # and we can review for length here too
          try:
             with open(funscript, 'br') as fun_file:
                  fun_data = json.load(fun_file)
                  if fun_data['actions'][0]["at"] == 66 and fun_data['actions'][1]["pos"] in [83,84]:
                     label = "ZZtoken"
                     if len(funscripts) > 1 and funlabel.startswith(scenepath) and funlabel[len(scenepath):].strip("() ") == "":
                        config.log.debug(f"{scene['id']} {scene['title']} has a token default funscript")
                        if remapconfig['dupeDisable']:
                           newpath = os.path.splitext(funscript)[0] + " (token).funscript"
                           if not os.path.isfile(newpath):
                              config.log.info(f"renaming {funscript} to {newpath}")
                              os.rename(funscript, newpath)
                              funscripts.append(newpath)
                              sorting_funscripts[str(newpath)] = label
                              if os.path.isfile(newpath) and not os.path.isfile(funscript):
                                 # ok, we moved it, now put a file into it's place as default
                                 config.log.info(f"You'll want to rescan, regenerate and run the remap again")
                                 if funcount == 1:
                                    # copy the next item
                                    config.log.info(f"copying {funscripts[1]} to {funscript}")
                                    shutil.copyfile(funscripts[1], funscript)
                                 else:
                                    # copy the first item
                                    config.log.info(f"copying {funscripts[0]} to {funscript}")
                                    shutil.copyfile(funscripts[0], funscript)
                                 label = "default"
                              else:
                                config.log.error(f"Error: moved funscript to {newpath}, but still at {funscript}")
                                sceneflag = True
                           else:
                              config.log.info(f"Unable to rename dupe {funscript} to {newpath} as it already exists")
                              sceneflag = True
                        else:
                           # no disabling... we can flag it if we have a review tag
                           sceneflag = True
                  else:
                     # Remove scenepath from the start of funlabel
                     label = funlabel[len(scenepath):].strip("() ") if funlabel.startswith(scenepath) else funlabel.strip("() ")
                     if label == "":
                           label = "default"

                     # review for time/length
                     script_duration = fun_data['actions'][-1]["at"]
                     video_time  = sceneduration * 1000
                     if (video_time + 10000) < script_duration:
                        # hmm, the funscript length is more than 10 secs longer than the video (by more than a second)
                        sceneflag = True

          except json.JSONDecodeError as e:
             config.log.error(f"Error: {funscript} file is not valid JSON ({e})")
             label = "ZZbroken"
             sceneflag = True
          except OSError as e:
             config.log.error(f"Error: Could not open {funscript} ({e})")
             label = "ZZmissing"
             sceneflag = True

       else:
           config.log.error(f"Error: File is missing {funscript}")
           label = "ZZmissing"
           sceneflag = True

       sorting_funscripts[str(funscript)] = label

   # Sort filepaths by label, with 'default' first
   funscripts_sorted = sorted(
        funscripts,
        key=lambda fp: (0 if sorting_funscripts[str(fp)] == "default" else 2 if sorting_funscripts[str(fp)] == "ZZtoken" else 1,  sorting_funscripts[str(fp)] )
   )

   funcount = 0
   if not remapconfig['videoLength']:
      sceneduration = 0

   for funscript in funscripts_sorted:
       funcount += 1
       heatmap = f"/tmp/{funcount}-{scenehash}.png"

       if os.path.isfile(funscript):
          try:
            with open(funscript, 'br') as fun_file:
               fun_data = json.load(fun_file)
          except json.JSONDecodeError as e:
             config.log.error(f"Error: {funscript} file is not valid JSON ({e})")
             shutil.copyfile(os.path.join(os.path.dirname(__file__), "broken.png"), heatmap)
             sceneflag = True
             images_list.append(heatmap)
             continue
          except OSError as e:
             config.log.error(f"Error: Could not open {funscript} ({e})")
             shutil.copyfile(os.path.join(os.path.dirname(__file__), "missing.png"), heatmap)
             sceneflag = True
             images_list.append(heatmap)
             continue
       else:
          shutil.copyfile(os.path.join(os.path.dirname(__file__), "missing.png"), heatmap)
          config.log.error(f"MISSING: {funscript}")
          sceneflag = True
          images_list.append(heatmap)
          continue

       fun_actions = dict_hash(fun_data['actions'])
       if fun_actions in action_list:
          # we have seen this before, use dupe background
          backcolor = dupebackground

          # this is where we can flag it as a dupe
          config.log.info(f"{funscript} is a duplicate of one of the other funscripts processed so far")
          if remapconfig['dupeDisable']:
             if not os.path.isfile(str(funscript) + "dupe"):
                config.log.info(f"Renaming {funscript} to {funscript}dupe")
                try:
                   os.rename(funscript, str(funscript) + "dupe")
                   continue
                except OSError as e:
                   config.log.error(f"Unable to rename {funscript} to {funscript}dupe")
                   sceneflag = True
             else:
                config.log.info(f"Cannot rename as another file is already named {funscript}dupe")
                sceneflag = True
          else:
              sceneflag = True
       else:
          action_list.append(fun_actions)
          backcolor = background

       if fun_data['actions'][0]["at"] == 66 and fun_data['actions'][1]["pos"] in [83,84]:
            config.log.debug(f"token: {funscript}")
            # token - add the token graphic instead
            shutil.copyfile(os.path.join(os.path.dirname(__file__), "token.png"), heatmap)
            images_list.append(heatmap)
       else:
         text = "default"
         scenepath = os.path.splitext(os.path.basename(scene['files'][0]['path']))[0]
         funlabel = os.path.splitext(os.path.basename(funscript))[0]
         # Remove scenepath from the start of funlabel
         text = funlabel[len(scenepath):].strip("() ") if funlabel.startswith(scenepath) else funlabel.strip("() ")
         if text == "":
            text = "default"
         if len(funscripts_sorted) == 1:
            text = ""
         if not remapconfig['defaultText']:
            if text == "default":
               text = ""

         timedisplay = False
         if remapconfig['timeText']:
            timedisplay = True

         make_heatmap(funscript, heatmap, sceneduration, text, backcolor, timedisplay)
         images_list.append(heatmap)

   if len(images_list):
      imgs = [Image.open(i) for i in images_list]
      min_img_width = min(i.width for i in imgs)
      total_height = 0
      for i, img in enumerate(imgs):
         # If the image is larger than the minimum width, resize it
         # if img.width > min_img_width:
         #   imgs[i] = img.resize((min_img_width, int(img.height / img.width * min_img_width)), Image.ANTIALIAS)
         total_height += imgs[i].height

      # Now that we know the total height of all of the resized images, we know the height of our final image
      img_merge = Image.new(imgs[0].mode, (min_img_width, total_height))
      y = 0
      for img in imgs:
          img_merge.paste(img, (0, y))
          y += img.height
      img_merge.save(heatmappath)
      config.log.debug(f"{scene['id']} {scene['title']} heatmap created: {heatmappath}")

      # remove the imgs from tmp
      for imagefile in images_list:
          # delete file from tmp
          if os.path.isfile(imagefile):
             os.remove(imagefile)

   if sceneflag and remapconfig['reviewtag']:
      config.log.debug(f"Flagging {scene['title']} for review for funscript issues")
      update_tags([scene['id']], remapconfig['reviewtag'], mode='ADD')

   if remapconfig['replaceZero']:
      if scene['interactive_speed'] is None:
         # catch the odd Nones...
         scene['interactive_speed'] = 0
      if scene['interactive_speed'] <= 0:
         sql = f"UPDATE video_files SET interactive_speed = 1 WHERE interactive = 1 AND file_id = {scene['files'][0]['id']}"
         result = config.stash.sql_query(sql)
         config.log.info(f"SQL updated speed 0 to 1 on {scene['title']} file: {result}")

def remap_scenes():
    page = 1
    total = 100
    seen = 0
    init_task = config.get_task('init')

    fullconfig = config.stash.get_configuration()
    genpath = fullconfig['general']['generatedPath']

    remapc = config.stash.find_plugin_config(config.ID)
    config.log.debug(remapc)
    remapconfig = {}

    remapconfig['dupeDisable'] = remapc.get("remapDisableDuplicates",False)
    remapconfig['defaultText'] = remapc.get("remapDisplayDefaultText",False)
    remapconfig['timeText'] = remapc.get("remapDisplayTime",False)
    remapconfig['videoLength'] = remapc.get("remapMapToVideoLength",False)
    remapconfig['replaceZero'] = remapc.get("remapReplaceZero",False)
    reviewtag = remapc.get("remapReviewTag","")
    if reviewtag:
       reviewtag_id = config.stash.find_tag(reviewtag, create=True).get('id')
       remapconfig['reviewtag'] = reviewtag_id
    else:
       remapconfig['reviewtag'] = False

    while seen < total:
        total, scenes = config.stash.find_scenes({
            'interactive': True
        }, {
            'page': page,
            'per_page': 100,
            'direction': 'DESC',
            'sort': 'updated_at'
        }, "", SCENE_FRAGMENT, get_count=True)
        seen += len(scenes)
        if not len(scenes):
            break
        for scene in scenes:
            file = scene['files'][0]['path']
            funscripts = init_task.get_funscripts(file)
            config.log.debug(f"Scanning {file} with {len(funscripts)} funscript{'s' if len(funscripts) > 1 else ''}")
            remap_scene(scene, funscripts, genpath, remapconfig)
        config.log.progress(seen/total)
        page += 1

def run(c:'Config'):
    global config
    config = c
    remap_scenes()
