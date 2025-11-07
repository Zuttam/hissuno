import { HTMLAttributes } from "react";
import clsx from "classnames";
import { ensureStyleSheet } from "../style-helpers";

type GridProps = HTMLAttributes<HTMLDivElement> & {
  columns?: number | string;
  gap?: "sm" | "md" | "lg" | "xl";
  minColumnWidth?: string;
};

type StackProps = HTMLAttributes<HTMLDivElement> & {
  gap?: "sm" | "md" | "lg";
  align?: "start" | "center" | "end" | "stretch";
  direction?: "row" | "column";
  distribute?: "start" | "center" | "end" | "space-between";
};

const gapMap = {
  sm: "var(--aurora-space-sm)",
  md: "var(--aurora-space-md)",
  lg: "var(--aurora-space-lg)",
  xl: "var(--aurora-space-xl)"
} as const;

export const Page = ({ className, ...props }: HTMLAttributes<HTMLDivElement>) => {
  ensureStyleSheet("aurora-layout-styles", layoutStyles);
  return <div className={clsx("aurora-page", className)} {...props} />;
};

export const PageHeader = ({ className, ...props }: HTMLAttributes<HTMLElement>) => {
  ensureStyleSheet("aurora-layout-styles", layoutStyles);
  return <header className={clsx("aurora-page__header", className)} {...props} />;
};

export const Grid = ({
  columns = 3,
  gap = "md",
  minColumnWidth,
  className,
  style,
  ...props
}: GridProps) => {
  ensureStyleSheet("aurora-layout-styles", layoutStyles);
  const gridTemplateColumns =
    typeof columns === "number"
      ? `repeat(${columns}, minmax(${minColumnWidth ?? "0"}, 1fr))`
      : columns;

  return (
    <div
      className={clsx("aurora-grid", className)}
      style={{
        display: "grid",
        gap: gapMap[gap],
        gridTemplateColumns,
        ...style
      }}
      {...props}
    />
  );
};

export const Stack = ({
  gap = "md",
  direction = "column",
  align = "stretch",
  distribute = "start",
  className,
  style,
  ...props
}: StackProps) => {
  ensureStyleSheet("aurora-layout-styles", layoutStyles);
  return (
    <div
      className={clsx("aurora-stack", className)}
      style={{
        display: "flex",
        flexDirection: direction,
        alignItems: align,
        justifyContent: distribute,
        gap: gapMap[gap],
        ...style
      }}
      {...props}
    />
  );
};

export const Section = ({ className, ...props }: HTMLAttributes<HTMLElement>) => {
  ensureStyleSheet("aurora-layout-styles", layoutStyles);
  return <section className={clsx("aurora-section", className)} {...props} />;
};

const layoutStyles = `
  .aurora-page {
    width: min(1180px, 100%);
    margin: 0 auto;
    padding: var(--aurora-space-xl) var(--aurora-space-lg);
    display: flex;
    flex-direction: column;
    gap: var(--aurora-space-xl);
  }

  .aurora-page__header {
    display: flex;
    flex-direction: column;
    gap: var(--aurora-space-sm);
  }

  .aurora-page__header h1 {
    margin: 0;
    font-family: var(--aurora-type-family-heading);
    font-size: calc(var(--aurora-type-size-xl) * 1.2);
  }

  .aurora-page__header p {
    margin: 0;
    color: var(--aurora-color-textSecondary);
  }

  .aurora-section {
    display: flex;
    flex-direction: column;
    gap: var(--aurora-space-md);
    padding: calc(var(--aurora-space-xl) * 0.75);
    border-radius: var(--aurora-radius-lg);
    border: 1px solid rgba(148, 163, 184, 0.14);
    background: rgba(12, 23, 45, 0.65);
    backdrop-filter: blur(14px);
  }

  .aurora-section h2 {
    margin: 0;
    font-size: var(--aurora-type-size-lg);
    font-family: var(--aurora-type-family-heading);
  }

  .aurora-section p {
    margin: 0;
    color: var(--aurora-color-textSecondary);
    line-height: var(--aurora-type-lineHeight-relaxed);
  }
`;

