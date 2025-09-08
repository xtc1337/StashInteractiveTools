# Stash Interactive Tools

Current features:

- Adds ability to change sync offset
- Adds ability to change the stroke length
- Adds supports for multiple funscripts (with heatmap support)
- Adds support for ivdb tokens (filescript and via url)

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

If you already have a collection of downloaded ivdb tokens you can enable "Handle funscript files that are handy tokens (no ivdb url needed)"
<img src="https://github.com/user-attachments/assets/9ece4c32-30a5-410e-b90c-5350c8169200"/>

# Modify Funscripts

Allows user to modify funscripts and save presets. This mimics a few features found on funscript.io that was created by @defucilis
<img width="553" height="277" alt="image" src="https://github.com/user-attachments/assets/e32b9a8d-cc18-447d-804c-a03df757cc5f" />
<img width="485" height="326" alt="image" src="https://github.com/user-attachments/assets/8a9b8f87-9629-41f4-af1a-778e0ac62b47" />
<img width="463" height="533" alt="image" src="https://github.com/user-attachments/assets/265be8f4-b0cf-42ad-8c33-cdeb9d8729d2" />
<img width="475" height="414" alt="image" src="https://github.com/user-attachments/assets/d81e292e-1359-4f8f-a946-414ebe845326" />

# Requirements

- PythonToolsInstaller plugin
- Python 3.10+
