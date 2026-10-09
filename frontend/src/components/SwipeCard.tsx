// ────────────────────────────────────────────────────────────────────────────
// A single swipeable care task card.
//
// Design constraints that are not negotiable here, because of who uses it:
//
//  • GLOVES. Nitrile gloves work on capacitive screens but imprecisely. Every
//    target is at least 64px, and nothing depends on a precise landing.
//  • ONE HAND. Buttons sit at the bottom, inside thumb reach. Nothing important
//    lives in the top corners.
//  • A DELIBERATE GESTURE. An accidental swipe would write a false care record,
//    which is the exact thing the record-integrity work exists to prevent. So
//    the threshold is a third of the card's width, a flick must also be fast,
//    and every action can be undone.
//  • GESTURES ARE NEVER THE ONLY WAY. Buttons do everything a swipe does. Some
//    people cannot swipe reliably; some gloves barely register drag at all.
//
// Pointer events, not touch events: one code path covers finger, stylus and
// the mouse used when demonstrating on a laptop.
// ────────────────────────────────────────────────────────────────────────────
import React, { useRef, useState } from 'react';

export type SwipeDir = 'right' | 'left' | 'up';

/** A third of the card, or 90px, whichever is greater. */
const DISTANCE_RATIO = 0.33;
const MIN_DISTANCE = 90;
/** A short flick counts, but only if it is genuinely fast. */
const FLICK_VELOCITY = 0.6;   // px per ms
const MIN_FLICK_DISTANCE = 48;

export interface SwipeCardProps {
  children: React.ReactNode;
  onSwipe: (dir: SwipeDir) => void;
  onTap?: () => void;
  /** Right-swipe is blocked for medication tasks, which are signed on the MAR. */
  allowRight?: boolean;
  allowLeft?: boolean;
  allowUp?: boolean;
  disabled?: boolean;
}

export default function SwipeCard({
  children, onSwipe, onTap,
  allowRight = true, allowLeft = true, allowUp = true, disabled = false,
}: SwipeCardProps) {
  const [drag, setDrag] = useState<{ x: number; y: number } | null>(null);
  const [leaving, setLeaving] = useState<SwipeDir | null>(null);
  const start = useRef<{ x: number; y: number; t: number; id: number } | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const moved = useRef(false);

  function down(e: React.PointerEvent) {
    if (disabled || leaving) return;
    start.current = { x: e.clientX, y: e.clientY, t: performance.now(), id: e.pointerId };
    moved.current = false;
    // Capture so a finger that slides off the card still finishes the gesture.
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
  }

  function move(e: React.PointerEvent) {
    const s = start.current;
    if (!s || s.id !== e.pointerId) return;
    const dx = e.clientX - s.x;
    const dy = e.clientY - s.y;
    if (Math.abs(dx) > 6 || Math.abs(dy) > 6) moved.current = true;
    setDrag({ x: dx, y: dy });
  }

  function up(e: React.PointerEvent) {
    const s = start.current;
    start.current = null;
    if (!s || s.id !== e.pointerId) { setDrag(null); return; }

    const dx = e.clientX - s.x;
    const dy = e.clientY - s.y;
    const dt = Math.max(1, performance.now() - s.t);
    const width = box.current?.offsetWidth || 320;
    const threshold = Math.max(MIN_DISTANCE, width * DISTANCE_RATIO);

    // A tap: barely moved.
    if (!moved.current) {
      setDrag(null);
      onTap?.();
      return;
    }

    const horizontal = Math.abs(dx) > Math.abs(dy);
    const far = (d: number) => Math.abs(d) >= threshold;
    const flick = (d: number) => Math.abs(d) >= MIN_FLICK_DISTANCE && Math.abs(d) / dt >= FLICK_VELOCITY;

    let dir: SwipeDir | null = null;
    if (horizontal && (far(dx) || flick(dx))) {
      dir = dx > 0 ? 'right' : 'left';
    } else if (!horizontal && dy < 0 && (far(dy) || flick(dy))) {
      dir = 'up';
    }

    if (dir === 'right' && !allowRight) dir = null;
    if (dir === 'left' && !allowLeft) dir = null;
    if (dir === 'up' && !allowUp) dir = null;

    if (!dir) { setDrag(null); return; }   // springs back
    setLeaving(dir);
    setDrag(null);
    // Let the card animate off before the list changes under it.
    window.setTimeout(() => { onSwipe(dir!); setLeaving(null); }, 180);
  }

  const dx = drag?.x ?? 0;
  const dy = drag?.y ?? 0;
  const width = box.current?.offsetWidth || 320;
  const threshold = Math.max(MIN_DISTANCE, width * DISTANCE_RATIO);

  // How committed the gesture is, 0..1 — drives the colour wash so the carer
  // can see what will happen before they let go.
  const horizontal = Math.abs(dx) > Math.abs(dy);
  const progress = Math.min(1, (horizontal ? Math.abs(dx) : Math.max(0, -dy)) / threshold);
  const pending: SwipeDir | null =
    !drag ? null
    : horizontal ? (dx > 0 ? (allowRight ? 'right' : null) : (allowLeft ? 'left' : null))
    : (dy < 0 && allowUp ? 'up' : null);

  const TINT: Record<SwipeDir, string> = {
    right: '22,163,74',    // green — done
    left:  '217,119,6',    // amber — not now
    up:    '220,38,38',    // red   — something is wrong
  };

  const offX = leaving === 'right' ? width * 1.6 : leaving === 'left' ? -width * 1.6 : dx;
  const offY = leaving === 'up' ? -900 : leaving ? dy : dy;

  return (
    <div
      ref={box}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
      style={{
        position: 'relative',
        touchAction: 'none',           // we own the gesture; stop the page scrolling
        userSelect: 'none',
        WebkitUserSelect: 'none',
        cursor: disabled ? 'default' : 'grab',
        transform: `translate(${offX}px, ${offY}px) rotate(${offX * 0.04}deg)`,
        transition: leaving ? 'transform .18s ease-out, opacity .18s ease-out'
                  : drag ? 'none' : 'transform .22s cubic-bezier(.2,.8,.3,1)',
        opacity: leaving ? 0 : 1,
        willChange: 'transform',
      }}
    >
      {children}

      {/* What is about to happen, shown while the finger is still down. */}
      {pending && progress > 0.08 && (
        <div aria-hidden style={{
          position: 'absolute', inset: 0, borderRadius: 20, pointerEvents: 'none',
          background: `rgba(${TINT[pending]},${0.10 + progress * 0.28})`,
          border: `3px solid rgba(${TINT[pending]},${0.25 + progress * 0.75})`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <span style={{
            fontSize: 20, fontWeight: 800, letterSpacing: 0.5,
            color: `rgb(${TINT[pending]})`, background: 'rgba(255,255,255,.94)',
            padding: '10px 20px', borderRadius: 999,
            transform: `scale(${0.85 + progress * 0.3})`,
            boxShadow: '0 4px 14px rgba(0,0,0,.12)',
          }}>
            {pending === 'right' ? '✓  Done' : pending === 'left' ? '↻  Not now' : '!  Problem'}
          </span>
        </div>
      )}
    </div>
  );
}
