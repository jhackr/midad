# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Graphic and brand designers who need authentic Arabic calligraphic lettering for real work: logos, posters, invitations, social posts. They want correct, beautiful calligraphy with control over every letter, without lettering it by hand or hiring a calligrapher for every piece.

Calligraphers and type designers take part as contributors (reviewing letter shapes, editing style rules, drawing new styles; see `CONTRIBUTING.md` and `docs/ar/CALLIGRAPHERS.md`), not as the primary editor audience.

## Product Purpose

Midad (مداد) is an open-source editor for Arabic calligraphy. The user types a phrase, the engine sets it in a real calligraphic style, and the user chooses each letter's shape, stretches joins with kashida, and moves, scales and slants letters.

A successful session ends with finished artwork in use: an exported SVG or PNG that goes straight into a logo, print, post or invitation.

## Positioning

- **A real shaping engine underneath.** Every frame is recomputed by HarfRust (the Rust port of HarfBuzz). Alternate shapes are applied inside the shaper, so harakat, kerning and joins stay correct for the letter the user picked.
- **Documents store decisions, not drawings.** A `.midad` file is the text plus the user's choices; edit the text and the choices follow.
- **Calligraphic units.** Offsets and elongations are measured in nuqat (rhombic pen dots), with the dot ladder drawn beside each line.
- **Styles are open data.** A style is an OFL font plus a `style.toml` that calligraphers can edit: options, kashida rules, alternates.

## Operating Context

- Used on desktop and laptop computers with a mouse or trackpad, in the browser (GitHub Pages) or the desktop app (Tauri, Windows/macOS/Linux), and on phones in the browser with touch. All run the same UI from `apps/web`.
- Work is saved as `.midad` documents; the browser build also autosaves locally. Output leaves Midad as SVG or PNG for use in the designer's other work.
- Works fully offline and without an account.

## Capabilities and Constraints

- **Today:** type a phrase (multi-line, alignment, line spacing); pick alternate shapes per letter; stretch joins with kashida within the style's rules; per-letter offset, size and slant; undo/redo; open/save `.midad`; export SVG and PNG; Arabic and English UI.
- **Styles:** one style ships today, `naskh-amiri` (built on Amiri, OFL).
- **Devices:** desktop and laptop first; phones are supported with full touch editing (select, drag, kashida, shapes, export). Explanations live behind small info marks (hover on desktop, tap on touch), not in running UI text. Desktop window minimum is 900×600.
- **Language:** Arabic is the reference UI language; every string must exist in both Arabic and English (`apps/web/src/i18n.ts`). Paragraph direction is always RTL.
- **Known limits:** kashida is a straight, scaled tatweel (curved madd is planned); no automatic stacking (تركيب), so vertical arrangements are manual offsets; one alternate per ligature cluster. See `docs/ROADMAP.md`.
- **Terminology:** *nuqat* / نقطة (dot unit), *kashida* / مدّ (elongation of a join), *shapes* / أشكال الحرف (letter alternates), *style* / خط (font + `style.toml` package), *harakat* (marks).

## Brand Commitments

- Name: **Midad / مداد**; the desktop window title puts Arabic first ("مداد — Midad"). A logo component exists at `apps/web/src/components/Logo.tsx`.
- Open source: code MIT OR Apache-2.0; fonts SIL OFL 1.1.
- **Your artwork is yours.** Anything composed and exported with Midad belongs to the user, with no obligation.
- The editor stays fully usable offline and without an account; any future hosted service is separate and optional.

## Evidence on Hand

- Editor screenshot: `docs/images/editor.png`.
- One shipping style: `styles/naskh-amiri`.
- Docs: `README.md`, `docs/ARCHITECTURE.md`, `docs/ROADMAP.md`, `docs/ar/CALLIGRAPHERS.md`.
- No users, testimonials, case studies, press, download counts or benchmarks exist yet. Do not fabricate them.

## Product Principles

1. **The export is the deliverable.** Judge features by whether the SVG/PNG is ready to drop into real design work without cleanup.
2. **Authentic by construction.** Shaping, joins and marks come from the engine and the style's rules; manual adjustments sit on top and never break correctness.
3. **Calligraphic control without calligraphic training.** Designers get shapes, madd and nuqat directly; the style rules carry the expertise so the user doesn't have to.
4. **Decisions stay editable.** The document keeps the text and every choice live until export.

## Accessibility & Inclusion

No formal standard set yet. Planned in `docs/ROADMAP.md` (M1): keyboard-only flow, screen-reader labels for letters, and a contrast check.
