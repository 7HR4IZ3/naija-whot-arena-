import Image from "next/image";
import type { MouseEventHandler } from "react";
import { actionLabel, CARD_ART, type Card, SUIT_META } from "@/lib/cards";

type CardFaceProps = {
  card: Card;
  size?: "sm" | "md" | "lg";
  hidden?: boolean;
  selected?: boolean;
  disabled?: boolean;
  onClick?: MouseEventHandler<HTMLButtonElement>;
  className?: string;
};

export function CardFace({
  card,
  size = "md",
  hidden = false,
  selected = false,
  disabled = false,
  onClick,
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
        <span>W!</span>
      </div>
    );
  }

  const label = `${SUIT_META[card.suit].label} ${card.value}${actionLabel(card) ? ` — ${actionLabel(card)}` : ""}`;

  if (onClick) {
    return (
      <button className={classes} onClick={onClick} disabled={disabled} aria-label={label} type="button">
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
    <>
      <span className={`card-art-frame${card.suit === "whot" ? " card-art-whot" : ""}`}>
        <Image alt="" className="card-art-image" fill sizes="(max-width: 760px) 82px, 156px" src={CARD_ART[card.suit]} unoptimized />
      </span>
      <span className="card-number card-corner">{card.value}</span>
      {card.suit === "whot" && <span className="card-score">W!</span>}
      <span className="card-number-bottom card-corner">{card.value}</span>
    </>
  );
}
