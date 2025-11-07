import { HTMLAttributes, ReactNode } from "react";
import clsx from "classnames";
import { ensureStyleSheet } from "../style-helpers";

type CardVariant = "default" | "highlight" | "glass";
type CardTone = "neutral" | "positive" | "warning" | "danger";

type CardProps = HTMLAttributes<HTMLDivElement> & {
  variant?: CardVariant;
  interactive?: boolean;
  hover?: boolean;
  tone?: CardTone;
};

export const Card = ({ className, variant = "default", interactive = false, hover = false, tone = "neutral", ...props }: CardProps) => {
  ensureStyleSheet("aurora-card-styles", cardStyles);

  return (
    <article className={clsx("aurora-card", `aurora-card--${variant}`, `aurora-card--tone-${tone}`, { interactive: interactive || hover }, className)} {...props} />
  );
};

type CardSectionProps = HTMLAttributes<HTMLDivElement> & {
  leadingAccessory?: ReactNode;
  trailingAccessory?: ReactNode;
};

export const CardHeader = ({ className, leadingAccessory, trailingAccessory, children, ...props }: CardSectionProps) => (
  <header className={clsx("aurora-card__section", "aurora-card__header", className)} {...props}>
    {leadingAccessory && <div className="aurora-card__accessory">{leadingAccessory}</div>}
    <div className="aurora-card__body">{children}</div>
    {trailingAccessory && <div className="aurora-card__accessory">{trailingAccessory}</div>}
  </header>
);

export const CardContent = ({ className, ...props }: HTMLAttributes<HTMLDivElement>) => (
  <div className={clsx("aurora-card__section", "aurora-card__content", className)} {...props} />
);

export const CardFooter = ({ className, ...props }: HTMLAttributes<HTMLDivElement>) => (
  <footer className={clsx("aurora-card__section", "aurora-card__footer", className)} {...props} />
);

const cardStyles = `
  .aurora-card {
    display: flex;
    flex-direction: column;
    gap: var(--aurora-space-md);
    padding: calc(var(--aurora-space-lg) * 0.9);
    border-radius: var(--aurora-radius-lg);
    border: 1px solid var(--aurora-color-border);
    background: var(--aurora-gradient-card);
    color: var(--aurora-color-textPrimary);
    box-shadow: var(--aurora-shadow-soft);
    position: relative;
    overflow: hidden;
    transition: transform var(--aurora-transition-default), border-color var(--aurora-transition-default), box-shadow var(--aurora-transition-default);
  }

  .aurora-card::before {
    content: "";
    position: absolute;
    inset: -60%;
    opacity: 0;
    background: radial-gradient(circle at top left, rgba(94, 234, 212, 0.25), transparent 60%);
    transition: opacity var(--aurora-transition-slow);
  }

  .aurora-card.interactive:hover {
    transform: translateY(-2px);
    border-color: rgba(94, 234, 212, 0.35);
    box-shadow: var(--aurora-shadow-glow);
  }

  .aurora-card.interactive:hover::before {
    opacity: 1;
  }

  .aurora-card--glass {
    background: rgba(13, 27, 60, 0.72);
    backdrop-filter: blur(18px);
  }

  .aurora-card--highlight {
    border-color: rgba(94, 234, 212, 0.4);
    background: linear-gradient(155deg, rgba(94, 234, 212, 0.12), rgba(59, 130, 246, 0.08));
  }

  .aurora-card--tone-positive {
    border-color: rgba(52, 211, 153, 0.35);
  }

  .aurora-card--tone-warning {
    border-color: rgba(250, 204, 21, 0.35);
  }

  .aurora-card--tone-danger {
    border-color: rgba(249, 112, 112, 0.35);
  }

  .aurora-card__section {
    display: flex;
    gap: var(--aurora-space-md);
    align-items: center;
  }

  .aurora-card__header {
    align-items: flex-start;
  }

  .aurora-card__accessory {
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: 2.25rem;
  }

  .aurora-card__body {
    flex: 1;
  }

  .aurora-card__body h3,
  .aurora-card__body h4,
  .aurora-card__body p {
    margin: 0;
  }

  .aurora-card__body p {
    color: var(--aurora-color-textSecondary);
  }
`;

