// Things that float above the interface: the name of an icon button on
// hover, the "!" explanation mark (hover on desktop, tap on touch), and
// drop-down menus. All of them render into <body> with fixed positions so
// no scrolling panel can clip them.

import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import type {
  ButtonHTMLAttributes,
  KeyboardEvent as ReactKeyboardEvent,
  PointerEvent as ReactPointerEvent,
  ReactNode,
  RefObject,
} from 'react';
import { createPortal } from 'react-dom';

import type { IconName } from './Icon';
import { Icon } from './Icon';

type Side = 'below' | 'above';
type Align = 'center' | 'start' | 'end';

const EDGE = 8;
const GAP = 8;

function useFloatingPosition(
  anchor: RefObject<HTMLElement | null>,
  floating: RefObject<HTMLElement | null>,
  open: boolean,
  side: Side,
  align: Align,
) {
  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const a = anchor.current?.getBoundingClientRect();
      const f = floating.current;
      if (!a || !f) return;
      const w = f.offsetWidth;
      const h = f.offsetHeight;
      const rtl = document.documentElement.dir === 'rtl';
      let top = side === 'below' ? a.bottom + GAP : a.top - GAP - h;
      if (side === 'below' && top + h > window.innerHeight - EDGE && a.top - GAP - h > EDGE) top = a.top - GAP - h;
      if (side === 'above' && top < EDGE) top = a.bottom + GAP;
      const startEdge = rtl ? a.right - w : a.left;
      const endEdge = rtl ? a.left : a.right - w;
      let left = align === 'center' ? a.left + a.width / 2 - w / 2 : align === 'start' ? startEdge : endEdge;
      left = Math.max(EDGE, Math.min(left, window.innerWidth - w - EDGE));
      f.style.top = `${Math.round(top)}px`;
      f.style.left = `${Math.round(left)}px`;
      f.dataset.side = top < a.top ? 'above' : 'below';
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [anchor, floating, open, side, align]);
}

// ------------------------------------------------------------ icon button

interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  icon: IconName;
  label: string;
  /** Keyboard shortcut shown next to the name in the tooltip. */
  keys?: string;
  /** A visible one-word label beside the icon (main actions only). */
  word?: string;
  side?: Side;
  iconSize?: number;
}

/**
 * The name of a control, shown after a short mouse hover or at once on
 * keyboard focus. Spread `handlers` on the control and render `tip`.
 */
export function useHoverTip(label: string, keys?: string, side: Side = 'below', enabled = true) {
  const ref = useRef<HTMLButtonElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  useFloatingPosition(ref, tipRef, open, side, 'center');

  const show = (delay: number) => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setOpen(true), delay);
  };
  const hide = () => {
    window.clearTimeout(timer.current);
    setOpen(false);
  };
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const handlers = {
    onPointerEnter: (e: ReactPointerEvent) => enabled && e.pointerType === 'mouse' && show(380),
    onPointerLeave: hide,
    onPointerDown: hide,
    onFocus: (e: { currentTarget: HTMLElement }) => enabled && e.currentTarget.matches(':focus-visible') && show(0),
    onBlur: hide,
  };
  const tip =
    open &&
    createPortal(
      <div ref={tipRef} className="tip" role="tooltip">
        {label}
        {keys && (
          <kbd dir="ltr" className="tip-keys">
            {keys}
          </kbd>
        )}
      </div>,
      document.body,
    );
  return { ref, handlers, tip };
}

/** An icon button whose name appears on mouse hover or keyboard focus. */
export function IconButton({ icon, label, keys, word, side = 'below', iconSize, className, ...rest }: IconButtonProps) {
  const { ref, handlers, tip } = useHoverTip(label, keys, side, !word);
  return (
    <>
      <button
        ref={ref}
        type="button"
        aria-label={word ? undefined : label}
        className={[word ? 'btn btn-word' : 'btn btn-icon', className].filter(Boolean).join(' ')}
        {...handlers}
        {...rest}
      >
        <Icon name={icon} size={iconSize} />
        {word && <span>{word}</span>}
      </button>
      {tip}
    </>
  );
}

// ------------------------------------------------------------- the "!" mark

