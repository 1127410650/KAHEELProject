import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

/**
 * Renders children into a body-level container (#print-root) that is hidden on
 * screen and is the only visible element when printing. This guarantees a real
 * print template inside the DOM instead of relying on a dialog portal that the
 * browser may not paint on the printed page.
 */
export function PrintPortal({ children }: { children: ReactNode }) {
  const [host, setHost] = useState<HTMLElement | null>(null);

  useEffect(() => {
    let node = document.getElementById("print-root");
    if (!node) {
      node = document.createElement("div");
      node.id = "print-root";
      document.body.appendChild(node);
    }
    setHost(node);
  }, []);

  if (!host) return null;
  return createPortal(children, host);
}
