"use client";

import { useLayoutEffect, useRef } from "react";
import type { ComponentProps } from "react";

// Auto-grows a textarea to fit its content, up to its CSS max-height.
export function useTextareaResize(value: ComponentProps<"textarea">["value"], rows = 1) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useLayoutEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    const cs = window.getComputedStyle(el);
    const lineHeight = Number.parseInt(cs.lineHeight, 10) || 20;
    const padding = Number.parseInt(cs.paddingTop, 10) + Number.parseInt(cs.paddingBottom, 10);
    const minHeight = lineHeight * rows + padding;
    el.style.height = "0px";
    el.style.height = `${Math.max(el.scrollHeight, minHeight) + 2}px`;
  }, [value, rows]);

  return textareaRef;
}