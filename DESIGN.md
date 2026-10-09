---
name: Midad
description: An open-source Arabic calligraphy editor, woven in the Sadu manner.
colors:
  wool-50: "#fdfcfa"
  wool-100: "#eeeae3"
  wool-200: "#d8d1c5"
  wool-300: "#c9c1b4"
  wool-400: "#ada395"
  hair-500: "#8a7e73"
  hair-600: "#62574d"
  hair-700: "#4a4038"
  hair-800: "#342b25"
  hair-900: "#1f1915"
  madder-50: "#f8ebe8"
  madder-100: "#f0d4ce"
  madder-500: "#b13a2c"
  madder-600: "#962a1f"
  madder-700: "#7c2118"
  on-madder: "#faf1ec"
  saffron-300: "#f2cf86"
  saffron-500: "#d99a2b"
  saffron-700: "#8a5a0d"
  henna-500: "#c65a1e"
typography:
  work-display:
    fontFamily: "Midad Naskh (the active style's OFL font, loaded at runtime), serif"
    fontSize: "40px"
    lineHeight: 1.2
  work-input:
    fontFamily: "Midad Naskh (the active style's OFL font), serif"
    fontSize: "26px"
    lineHeight: 1.55
  title:
    fontFamily: "Readex Pro Variable, Segoe UI, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 600
    lineHeight: 1.5
  body:
    fontFamily: "Readex Pro Variable, Segoe UI, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.5
  readout:
    fontFamily: "Readex Pro Variable, Segoe UI, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.5
    fontFeature: "tnum"
  label:
    fontFamily: "Readex Pro Variable, Segoe UI, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 600
    lineHeight: 1.5
    letterSpacing: "0.01em"
  tab:
    fontFamily: "Readex Pro Variable, Segoe UI, system-ui, sans-serif"
    fontSize: "11.5px"
    fontWeight: 400
    lineHeight: 1.3
rounded:
  none: "0"
spacing:
  thread: "2px"
  pick: "6px"
  weave: "8px"
  row: "12px"
  panel: "16px"
components:
  band:
    backgroundColor: "{colors.madder-600}"
    textColor: "{colors.on-madder}"
    height: "52px"
  button-icon:
    backgroundColor: "transparent"
    textColor: "{colors.hair-700}"
    rounded: "{rounded.none}"
    size: "36px"
  button-icon-hover:
    backgroundColor: "{colors.wool-200}"
    textColor: "{colors.hair-900}"
  button-icon-active:
    backgroundColor: "{colors.wool-300}"
  button-primary:
    backgroundColor: "{colors.wool-50}"
    textColor: "{colors.madder-700}"
    typography: "{typography.title}"
    rounded: "{rounded.none}"
    padding: "0 16px 0 12px"
    height: "36px"
  button-primary-active:
    backgroundColor: "{colors.madder-50}"
  tile:
    backgroundColor: "{colors.wool-50}"
    textColor: "{colors.hair-900}"
    rounded: "{rounded.none}"
    padding: "8px 10px"
  tile-selected:
    backgroundColor: "#ffffff"
    textColor: "{colors.madder-600}"
  segment-selected:
    backgroundColor: "{colors.hair-900}"
    textColor: "{colors.wool-50}"
    width: "44px"
    height: "32px"
  stepper-field:
    backgroundColor: "{colors.wool-50}"
    textColor: "{colors.hair-900}"
    rounded: "{rounded.none}"
    height: "36px"
  composer:
    backgroundColor: "{colors.wool-50}"
    textColor: "{colors.hair-900}"
    typography: "{typography.work-input}"
    rounded: "{rounded.none}"
    padding: "4px 14px 4px 6px"
  bubble:
    backgroundColor: "{colors.hair-900}"
    textColor: "{colors.wool-50}"
    rounded: "{rounded.none}"
    padding: "10px 13px"
  menu:
    backgroundColor: "{colors.wool-50}"
    textColor: "{colors.hair-900}"
    rounded: "{rounded.none}"
    padding: "4px"
  tool-tab-active:
    backgroundColor: "transparent"
    textColor: "{colors.madder-600}"
    typography: "{typography.tab}"
    height: "56px"
