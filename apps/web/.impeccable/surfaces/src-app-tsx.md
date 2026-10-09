---
version: 1
slug: "src-app-tsx"
primary_target: "src/App.tsx"
related_targets: ["src/styles.css","src/components"]
---

# Editor surface (apps/web, the whole app)

Scope: the single editor screen (top bar, sheet, text composer, inspector), desktop and phone. Mode: **Operate**.

Audience and job: Arab graphic designers type a phrase, shape it letter by letter (shapes, kashida, offset, size, slant), and export SVG/PNG for real work. Sessions run on a laptop or, for quick social pieces, on a phone with touch.

Constraints from the request: running UI text cut to the minimum; controls speak through icons, state and position. Any explanation lives behind a small "!" mark that opens on hover (desktop) or tap (touch). Main actions get icon + one word; familiar ones are icon-only with their name on hover. Full touch editing on phones.

Unresolved: none.

## Direction contract

THESIS: The Sadu diamond and the calligrapher's nuqta are one atom. Every measure, handle, unit and state in Midad is a woven rhombus, so the interface counts in nuqat without writing the word. Refuses the category default: grey chrome, a properties sidebar of labelled fields, and a status bar of hints.

OWN-WORLD: Sadu weaving of the Peninsula. Ground is undyed wool greige, panels lighter wool, the sheet near-white; goat-hair black-brown for ink and type; a committed madder-red band for the shell header, selection and the one primary action; saffron only for what stretches (kashida); henna orange only for "changed". Two angles exist: 90° for structure, 45° for the rhombus. Readex Pro (Kufi-cut geometric) for all UI; Naskh only for the work.

STORY: The visitor sees their phrase set large and correct, taps a letter, and its tools appear beside it (or beneath it on a phone): shapes as tiles, stretch as a row of diamonds that fill as the join lengthens, nudges counted in diamonds. They export without reading a sentence.

FIRST VIEWPORT: Desktop: 52px madder band across the top (engine-drawn مداد wordmark at start, file/undo/redo icons, export button with word at end). Inspector column (~300px) at inline-start on light wool; the stage fills the rest: white sheet with the phrase at fitted scale, a one-line Naskh composer docked under it, a small zoom/measure cluster floating at the stage's bottom-end corner. Phone: band 48px, sheet fills, composer at the bottom; a selected letter swaps the composer for a bottom tool sheet (header with prev/glyph/next, one tool at a time, icon+word tabs).

FORM: Sadu weaving (own grounded list, position 7 of 7), assigned by seed e44f9372 after re-roll 1. Signature interaction: the diamond slider. Kashida length is a row of rhombi, one per nuqta, filling right-to-left as the join stretches, mirrored on the sheet under the elongation while it is dragged or selected. Raises: state carried by the diamond, not a word (star atlas); changes land as short decisive steps, no fades or long slides (acetate manual); words appear only on the focused or hovered item (streaming wall); only 90° and 45° in the chrome (transit map).

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
