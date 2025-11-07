import { ButtonHTMLAttributes, ReactNode } from "react";
import clsx from "classnames";
import { ensureStyleSheet } from "../style-helpers";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
  loading?: boolean;
  fullWidth?: boolean;
};

const sizeClassMap: Record<NonNullable<ButtonProps["size"]>, string> = {
  sm: "aurora-button--sm",
  md: "aurora-button--md",
  lg: "aurora-button--lg"
};

export const Button = ({
  variant = "primary",
  size = "md",
  className,
  leadingIcon,
  trailingIcon,
  children,
  loading = false,
  fullWidth,
  disabled,
  ...props
}: ButtonProps) => {
  ensureStyleSheet("aurora-button-styles", buttonStyles);

  const showLoader = loading ?? false;
  const isDisabled = disabled ?? showLoader;

  return (
    <button
      className={clsx(
        "aurora-button", 
        `aurora-button--${variant}`, 
        sizeClassMap[size], 
        { loading: showLoader },
        fullWidth && "aurora-button--full-width",
        className
      )}
      disabled={isDisabled}
      {...props}
    >
      {showLoader && <span className="aurora-button__spinner" aria-hidden />}
      {!showLoader && leadingIcon && <span className="aurora-button__icon">{leadingIcon}</span>}
      <span className="aurora-button__content">{children}</span>
      {!showLoader && trailingIcon && <span className="aurora-button__icon">{trailingIcon}</span>}
    </button>
  );
};

const buttonStyles = `
  .aurora-button {
    --aurora-button-padding-y: var(--aurora-space-sm);
    --aurora-button-padding-x: calc(var(--aurora-space-lg) * 0.9);
    --aurora-button-height: 44px;
    --aurora-button-radius: var(--aurora-radius-md);

    appearance: none;
    border: 1px solid transparent;
    border-radius: var(--aurora-button-radius);
    background: var(--aurora-color-accent);
    color: #031526;
    font-family: var(--aurora-type-family-body);
    font-weight: var(--aurora-type-weight-semibold);
    font-size: var(--aurora-type-size-sm);
    line-height: 1;
    letter-spacing: 0.01em;
    padding: calc(var(--aurora-button-padding-y)) calc(var(--aurora-button-padding-x));
    min-height: var(--aurora-button-height);
    display: inline-flex;
    gap: 0.55rem;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: transform var(--aurora-transition-default), box-shadow var(--aurora-transition-default), border-color var(--aurora-transition-default);
    position: relative;
  }

  .aurora-button:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: var(--aurora-shadow-glow);
  }

  .aurora-button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .aurora-button--full-width {
    width: 100%;
  }

  .aurora-button__content {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
  }

  .aurora-button__icon {
    display: inline-flex;
    align-items: center;
  }

  .aurora-button__spinner {
    width: 1.1rem;
    height: 1.1rem;
    border-radius: 999px;
    border: 2px solid rgba(3, 21, 38, 0.25);
    border-top-color: rgba(3, 21, 38, 0.6);
    animation: aurora-spin 700ms linear infinite;
  }

  .aurora-button.loading .aurora-button__content {
    opacity: 0.65;
  }

  .aurora-button--primary {
    background: linear-gradient(135deg, var(--aurora-color-accent), #4ade80);
    color: #031526;
  }

  .aurora-button--primary:focus-visible {
    outline: none;
    box-shadow: var(--aurora-shadow-focus);
  }

  .aurora-button--secondary {
    background: var(--aurora-color-surface);
    color: var(--aurora-color-textPrimary);
    border-color: var(--aurora-color-accentMuted);
  }

  .aurora-button--ghost {
    background: transparent;
    color: var(--aurora-color-textPrimary);
    border-color: transparent;
  }

  .aurora-button--ghost:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.05);
  }

  .aurora-button--danger {
    background: var(--aurora-color-danger);
    color: white;
  }

  .aurora-button--danger:hover:not(:disabled) {
    background: rgba(239, 68, 68, 0.9);
  }

  .aurora-button--sm {
    --aurora-button-height: 36px;
    --aurora-button-padding-y: 0.5rem;
    font-size: var(--aurora-type-size-xs);
  }

  .aurora-button--lg {
    --aurora-button-height: 52px;
    --aurora-button-padding-y: var(--aurora-space-md);
    font-size: var(--aurora-type-size-md);
  }

  @keyframes aurora-spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }
`;