---

# Design System: Midad

## Overview

**Creative North Star: "The Woven Nuqta"**

Midad is dressed as a strip of Sadu, the Bedouin weaving of the Arabian Peninsula, and the rhombus at its centre is read two ways at once: the diamond in the weave and the calligrapher's pen dot (nuqta), the unit Arabic letters are measured in. Undyed wool is the ground, goat-hair black-brown carries ink and type, and one madder-red band holds the shell. Every measure, slider knob, state mark and unit in the interface is that rhombus, so the editor counts in nuqat without having to write the word.

The chrome is quiet and nearly wordless. Familiar controls are icons that show their name on hover. Only the primary action (Export) and the phone's tool tabs carry a word. Explanations sit behind a small rhombus "!" mark instead of running text. Style options are shown as words the engine draws with the option applied, not as labels. The calligraphy is the loudest thing on screen. The interface is set in a geometric Kufi-cut sans, and Naskh appears only in the work itself.

Density is that of a working tool: 36px controls on desktop, 44px on touch, hairline wool borders, flat panels, and changes that land in short, decisive steps (140ms) instead of long slides or fades. Arabic and right-to-left is the reference layout, and every direction is logical (inline-start/inline-end), so English mirrors cleanly.

**Key Characteristics:**
- One madder band at the top with a woven goat-hair edge, and wool everywhere below it.
- Only two angles: 90° for structure, 45° for the rhombus. Corners are square throughout.
- The rhombus carries state: slider knobs, switch knobs, unit marks, the active-tab marker, the hint mark, the loading row.
- Colour is semantic and scarce: madder means shell, selection and the primary action; saffron means stretch; henna means changed.
- Words appear only on the hovered or focused item. Everything is available in Arabic and English.

## Colors

The palette is undyed wool and goat hair with three dyes, and each dye has exactly one job.

### Primary
- **Madder Red** (madder-600): the shell band, selected letters on the sheet, selected tiles and their drawn samples, the active phone tab and its rhombus marker, switch "on", focus rings, caret, and the theme colour. It is the one committed colour.
- **Deep Madder** (madder-700): text of the Export button set on wool inside the band, and error text on the splash.
- **Madder Wash** (madder-50): pressed state of the Export button. Madder-100 and madder-500 are reserved steps of the ramp.
- **Madder Cream** (on-madder): all text, icons and the engine-drawn wordmark on the band.

### Secondary
- **Saffron** (saffron-500): only what stretches. Kashida diamonds on the slider and the sheet, the kashida stem and ruler, unit dots in readouts, the warning hint mark, and the top edge of warning bubbles.
- **Saffron Dark** (saffron-700): stroke of filled kashida diamonds and the drag label on the sheet.
- **Saffron Light** (saffron-300): text selection highlight, links and sample glyphs inside dark bubbles.

### Tertiary
- **Henna** (henna-500): only "changed". The modified mark beside a letter that differs from its default.

### Neutral
- **Bleached Wool** (wool-50): the sheet, tiles, fields, composer, menus. Text on dark bubbles and tips.
- **Light Wool** (wool-100): the inspector and the phone dock.
- **Wool Ground** (wool-200): the app background and stage, plus the hover fill for ghost controls.
- **Wool Rule** (wool-300): every 1px border and divider, plus the pressed fill.
- **Grey Wool** (wool-400): slider track beyond the value, disabled icons, muted text inside dark bubbles.
- **Goat Hair 500–900** (hair-500 to hair-900): a five-step ink ramp. 900 is ink, type and dark surfaces (tips, bubbles, toast, selected segment). 800 is readouts and switch text. 700 is resting icon colour. 600 is secondary text, section heads and tab labels. 500 is hover borders and small non-text marks only.

