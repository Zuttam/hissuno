import { HTMLAttributes } from "react";
import clsx from "classnames";
import { ensureStyleSheet } from "../style-helpers";

type TagTone = "neutral" | "info" | "success" | "warning" | "danger";
type TagVariantStyle = "solid" | "soft" | "outline";
export type TagVariant = TagVariantStyle | TagTone | "default" | "primary" | "secondary";

type TagProps = HTMLAttributes<HTMLSpanElement> & {
  tone?: TagTone;
  variant?: TagVariant;
};

export const Tag = ({ tone, variant = "soft", className, children, ...props }: TagProps) => {
  ensureStyleSheet("aurora-tag-styles", tagStyles);
  
  // Handle when variant is used for tone (backward compatibility)
  let effectiveTone: TagTone = tone || "neutral";
  let effectiveVariant: TagVariantStyle = "soft";
  
  if (variant === "success" || variant === "warning" || variant === "danger" || variant === "info") {
    effectiveTone = variant;
    effectiveVariant = "soft";
  } else if (variant === "default") {
    effectiveTone = "neutral";
    effectiveVariant = "soft";
  } else if (variant === "primary" || variant === "secondary") {
    effectiveVariant = "soft";
  } else {
    effectiveVariant = variant as TagVariantStyle;
  }
  
  return (
    <span className={clsx("aurora-tag", `aurora-tag--${effectiveTone}`, `aurora-tag--${effectiveVariant}`, className)} {...props}>
      {children}
    </span>
  );
};

const tagStyles = `
  .aurora-tag {
    display: inline-flex;
    align-items: center;
    gap: var(--aurora-space-2xs);
    padding: 0.2rem 0.55rem;
    border-radius: var(--aurora-radius-pill);
    font-size: var(--aurora-type-size-xs);
    letter-spacing: 0.05em;
    text-transform: uppercase;
    font-weight: var(--aurora-type-weight-medium);
    border: 1px solid transparent;
    background: rgba(148, 163, 184, 0.12);
    color: var(--aurora-color-textPrimary);
  }

  .aurora-tag--solid {
    color: #031526;
  }

  .aurora-tag--outline {
    background: transparent;
  }

  .aurora-tag--neutral.aurora-tag--soft {
    background: rgba(148, 163, 184, 0.18);
    color: var(--aurora-color-textPrimary);
  }
  .aurora-tag--neutral.aurora-tag--solid {
    background: var(--aurora-color-textFaint);
  }
  .aurora-tag--neutral.aurora-tag--outline {
    border-color: rgba(148, 163, 184, 0.35);
    color: var(--aurora-color-textSecondary);
  }

  .aurora-tag--info.aurora-tag--soft {
    background: rgba(56, 189, 248, 0.2);
    color: var(--aurora-color-info);
  }
  .aurora-tag--info.aurora-tag--solid {
    background: var(--aurora-color-info);
  }
  .aurora-tag--info.aurora-tag--outline {
    border-color: rgba(56, 189, 248, 0.55);
    color: var(--aurora-color-info);
  }

  .aurora-tag--success.aurora-tag--soft {
    background: rgba(52, 211, 153, 0.2);
    color: var(--aurora-color-success);
  }
  .aurora-tag--success.aurora-tag--solid {
    background: var(--aurora-color-success);
  }
  .aurora-tag--success.aurora-tag--outline {
    border-color: rgba(52, 211, 153, 0.6);
    color: var(--aurora-color-success);
  }

  .aurora-tag--warning.aurora-tag--soft {
    background: rgba(250, 204, 21, 0.22);
    color: var(--aurora-color-warning);
  }
  .aurora-tag--warning.aurora-tag--solid {
    background: var(--aurora-color-warning);
  }
  .aurora-tag--warning.aurora-tag--outline {
    border-color: rgba(250, 204, 21, 0.6);
    color: var(--aurora-color-warning);
  }

  .aurora-tag--danger.aurora-tag--soft {
    background: rgba(249, 112, 112, 0.22);
    color: var(--aurora-color-danger);
  }
  .aurora-tag--danger.aurora-tag--solid {
    background: var(--aurora-color-danger);
  }
  .aurora-tag--danger.aurora-tag--outline {
    border-color: rgba(249, 112, 112, 0.55);
    color: var(--aurora-color-danger);
  }
`;

