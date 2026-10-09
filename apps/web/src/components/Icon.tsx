// The icon set: drawn on a 24-unit grid, one 1.75 stroke, round joins.
// Structure is square (90°); the only diagonal shape is the rhombus, the
// pen dot that measures everything in Midad.

const paths = {
  file: 'M3.5 7.5A1.5 1.5 0 0 1 5 6h4l2 2h8a1.5 1.5 0 0 1 1.5 1.5v8A1.5 1.5 0 0 1 19 19H5a1.5 1.5 0 0 1-1.5-1.5z',
  new: 'M14 3.5H7.5a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2V8zM14 3.5V8h4.5M12 11v6M9 14h6',
  open: 'M3.5 17V6.5A1.5 1.5 0 0 1 5 5h4l2 2h7a1.5 1.5 0 0 1 1.5 1.5V10M3.5 17l2.4-6a1.5 1.5 0 0 1 1.4-.95H20a1 1 0 0 1 .93 1.37l-2.3 5.7A1.5 1.5 0 0 1 17.2 19H5a1.5 1.5 0 0 1-1.5-1.5z',
  save: 'M5 3.5h10.5l4 4V19a1.5 1.5 0 0 1-1.5 1.5H6A1.5 1.5 0 0 1 4.5 19V5A1.5 1.5 0 0 1 5 3.5zM8 3.5v4h7v-4M7.5 20.5v-6h9v6',
  export: 'M12 3.5v11.5M7 10l5 5 5-5M5 20.5h14',
  undo: 'M9 14.5 4.5 10 9 5.5M4.5 10h10a5 5 0 0 1 0 10H11',
  redo: 'M15 14.5 19.5 10 15 5.5M19.5 10h-10a5 5 0 0 0 0 10H13',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  fit: 'M4 9V5h4M16 5h4v4M20 15v4h-4M8 19H4v-4',
  ladder: 'M3 20.5h18M9 13.5l2.5 2.5L9 18.5 6.5 16zM14 8.5l2.5 2.5-2.5 2.5-2.5-2.5zM9 3.5 11.5 6 9 8.5 6.5 6z',
  keyboard:
    'M3.5 7A1.5 1.5 0 0 1 5 5.5h14A1.5 1.5 0 0 1 20.5 7v10a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 17zM7 9.5h.01M10.3 9.5h.01M13.7 9.5h.01M17 9.5h.01M7 12.5h.01M17 12.5h.01M10.3 12.5h.01M13.7 12.5h.01M8.5 15.5h7',
  alignRight: 'M20.5 6h-17M20.5 12h-11M20.5 18h-14',
  alignCenter: 'M20.5 6h-17M17 12H7M19 18H5',
  alignLeft: 'M3.5 6h17M3.5 12h11M3.5 18h14',
  lineSpacing: 'M4 7.5 7 4.5l3 3M7 4.5v15M4 16.5l3 3 3-3M13.5 6h7M13.5 12h7M13.5 18h7',
  size: 'M14.5 3.5h6v6M20.5 3.5l-7 7M9.5 20.5h-6v-6M3.5 20.5l7-7',
  slant: 'M18.5 4.5h-8M13.5 19.5h-8M15 4.5 9 19.5',
  moveH: 'M3.5 12h17M7.5 8l-4 4 4 4M16.5 8l4 4-4 4',
  moveV: 'M12 3.5v17M8 7.5l4-4 4 4M8 16.5l4 4 4-4',
  move: 'M12 3v18M3 12h18M9 6l3-3 3 3M9 18l3 3 3-3M6 9l-3 3 3 3M18 9l3 3-3 3',
  kashida: 'M21 15H3M7 11l-4 4 4 4M17.5 12.5 20 15l-2.5 2.5L15 15z',
  shapes: 'M4 4h6.5v6.5H4zM13.5 4H20v6.5h-6.5zM4 13.5h6.5V20H4zM13.5 13.5H20V20h-6.5z',
  reset: 'M4 12a8 8 0 1 0 2.4-5.7L4 8.6M4 4v4.6h4.6',
  eraser: 'M8 20.5h12M5.2 14.8l8.6-8.6a2 2 0 0 1 2.8 0l2.2 2.2a2 2 0 0 1 0 2.8l-7.4 7.4a2 2 0 0 1-1.4.6H9.4a2 2 0 0 1-1.4-.6l-2.8-2.8a1 1 0 0 1 0-1.4zM10.5 9.5l5 5',
  close: 'M6 6l12 12M18 6 6 18',
  chevronLeft: 'M14.5 6 8.5 12l6 6',
  chevronRight: 'M9.5 6l6 6-6 6',
  chevronDown: 'M6 9.5l6 6 6-6',
  vector: 'M5 19C5 11.5 11.5 5 19 5M3 17h4v4H3zM17 3h4v4h-4z',
  image: 'M4 5.5h16v13H4zM4 15.5l4.5-4.5 4 4 2-2 5.5 5.5M15.5 9.5h.01',
  sliders: 'M4 7h9M17 7h3M4 17h3M11 17h9M15 5v4M9 15v4',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  saved: 'M7 18.5h10a4 4 0 0 0 .6-7.95A5.5 5.5 0 0 0 7 9.5a4.5 4.5 0 0 0 0 9zM9.5 14l2 2 3.5-3.5',
} as const;

export type IconName = keyof typeof paths;

/** Icons that point "back" or "forward" mirror in a right-to-left interface. */
const mirrored = new Set<IconName>(['undo', 'redo']);

export function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  return (
    <svg
      className={mirrored.has(name) ? 'icon icon-mirror' : 'icon'}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d={paths[name]} />
    </svg>
  );
}

/** The pen dot as a unit mark: "3.5 ◆" reads as three and a half dots. */
export function Dot({ filled = true, className }: { filled?: boolean; className?: string }) {
  return (
    <svg className={['dot', className].filter(Boolean).join(' ')} viewBox="0 0 10 10" aria-hidden="true" focusable="false">
      <path d="M5 .8 9.2 5 5 9.2.8 5z" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={filled ? 0 : 1.2} />
    </svg>
  );
}