### Named Rules
**The One Dye, One Meaning Rule.** Madder is shell, selection and the primary action. Saffron is stretch. Henna is changed. A dye never borrows another dye's job. If saffron appears, something can be elongated.

**The Wool Ground Rule.** Surfaces step through wool (200 ground, 100 panels, 50 sheet and fields). Chrome never uses a grey that isn't on the wool or hair ramps.

## Typography

**UI Font:** Readex Pro Variable (with Segoe UI, system-ui, sans-serif), self-hosted through @fontsource.
**Work Font:** the active style's OFL font, registered at runtime as "Midad Naskh" (Amiri today).

**Character:** Readex Pro is a geometric, Kufi-cut sans that sets Arabic and Latin with the same steady, square voice as the chrome. Naskh is kept for the calligraphy itself, so the work never competes with the interface.

### Hierarchy
- **Work Display** (40px, 1.2; 34px in the dock): the selected letter in the inspector header, set in the work font and coloured madder.
- **Work Input** (26px, 1.55; 22px on phones): the one-line composer under the sheet, in the work font.
- **Title** (600, 14px): the style name, and the Export word (600).
- **Body** (400, 14px, 1.5): base UI text, menu items (500 for the item label).
- **Readout** (400, 13px, tabular figures): numeric readouts, zoom (12.5px), shortcuts and switch labels.
- **Label** (600, 12px, 0.01em): inspector section names, shown only while the section is hovered or focused.
- **Tab** (400, 11.5px, 1.3; 600 when active): phone tool-tab words under their icons. Keycaps also use 11.5px.

### Named Rules
**The Naskh Is the Work Rule.** The work font appears only where the user's calligraphy appears: the sheet, the composer, the letter glyph, option samples and the wordmark. Interface text is always Readex Pro.

**The Minimal Running Text Rule.** Controls are icons with their name in a tooltip. A word sits beside an icon only for Export and the phone tool tabs. Explanations live behind the rhombus "!" hint, which opens on hover on desktop and on tap on touch. No sentence is set in the chrome at rest.

## Layout

The frame is a fixed-height grid (100dvh, no page scroll). It has a band row of 52px plus an 8px woven edge (48px plus 6px on phones), then the workspace.

- **Desktop (>760px):** the inspector column sits at inline-start, 304px wide (276px at ≤1080px). A 5px woven seam separates it from the stage. The stage is wool ground with 16px padding and holds the sheet (flex-fill, wool-50, lifted) with the composer docked 12px below it. A small zoom/measure cluster floats in the sheet's inline-end bottom corner, 10px from the edges.
- **Phone (≤760px):** the inspector is dropped. The sheet fills the stage (8px padding). Selecting a letter adds a bottom dock in a third grid row: a header (close, reset, prev/glyph/next), one tool stage at a time (min 112px), and a five-column row of icon+word tabs. Touch targets grow to 40–44px, and the hint hit area grows to 32px.
- **Rhythm:** clustered icon groups sit 2px apart. Tiles in a grid sit 6px apart. 8px is the base weave unit. Rows and inline gaps are 10–12px. Panel sections pad 14px 16px 16px, separated by 1px wool rules.
- **Direction:** all offsets are logical (`inset-inline-*`, `margin-inline-*`, `padding-inline`). Only back/forward icons (undo, redo) mirror in RTL. Range-track gradients flip with direction.

## Elevation & Depth

The system is flat and tonal. Wool steps (200 to 100 to 50) separate ground, panel and sheet, and 1px wool-300 borders do the structural work. Shadows are warm (goat-hair brown, never neutral black) and appear in only two strengths: one for the sheet as a sheet of paper, one for things that float above everything.

