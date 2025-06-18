# JS Banner
A lightweight plugin to display a banner image at the top of your Obsidian notes.

## Features

* Display banners from local vault images or remote URLs.
* Visual, grid-based image selector for local files.
* Global customization via the settings menu.
* Per-note styling overrides using YAML frontmatter.

## Usage and Customization

To add a banner, run the "Set banner" command from the command palette or manually add the `banner` key to your note's frontmatter.

### Plugin Settings

Configure these options globally in Settings > JS Banner.

| Setting | Description |
| :--- | :--- |
| **Banner field name** | The YAML key for the banner link (default: `banner`). |
| **Hide note properties** | Toggles if the banner hides the note's metadata section. |
| **Enable rounded corners** | Applies rounded corners to the banner's frame. |
| **Enable fade effect** | Applies a gradient fade at the bottom of the banner. |
| **Fade intensity** | Sets the height of the fade effect. |

### Per-Note Customization (YAML)

Add these keys to a note's frontmatter for specific adjustments.

| Key | Description |
| :--- | :--- |
| **`banner-height`** | Sets a custom banner height in pixels (e.g., `300`). |
| **`banner-type`** | Sets the image fit. `cover` (default) fills the frame, `contain` fits the image inside. |
| **`banner-x` / `banner-y`** | Sets the image's focal point from `0` to `1`. Affects `cover` type only. |

**Example:**
```yaml
---
banner: "[[image.png]]"
banner-height: 400
banner-y: 0.2
---
```

## Installation
