/**
 * Touch-drag controller for mobile/tablet drag-and-drop.
 *
 * HTML5 dnd (onDragStart / onDragOver / onDrop) is desktop-only — touch
 * devices don't fire those events. This controller adds a parallel touch
 * path: on touchstart, it captures the dragged payload, creates a floating
 * ghost element that follows the finger, highlights any element marked with
 * `data-drop-zone="<id>"` under the touch point, and fires `onDrop(zoneId)`
 * on touchend.
 *
 * Usage:
 *   <Card
 *     onTouchStart={(e) => startTouchDrag(e, {
 *       data: task.id,
 *       ghostLabel: task.title,
 *       onDrop: (zoneId) => zoneId && moveTask(task.id, zoneId as Status),
 *     })}
 *   />
 *
 *   <Column data-drop-zone="todo">…</Column>
 *
 * Notes:
 * - Only one drag can be active at a time; a second touchstart while a drag
 *   is in flight is ignored.
 * - Holds for ~120ms before starting the drag so a quick tap still works as
 *   a normal tap/click.
 * - During drag we preventDefault on touchmove so the page doesn't scroll.
 */

type DragOpts = {
  data: string;
  ghostLabel: string;
  onDrop: (zoneId: string | null) => void;
};

type ActiveDrag = {
  opts: DragOpts;
  ghost: HTMLDivElement;
  currentZone: HTMLElement | null;
  pointerId: number;
  startX: number;
  startY: number;
  started: boolean; // true once we've passed the hold threshold
  holdTimer: ReturnType<typeof setTimeout> | null;
};

const HOLD_MS = 120;
const MOVE_THRESHOLD_PX = 6;

let active: ActiveDrag | null = null;

function findDropZone(x: number, y: number): HTMLElement | null {
  const el = document.elementFromPoint(x, y);
  if (!el) return null;
  let node: HTMLElement | null = el as HTMLElement;
  while (node) {
    if (node.dataset?.dropZone) return node;
    node = node.parentElement;
  }
  return null;
}

function buildGhost(label: string): HTMLDivElement {
  const g = document.createElement("div");
  g.textContent = label;
  g.style.cssText = `
    position: fixed;
    z-index: 9999;
    pointer-events: none;
    padding: 6px 10px;
    border-radius: 10px;
    background: rgba(255,255,255,0.96);
    color: #1e1e24;
    font-size: 12px;
    font-weight: 600;
    box-shadow: 0 8px 24px -8px rgba(0,0,0,0.35), 0 2px 6px rgba(0,0,0,0.18);
    border: 1px solid rgba(0,0,0,0.08);
    max-width: 240px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    transform: translate(-50%, -50%) scale(0.98);
    transition: transform 80ms ease-out;
    opacity: 0;
  `;
  document.body.appendChild(g);
  requestAnimationFrame(() => {
    g.style.opacity = "1";
    g.style.transform = "translate(-50%, -50%) scale(1)";
  });
  return g;
}

function clearZoneHighlight(zone: HTMLElement | null) {
  if (zone) zone.removeAttribute("data-drop-active");
}

function setZoneHighlight(zone: HTMLElement | null) {
  if (zone) zone.setAttribute("data-drop-active", "true");
}

function moveGhost(x: number, y: number) {
  if (!active) return;
  active.ghost.style.left = `${x}px`;
  active.ghost.style.top = `${y}px`;
}

function commitDrop() {
  if (!active) return;
  const zoneId = active.currentZone?.dataset.dropZone ?? null;
  clearZoneHighlight(active.currentZone);
  active.opts.onDrop(zoneId);
  cleanup();
}

function cancelDrag() {
  if (!active) return;
  clearZoneHighlight(active.currentZone);
  active.opts.onDrop(null);
  cleanup();
}

function cleanup() {
  if (!active) return;
  if (active.holdTimer) clearTimeout(active.holdTimer);
  active.ghost.remove();
  document.removeEventListener("touchmove", onTouchMove);
  document.removeEventListener("touchend", onTouchEnd);
  document.removeEventListener("touchcancel", onTouchCancel);
  active = null;
}

function onTouchMove(e: TouchEvent) {
  if (!active) return;
  const t = Array.from(e.touches).find(
    (touch) => touch.identifier === active!.pointerId,
  );
  if (!t) return;

  if (!active.started) {
    const dx = Math.abs(t.clientX - active.startX);
    const dy = Math.abs(t.clientY - active.startY);
    if (dx + dy < MOVE_THRESHOLD_PX) return;
    // User moved enough — start the drag immediately
    if (active.holdTimer) {
      clearTimeout(active.holdTimer);
      active.holdTimer = null;
    }
    active.started = true;
  }

  e.preventDefault();
  moveGhost(t.clientX, t.clientY);
  const zone = findDropZone(t.clientX, t.clientY);
  if (zone !== active.currentZone) {
    clearZoneHighlight(active.currentZone);
    setZoneHighlight(zone);
    active.currentZone = zone;
  }
}

function onTouchEnd(e: TouchEvent) {
  if (!active) return;
  const t = Array.from(e.changedTouches).find(
    (touch) => touch.identifier === active!.pointerId,
  );
  if (!t) return;
  if (!active.started) {
    // Never crossed the hold/move threshold — treat as a tap, do nothing.
    cleanup();
    return;
  }
  commitDrop();
}

function onTouchCancel() {
  cancelDrag();
}

/**
 * Call from `onTouchStart` on a draggable element. Captures the first touch
 * and arms a drag session that will commit on touchend.
 */
export function startTouchDrag(
  event: React.TouchEvent | TouchEvent,
  opts: DragOpts,
): void {
  if (active) return;
  if (event.touches.length !== 1) return;
  const t = event.touches[0];
  const ghost = buildGhost(opts.ghostLabel);
  ghost.style.left = `${t.clientX}px`;
  ghost.style.top = `${t.clientY}px`;

  active = {
    opts,
    ghost,
    currentZone: null,
    pointerId: t.identifier,
    startX: t.clientX,
    startY: t.clientY,
    started: false,
    holdTimer: setTimeout(() => {
      if (active) active.started = true;
    }, HOLD_MS),
  };

  // Listen on document so the drag continues even if the finger leaves
  // the original element. `passive: false` lets us preventDefault on move
  // to suppress page scroll while dragging.
  document.addEventListener("touchmove", onTouchMove, { passive: false });
  document.addEventListener("touchend", onTouchEnd);
  document.addEventListener("touchcancel", onTouchCancel);
}