### Shadow Vocabulary
- **Lift** (`0 1px 2px rgb(31 25 21 / 0.08), 0 10px 28px rgb(31 25 21 / 0.1)`): the sheet only.
- **Float** (`0 2px 4px rgb(31 25 21 / 0.14), 0 14px 34px rgb(31 25 21 / 0.18)`): tips, bubbles, menus, the toast.
- **Rest hairline** (`0 1px 2px rgb(31 25 21 / 0.05–0.06)`): the composer and the sheet-tools cluster, just enough to sit on the sheet or ground.
- **Dock rise** (`0 -8px 24px rgb(31 25 21 / 0.08)`): the phone dock's upward cast.

### Named Rules
**The Paper and Thread Rule.** Only the sheet is lifted, and only floating layers cast the float shadow. Panels, tiles and fields are flat and separated by wool borders. Selection is an inset 1px madder ring, never a shadow.

## Shapes

Every corner is square (radius 0, a single token applied to every control, field, tile, menu and bubble). The only diagonal shape is the 45° rhombus, cut with `clip-path: polygon(50% 0, 100% 50%, 50% 100%, 0 50%)` or drawn as an SVG path. The band's lower edge is a repeating woven strip: goat-hair ground, wool diamonds, a madder pupil in every other one. The inspector seam is a vertical wool strip with madder diamonds. Icons are drawn on a 24-unit grid with one 1.75 stroke and round joins. Their structure is square, and the only diagonal icon form is the rhombus.

### Named Rules
**The Two Angles Rule.** Only 90° and 45° are used in the chrome. Rounded corners and circles are not part of the world. The one circle is the dot of the "!" inside the hint mark.

## Components

### Buttons
Ghost and square, so the icons carry them.
- **Shape:** square (radius 0), 36×36 minimum (44 in the dock, 40 on phone bar and sheet tools). 20px icon.
- **Ghost icon (default):** transparent background, hair-700 icon. Hover fills wool-200 and the icon turns hair-900. Pressed fills wool-300. Disabled turns wool-400. The name appears in a dark tip on hover, with the shortcut alongside it.
- **On the band:** icons are on-madder. Hover and open state use a translucent cream wash (white at 13%), pressed uses black at 14%, and disabled uses on-madder at 38%.
- **Primary (Export, the only worded button):** a wool-50 block inside the band with a deep-madder icon and word (600). Hover turns it pure white. Pressed turns it madder-50. Its padding is 12px on the icon side and 16px on the word side.
- **Toggle icon:** pressed reads madder-600 and unpressed reads hair-500.
- **Transition:** background and colour change over 140ms on the house ease.

### Tiles (shapes and style options)
- **Corner Style:** square. 1px wool-300 border on wool-50.
- **Content:** a letter shape or a sample word drawn by the engine with that option applied, filled hair-900. Labels never stand in for samples.
- **States:** hover darkens the border to hair-500. Selected gets a madder border plus a 1px inset madder ring, a white field, and a madder-filled sample. A small rhombus at the inline-start top corner marks origin or state, and it turns madder when on.
- **Grid:** auto-fill, minimum 58px for shapes and 76px for options, with 6px gaps. On phones, shapes scroll horizontally in 64px columns with snapping.

### Inputs / Fields
- **Stepper field:** a 36px (44px touch) square field, wool-50 with a wool-300 border. It has − and + ghost cells (36–40px wide) and a centred tabular number. A small rhombus after the number stands for the nuqta unit. When focused inside, the border turns hair-500.
- **Composer:** a single-line wool-50 field under the sheet, set in the work font at 26px, with a madder caret. Its border turns hair-500 on focus.
- **Range:** a 2px track (wool-400, with the active span in hair-800 measured from the neutral value) and a 16px rhombus knob in hair-900. The knob turns madder on hover or drag, and grows to 22px on touch.
- **Switch:** a square 32×18 tab with a hair-500 border on wool-200 and a 12px rhombus knob. When on, it fills madder and the knob turns wool-50.
- **Segmented:** a wool-50 strip with a 1px border and 2px inner padding, holding 44×32 icon segments. The checked segment is solid hair-900 with a wool-50 icon.

