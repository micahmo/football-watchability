/**
 * Long press, and right-click, as one gesture.
 *
 * A Svelte action rather than handlers on each component, because the live card
 * and the planning row both need it and both already own their click behaviour.
 *
 * The awkward part is not detecting the press, it is suppressing what would
 * otherwise follow it. A card expands on click and a hidden one opens its reveal
 * prompt, so a press that fires has to swallow the click that arrives after the
 * finger lifts. `suppressClick` does that, once, in the capture phase.
 *
 * Right-click is bound too. There is no long press on a desktop, and this is the
 * one control on the board aimed at somebody sitting at a keyboard as often as
 * holding a phone.
 */
const HOLD_MS = 450;
/** A finger that travels this far was scrolling, not pressing. */
const SLOP_PX = 10;

export function longPress(node: HTMLElement, onLongPress: () => void) {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let startX = 0;
  let startY = 0;
  let fired = false;
  let handler = onLongPress;

  const clear = () => {
    if (timer !== null) clearTimeout(timer);
    timer = null;
  };

  const suppressClick = (event: Event) => {
    event.stopPropagation();
    event.preventDefault();
    node.removeEventListener("click", suppressClick, true);
  };

  const down = (event: PointerEvent) => {
    if (event.button !== 0 && event.pointerType === "mouse") return;
    fired = false;
    startX = event.clientX;
    startY = event.clientY;
    clear();
    timer = setTimeout(() => {
      fired = true;
      timer = null;
      // The click that follows the lift belongs to this press, not to the card.
      node.addEventListener("click", suppressClick, true);
      handler();
    }, HOLD_MS);
  };

  const move = (event: PointerEvent) => {
    if (timer === null) return;
    if (Math.abs(event.clientX - startX) > SLOP_PX || Math.abs(event.clientY - startY) > SLOP_PX) {
      clear();
    }
  };

  const up = () => clear();

  const context = (event: MouseEvent) => {
    event.preventDefault();
    handler();
  };

  node.addEventListener("pointerdown", down);
  node.addEventListener("pointermove", move);
  node.addEventListener("pointerup", up);
  node.addEventListener("pointercancel", up);
  node.addEventListener("pointerleave", up);
  node.addEventListener("contextmenu", context);

  return {
    update(next: () => void) {
      handler = next;
    },
    destroy() {
      clear();
      node.removeEventListener("pointerdown", down);
      node.removeEventListener("pointermove", move);
      node.removeEventListener("pointerup", up);
      node.removeEventListener("pointercancel", up);
      node.removeEventListener("pointerleave", up);
      node.removeEventListener("contextmenu", context);
      node.removeEventListener("click", suppressClick, true);
    },
  };
}