/** A small "!" that explains its neighbour: hover on desktop, tap on touch. */
export function Hint({ children, label, tone = 'help', side = 'below' }: { children: ReactNode; label: string; tone?: 'help' | 'warn'; side?: Side }) {
  const id = useId();
  const ref = useRef<HTMLButtonElement>(null);
  const bubbleRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState(false);
  const [pinned, setPinned] = useState(false);
  const closeTimer = useRef<number | undefined>(undefined);
  const open = hover || pinned;
  useFloatingPosition(ref, bubbleRef, open, side, 'center');

  const enter = (e: ReactPointerEvent) => {
    if (e.pointerType !== 'mouse') return;
    window.clearTimeout(closeTimer.current);
    setHover(true);
  };
  const leave = (e: ReactPointerEvent) => {
    if (e.pointerType !== 'mouse') return;
    window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(() => setHover(false), 160);
  };

  useEffect(() => {
    if (!pinned) return;
    const onDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (ref.current?.contains(target) || bubbleRef.current?.contains(target)) return;
      setPinned(false);
      setHover(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setPinned(false);
        setHover(false);
        ref.current?.focus();
      }
    };
    document.addEventListener('pointerdown', onDown, true);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown, true);
      document.removeEventListener('keydown', onKey);
    };
  }, [pinned]);
  useEffect(() => () => window.clearTimeout(closeTimer.current), []);

  return (
    <>
      <button
        ref={ref}
        type="button"
        className={`hint hint-${tone}`}
        aria-label={label}
        aria-expanded={open}
        aria-describedby={open ? id : undefined}
        onPointerEnter={enter}
        onPointerLeave={leave}
        onFocus={(e) => e.currentTarget.matches(':focus-visible') && setHover(true)}
        onBlur={() => !pinned && setHover(false)}
        onClick={() => setPinned((p) => !p)}
      >
        <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
          <path className="hint-shape" d="M8 .9 15.1 8 8 15.1.9 8z" />
          <path className="hint-glyph" d="M8 4.6v4.3" />
          <circle className="hint-glyph-dot" cx="8" cy="11.3" r="0.95" />
        </svg>
      </button>
      {open &&
        createPortal(
          <div
            ref={bubbleRef}
            id={id}
            role="tooltip"
            className={`bubble bubble-${tone}`}
            onPointerEnter={enter}
            onPointerLeave={leave}
          >
            {children}
          </div>,
          document.body,
        )}
    </>
  );
}

// ------------------------------------------------------------------- menus

interface MenuProps {
  /** Renders the trigger; spread `props` onto a <button>. */
  trigger: (props: ButtonHTMLAttributes<HTMLButtonElement> & { ref: RefObject<HTMLButtonElement | null> }) => ReactNode;
  children: (close: () => void) => ReactNode;
  align?: Align;
  label: string;
  /** 'dialog' for a panel of information rather than a list of commands. */
  role?: 'menu' | 'dialog';
}

export function Menu({ trigger, children, align = 'start', label, role = 'menu' }: MenuProps) {
  const ref = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  useFloatingPosition(ref, listRef, open, 'below', align);


  useEffect(() => {
    if (!open) return;
    listRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
    const onDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (ref.current?.contains(target) || listRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        ref.current?.focus();
      }
    };
    document.addEventListener('pointerdown', onDown, true);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown, true);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const onListKey = (e: ReactKeyboardEvent) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    const items = [...(listRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])];
    const i = items.indexOf(document.activeElement as HTMLElement);
    items[(i + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length]?.focus();
  };

  return (
    <>
      {trigger({
        ref,
        'aria-haspopup': role,
        'aria-expanded': open,
        onClick: () => setOpen((o) => !o),
      })}
      {open &&
        createPortal(
          <div ref={listRef} className={`menu menu-${role}`} role={role} aria-label={label} onKeyDown={onListKey}>
            {children(() => {
              setOpen(false);
              ref.current?.focus();
            })}
          </div>,
          document.body,
        )}
    </>
  );
}

export function MenuItem({ icon, label, note, keys, onSelect }: { icon: IconName; label: string; note?: string; keys?: string; onSelect: () => void }) {
  return (
    <button type="button" role="menuitem" className="menu-item" onClick={onSelect}>
      <Icon name={icon} />
      <span className="menu-label">
        {label}
        {note && <small>{note}</small>}
      </span>
      {keys && (
        <kbd dir="ltr" className="menu-keys">
          {keys}
        </kbd>
      )}
    </button>
  );
}