### Navigation
- **The band:** madder-600 with an 8px woven edge (6px on phones). Inline-start holds the engine-drawn wordmark (30px tall), a file menu, a 1px rule and undo/redo. Inline-end holds the warning hint, shortcuts, a language toggle (the other language's short name, 600) and Export.
- **Phone tool tabs:** five equal columns, each an icon above one word (11.5px), in hair-600. The active tab turns madder-600 at 600 weight, with an 8px madder rhombus sitting on the tab row's top rule.

### Floating layers
- **Tip:** hair-900 block, wool-50 text at 12.5px. Shortcut keys sit in wool-400. It has no pointer events and casts the float shadow.
- **Bubble:** hair-900, 13px at 1.65, max 300px wide. It fades in over 90ms. Warning bubbles add a 2px saffron inset at the top.
- **Menu:** wool-50 with a 1px border and float shadow, min 210px. Items are 38px rows: icon in hair-600, label 500, optional note 12px in hair-600, keys at the end. Hover fills wool-200.
- **Toast:** hair-900 and centred at the top of the stage, with a saffron unit dot. It drops 6px in over 140ms.

### The Rhombus Hint (signature)
A 16px outlined rhombus (hair-600, 1.2 stroke) holding a "!" (hair-700), in a 24px hit area (32px on phones). On hover or open it fills hair-900 and the "!" turns wool-50. The warning version sits in the band at 36px: a saffron-filled rhombus with a hair-900 "!". It is the only place explanation text lives.

### The Diamond Slider (signature)
Kashida length is shown as a row of rhombi, one per nuqta (17px cells, 22px on touch). It fills from the right as the join stretches. Empty diamonds are wool-50 with a wool-400 stroke, and filled diamonds are saffron-500 with a saffron-700 stroke. It is a real slider (pointer drag, arrows in 0.5 steps, Shift for whole dots, Home/End). On the sheet, the same saffron diamond sits on a dashed stem under the elongation as a drag handle, with a saffron ruler and a saffron-700 count while it is dragged.

### Loading Row
A row of 12px rhombi in the repeating order madder, goat hair, saffron. They beat in one after another with stepped (not eased) timing, like weft being beaten in. Under reduced motion they hold still at 85%.

## Do's and Don'ts

### Do:
- **Do** draw every unit, knob, state marker and measure as a 45° rhombus. The rhombus is the nuqta.
- **Do** keep madder for the shell, selection and the one primary action, saffron for kashida/stretch, and henna for "modified" only.
- **Do** keep every corner square (radius 0). Separate surfaces with wool steps and 1px wool-300 borders.
- **Do** make familiar controls icon-only, with their name and shortcut in a hover tip. Only Export and the phone tool tabs carry a word.
- **Do** put explanations behind the rhombus "!" hint (hover on desktop, tap on touch), never in running UI text.
- **Do** show style options as engine-drawn sample words with the option applied.
- **Do** use logical properties throughout and treat Arabic/RTL as the reference. Every string exists in Arabic and English.
- **Do** move in short steps: 140ms on `cubic-bezier(0.2, 0.9, 0.25, 1)`, 90ms fades for floating layers, and nothing at all under reduced motion.
- **Do** keep touch targets at 40–44px on phones, with one dock tool visible at a time.

### Don't:
- **Don't** round corners or introduce angles other than 90° and 45° in the chrome.
- **Don't** use a dye outside its job, such as saffron as a generic highlight or madder as decoration.
- **Don't** add labelled-field property panels, a status bar of hints, or explanatory sentences at rest.
- **Don't** set interface text in the Naskh work font, or the calligraphy in the UI font.
- **Don't** use neutral-black or cool-grey shadows. Shadows are goat-hair brown and limited to the four roles above.
- **Don't** use hair-500 or lighter for readable text on wool. It is for borders and small marks only.
