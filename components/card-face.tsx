import Image from "next/image";
import type { MouseEventHandler, PointerEventHandler } from "react";
import { actionLabel, type Card, SUIT_META } from "@/lib/cards";

type CardFaceProps = {
  card: Card;
  size?: "sm" | "md" | "lg";
  hidden?: boolean;
  selected?: boolean;
  disabled?: boolean;
  onClick?: MouseEventHandler<HTMLButtonElement>;
  onPointerDown?: PointerEventHandler<HTMLButtonElement>;
  onPointerMove?: PointerEventHandler<HTMLButtonElement>;
  onPointerUp?: PointerEventHandler<HTMLButtonElement>;
  onPointerCancel?: PointerEventHandler<HTMLButtonElement>;
  className?: string;
};

export function CardFace({
  card,
  size = "md",
  hidden = false,
  selected = false,
  disabled = false,
  onClick,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
  className = "",
}: CardFaceProps) {
  const classes = [
    "whot-card",
    `card-${card.suit}`,
    `card-${size}`,
    onClick ? "is-clickable" : "",
    selected ? "selected" : "",
    hidden ? "card-back" : "",
    className,
  ].filter(Boolean).join(" ");

  if (hidden) {
    return (
      <div className={classes} aria-label="Face down card">
        <Image src="/cards/classic/back.svg" alt="" width={200} height={300} unoptimized />
      </div>
    );
  }

  const label = `${SUIT_META[card.suit].label} ${card.value}${actionLabel(card) ? ` — ${actionLabel(card)}` : ""}`;

  if (onClick) {
    return (
      <button className={classes} data-card-id={card.id} draggable={false} onClick={onClick} onPointerCancel={onPointerCancel} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} disabled={disabled} aria-label={label} type="button">
        <CardVisual card={card} />
      </button>
    );
  }

  return (
    <div className={classes} aria-label={label} role="img">
      <CardVisual card={card} />
    </div>
  );
}

function CardVisual({ card }: { card: Card }) {
  return (
    <Image alt="" className="card-art-image" width={200} height={300} src={`/cards/classic/${card.suit}-${card.value}.svg`} loading="eager" unoptimized />
  );
}
