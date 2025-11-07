const cache = new Set<string>();

export const ensureStyleSheet = (id: string, css: string) => {
  if (cache.has(id)) return;

  if (typeof document === "undefined") return;

  const existing = document.getElementById(id);
  if (existing) {
    cache.add(id);
    return;
  }

  const styleTag = document.createElement("style");
  styleTag.id = id;
  styleTag.textContent = css;
  document.head.append(styleTag);
  cache.add(id);
};

