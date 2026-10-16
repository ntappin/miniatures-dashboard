export type Measure = "models" | "pts";

const nf = new Intl.NumberFormat("en");
export const fmt = (v: number) => nf.format(Math.round(v * 10) / 10);
export const one = (v: number) => (Math.round(v * 10) / 10).toFixed(1);
export const pct = (v: number) => (v * 100).toFixed(1) + "%";
export const $ = (id: string) => document.getElementById(id)!;

export function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

/** A figure like "4,755 pts · 146 models", with the units in small type. */
export function pair(target: HTMLElement, a: string, aUnit: string, b: string, bUnit: string) {
  target.replaceChildren(document.createTextNode(a + " "), el("small", undefined, aUnit + " · "), document.createTextNode(b + " "), el("small", undefined, bUnit));
}

// Tooltips -----------------------------------------------------------------
export function tooltip(card: HTMLElement) {
  const tip = el("div", "tip");
  tip.hidden = true;
  card.append(tip);
  return {
    show(e: MouseEvent, title: string, lines: [string | null, string][], extra?: (tip: HTMLElement) => void) {
      tip.replaceChildren(el("div", "t", title));
      for (const [color, text] of lines) {
        const d = el("div");
        if (color) {
          const s = el("i", "sw");
          s.style.background = color;
          d.append(s);
        }
        d.append(document.createTextNode(text));
        tip.append(d);
      }
      extra?.(tip);
      tip.hidden = false;
      const box = card.getBoundingClientRect();
      const x = Math.min(e.clientX - box.left + 12, box.width - tip.offsetWidth - 6);
      tip.style.left = Math.max(6, x) + "px";
      tip.style.top = e.clientY - box.top + 14 + "px";
    },
    hide() {
      tip.hidden = true;
    },
  };
}

