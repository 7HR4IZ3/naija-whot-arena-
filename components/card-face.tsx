import type { CSSProperties, MouseEventHandler } from "react";
import { actionLabel, type Card, SUIT_META } from "@/lib/cards";

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
  const style = { "--card-accent": SUIT_META[card.suit].color } as CSSProperties;
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
      <div className={classes} style={style} aria-label="Face down card">
        <span>W!</span>
      </div>
    );
  }

  const label = `${SUIT_META[card.suit].label} ${card.value}${actionLabel(card) ? ` — ${actionLabel(card)}` : ""}`;

  if (onClick) {
    return (
      <button className={classes} style={style} onClick={onClick} disabled={disabled} aria-label={label} type="button">
        <span className="card-number">{card.value}</span>
        <span className="card-symbol-word">{SUIT_META[card.suit].short}</span>
        {card.suit === "whot" && <span className="card-score">W!</span>}
        <span className="card-number-bottom">{card.value}</span>
      </button>
    );
  }

  return (
    <div className={classes} style={style} aria-label={label} role="img">
      <span className="card-number">{card.value}</span>
      <span className="card-symbol-word">{SUIT_META[card.suit].short}</span>
      {card.suit === "whot" && <span className="card-score">W!</span>}
      <span className="card-number-bottom">{card.value}</span>
    </div>
  );
}
