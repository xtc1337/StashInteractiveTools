# Stash Interactive Tools

Current features:

- Adds ability to change sync offset
- Adds ability to change the stroke length
- Adds supports for multiple funscripts (with heatmap support)

# Multi Funscripts

![img.png](docs/settings.png)
The plugin allows to tag all scripts that are found to have multiple tags. To do this go to the plugins
settings and set the tag name you would like to use, the default tag is set to `[SIT: Multi-Script]`

Once set go to the `Tasks` screen and press the `tag` tasks
![img.png](docs/tag.png)

Currently, the matching logic is very simple, later support will be added to customize.
The logic states:

- Take the base funscript name and use as prefix via an glob lookup
  - ie: `Izzy Green 02 - Puerto Rico Creampie Sextape.funscript` will look for `Izzy Green 02 - Puerto Rico Creampie Sextape*.funscript`
  - Note: There is special logic added so that versioned files are not picked up..
    - ie: `My Script 01.funscript` and `My Script 02.funscript` each have their own video so when viewing `My Script 01` video it will not return `My Script 02`
- Strip the prefix and remove `()`
  - ie: `Izzy Green 02 - Puerto Rico Creampie Sextape (Less Intense Filler).funscript` and `Izzy Green 02 - Puerto Rico Creampie Sextape (More Intense Filler).funscript`
    Will output `Less Intense Filler` and `More Intense Filler` in the ui
    ![img.png](docs/multi.png)

# IVDB.io Support

Also IVDB.io tokens are now supported in Stash. To enable you still need to have the video locally and then input the url of the video on ivdb.io as one of the scripts urls
<img width="460" height="99" alt="image" src="https://github.com/user-attachments/assets/9bad80c0-65b5-4d0c-8efb-15eaa8e66b95" />

# Modify Funscripts

Allows user to modify funscripts and save presets. This mimics a few features found on funscript.io that was created by @defucilis
<img width="553" height="277" alt="image" src="https://github.com/user-attachments/assets/e32b9a8d-cc18-447d-804c-a03df757cc5f" />
<img width="485" height="326" alt="image" src="https://github.com/user-attachments/assets/8a9b8f87-9629-41f4-af1a-778e0ac62b47" />
<img width="463" height="533" alt="image" src="https://github.com/user-attachments/assets/265be8f4-b0cf-42ad-8c33-cdeb9d8729d2" />
<img width="475" height="414" alt="image" src="https://github.com/user-attachments/assets/d81e292e-1359-4f8f-a946-414ebe845326" />

# Improved Tagging

The tagger nows runs faster, and will untag items that don't have 2+ funscripts
It will untag scenes with Zero funscripts, IF the file count is 1, and only 1.  This avoids removing the tag if you have 2+ files and only 1 of them has funscripts detected.

# Remapping

The stock Stash heatmap only graphs a single funscript.
The 'remap' task adds the following, and has settings discussed below:

## Replaces the stock heatmap
### Builds a multi-funscript heatmap, each one stacked on top of the next
<img width="259" height="62" alt="Image" src="https://github.com/user-attachments/assets/b431d3eb-acda-4e74-81e2-d48ea8c0b159" />

To build this, we use PIL (which should be installed by the install task), and use a small font Volta-Goldfish which is included.
There are a few premade maps for Tokens, Broken and Missing as well.  You could replace these with nicer graphics, or alter the font used, and a bannermaker script is included.

### Tokens can't be mapped
The data isn't available to do a map for those

<img width="272" height="71" alt="Image" src="https://github.com/user-attachments/assets/b32bff05-aff0-4ee5-80f2-b6475da11755" />

### Map by Scene Duration or Full Funscript lengths
This setting option either:

- Aligns the heatmaps with the length of the scene.  This makes it much easier to see incorrect or different lengths
<img width="255" height="51" alt="Image" src="https://github.com/user-attachments/assets/3c57ff51-925e-4f26-a123-83bc7e9ee950" />

OR

- It does the normal 'full length' and maps the entire funscript... this means that a 5 minute and 50 minute funscript both take up the entire length    
<img width="324" height="103" alt="Image" src="https://github.com/user-attachments/assets/3a5540b8-6ba8-4ce0-943e-1e63eed76da7" />

## Labels in the heatmap

### Labels primary as "Default"
The 'default' text can enabled/disabled when mapping multiple funscripts in one heatmap, but if there is only one funscript, no text label is used.

### Heatmaps are sorted
The default is first, alphabetically the rest, then Tokens are pushed to the end of the list

### Timestamps - optional  
- The length of the funscript (the last action time) can be added on the right side of the map
- The timestamp is super useful for finding mismatched scripts...
- This is enabled/disabled in the settings

## Disable duplicates 
If turned on in the settings,  this looks at the "actions" (not the entire funscript file itself), hashes them and keeps track
- Metadata is ignored, ONLY the actual actions are considered.
- If identical to a previously mapped funscript, will rename the funscript file to .funscriptdupe
- If your 'primary' (same filename) funscript is a token, and you have other funscripts:
  - Attempts to swap one of them for the token. 
    - Rename to (token).funscript
    - Copy another to .funscript
    - Likely will then flag the copied original one as a dupe

### Duplicate Highlighting
If you don't disable duplicates, the background of that part of the heatmap is changed to white to highlight it's a duplicate
  
<img width="261" height="90" alt="Image" src="https://github.com/user-attachments/assets/aea28c32-fde7-4e6b-b949-357cde644e7c" />

## Flagging Tagging
- If the length of a funscript is more than a few minutes from the length of the video, we change the text to a red background, and optionally, can tag the scene
- The tag name is configurable in the settings, an empty value means it will NOT tag these items, only mark the heatmap
- Suggestions for other 'problems' to tag are welcomed. (Short? Ideas?)
- Some tokens are recognized and will get flagged as an incorrect time, token recognition is 99% but there are tokens it misses.

### Broken/Missing funscripts
   
- If a funscript has faulty/unreadable json, it will map/flag it as Broken. 
- Usually Missing means the permissions are wrong for some reason.

<img width="320" height="165" alt="Image" src="https://github.com/user-attachments/assets/e7d16607-37a4-441a-b137-45aa90d2587a" />

## Change 0 (or less) interactive speed to 1
- Stash won't display a heatmap that if it thinks the 'interactive speed' is 0, which is the case for most token funscripts.
- If Enabled, this runs an SQL command to change the value in the database to 1.  
### While this should be safe and cautious:
* PLEASE backup your database, as direct SQL (even via GQL commands) is considered 'dangerous' in general, but no GraphQL method allows this change otherwise

## Remap Settings

<img width="757" height="555" alt="Image" src="https://github.com/user-attachments/assets/30fd1bcf-5fee-482e-95e7-9711a65a7993" />

# Requirements

- PythonToolsInstaller plugin
- Python 3.10+
- [Custom Build](https://github.com/stashapp/stash/commit/c8d4dacffd011653b083cfe0e3f0591fb0e3de43) version of stash
