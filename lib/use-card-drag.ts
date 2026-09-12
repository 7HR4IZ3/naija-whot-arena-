"use client";

import { useCallback, useEffect, useState, type PointerEventHandler } from "react";

type DragPoint = {
  id: string;
  pointerId: number;
  startX: number;
  startY: number;
  x: number;
  y: number;
  active: boolean;
};

type CardPointerHandlers = {
  onPointerDown: PointerEventHandler<HTMLButtonElement>;
  onPointerMove: PointerEventHandler<HTMLButtonElement>;
  onPointerUp: PointerEventHandler<HTMLButtonElement>;
  onPointerCancel: PointerEventHandler<HTMLButtonElement>;
  onLostPointerCapture: PointerEventHandler<HTMLButtonElement>;
};

type UseCardDragOptions = {
  disabled?: boolean;
  onDrop: (id: string) => void;
};

const DRAG_THRESHOLD = 8;

function isOverDropTarget(x: number, y: number) {
  if (typeof document === "undefined") return false;
  return Boolean(document.elementFromPoint(x, y)?.closest("[data-drop-target]"));
}

export function useCardDrag({ disabled = false, onDrop }: UseCardDragOptions) {
  const [drag, setDrag] = useState<DragPoint | null>(null);
  const [overTarget, setOverTarget] = useState(false);
  const [ignoreNextClick, setIgnoreNextClick] = useState(false);

  useEffect(() => {
    const cancel = () => { setDrag(null); setOverTarget(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") cancel(); };
    window.addEventListener("blur", cancel); window.addEventListener("keydown", escape);
    return () => { window.removeEventListener("blur", cancel); window.removeEventListener("keydown", escape); };
  }, []);

  const getCardHandlers = useCallback((id: string): CardPointerHandlers => {
    const start = (event: React.PointerEvent<HTMLButtonElement>) => {
      if (disabled || !event.isPrimary || (event.pointerType === "mouse" && event.button !== 0)) return;
      setIgnoreNextClick(false);
      setDrag({
        id,
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        x: event.clientX,
        y: event.clientY,
        active: false,
      });
      event.currentTarget.setPointerCapture(event.pointerId);
    };

    const move = (event: React.PointerEvent<HTMLButtonElement>) => {
      if (!drag || drag.pointerId !== event.pointerId) return;
      const distance = Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY);
      if (!drag.active && distance < DRAG_THRESHOLD) return;
      const next = { ...drag, active: true, x: event.clientX, y: event.clientY };
      setDrag(next);
      setOverTarget(isOverDropTarget(event.clientX, event.clientY));
      setIgnoreNextClick(true);
      event.preventDefault();
    };

    const finish = (event: React.PointerEvent<HTMLButtonElement>, cancelled: boolean) => {
      if (!drag || drag.pointerId !== event.pointerId) return;
      if (!disabled && drag.active && !cancelled && isOverDropTarget(event.clientX, event.clientY)) onDrop(drag.id);
      if (drag.active) setIgnoreNextClick(true);
      setDrag(null);
      setOverTarget(false);
      if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    };

    return {
      onPointerDown: start,
      onPointerMove: move,
      onPointerUp: (event) => finish(event, false),
      onPointerCancel: (event) => finish(event, true),
      onLostPointerCapture: () => { setDrag(null); setOverTarget(false); },
    };
  }, [disabled, drag, onDrop]);

  const consumeClick = useCallback(() => {
    if (!ignoreNextClick) return false;
    setIgnoreNextClick(false);
    return true;
  }, [ignoreNextClick]);

  return {
    draggingId: !disabled && drag?.active ? drag.id : null,
    dragPosition: !disabled && drag?.active ? { x: drag.x, y: drag.y } : null,
    overTarget: !disabled && overTarget,
    getCardHandlers,
    consumeClick,
  };
}
