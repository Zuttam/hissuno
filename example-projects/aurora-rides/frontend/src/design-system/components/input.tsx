import { forwardRef, InputHTMLAttributes, ReactNode, useId } from "react";
import clsx from "classnames";
import { ensureStyleSheet } from "../style-helpers";

type InputTone = "default" | "danger" | "success" | "warning";

export type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  hint?: string;
  error?: string;
  description?: string;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
  tone?: InputTone;
};

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, hint, error, description, className, id, leadingIcon, trailingIcon, tone = "default", ...props },
  ref
) {
  ensureStyleSheet("aurora-input-styles", inputStyles);

  const generatedId = useId();
  const controlId = id ?? props.name ?? generatedId;
  const descriptionId = description ? `${controlId}-description` : undefined;
  const hintId = hint && !error ? `${controlId}-hint` : undefined;
  const errorId = error ? `${controlId}-error` : undefined;

  return (
    <label className={clsx("aurora-input", className)} htmlFor={controlId}>
      {label && (
        <span className="aurora-input__label">
          {label}
        </span>
      )}

      {description && <span className="aurora-input__description">{description}</span>}

      <span className={clsx("aurora-input__control-wrapper", `aurora-input__control-wrapper--${tone}`)}>
        {leadingIcon && <span className="aurora-input__icon">{leadingIcon}</span>}
        <input
          id={controlId}
          ref={ref}
          className="aurora-input__control"
          aria-invalid={Boolean(error)}
          aria-describedby={[descriptionId, hintId, errorId].filter(Boolean).join(" ") || undefined}
          {...props}
        />
        {trailingIcon && <span className="aurora-input__icon aurora-input__icon--trailing">{trailingIcon}</span>}
      </span>

      {hint && !error && (
        <span className="aurora-input__hint" id={hintId}>
          {hint}
        </span>
      )}
      {error && (
        <span className="aurora-input__error" id={errorId}>
          {error}
        </span>
      )}
    </label>
  );
});

const inputStyles = `
  .aurora-input {
    display: flex;
    flex-direction: column;
    gap: var(--aurora-space-2xs);
    color: var(--aurora-color-textPrimary);
    font-family: var(--aurora-type-family-body);
  }

  .aurora-input__label {
    font-size: var(--aurora-type-size-sm);
    font-weight: var(--aurora-type-weight-medium);
    letter-spacing: 0.02em;
  }

  .aurora-input__description {
    font-size: var(--aurora-type-size-xs);
    color: var(--aurora-color-textFaint);
  }

  .aurora-input__control-wrapper {
    display: flex;
    align-items: center;
    gap: var(--aurora-space-xs);
    padding: 0 var(--aurora-space-sm);
    border-radius: var(--aurora-radius-md);
    border: 1px solid var(--aurora-color-border);
    background: rgba(10, 20, 40, 0.72);
    transition: border-color var(--aurora-transition-default), box-shadow var(--aurora-transition-default);
  }

  .aurora-input__control-wrapper:focus-within {
    border-color: var(--aurora-color-accent);
    box-shadow: var(--aurora-shadow-focus);
  }

  .aurora-input__control-wrapper--danger {
    border-color: rgba(249, 112, 112, 0.45);
  }

  .aurora-input__control-wrapper--success {
    border-color: rgba(52, 211, 153, 0.45);
  }

  .aurora-input__control-wrapper--warning {
    border-color: rgba(250, 204, 21, 0.45);
  }

  .aurora-input__control {
    flex: 1;
    border: 0;
    background: transparent;
    color: inherit;
    font-size: var(--aurora-type-size-sm);
    padding: var(--aurora-space-sm) 0;
    outline: none;
    min-height: 44px;
  }

  .aurora-input__icon {
    display: inline-flex;
    align-items: center;
    color: var(--aurora-color-textSecondary);
  }

  .aurora-input__icon--trailing {
    color: var(--aurora-color-textFaint);
  }

  .aurora-input__hint,
  .aurora-input__error {
    font-size: var(--aurora-type-size-xs);
  }

  .aurora-input__hint {
    color: var(--aurora-color-textFaint);
  }

  .aurora-input__error {
    color: var(--aurora-color-danger);
  }
`;

