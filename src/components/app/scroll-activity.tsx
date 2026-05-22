"use client";

import { useEffect } from "react";

const SCROLL_HIDE_DELAY_MS = 850;

function getScrollElement(target: EventTarget | null) {
  if (target === document || target === window) {
    return document.scrollingElement ?? document.documentElement;
  }

  return target instanceof Element ? target : document.documentElement;
}

export function ScrollActivity() {
  useEffect(() => {
    const timers = new Map<Element, number>();

    const markScrolling = (element: Element) => {
      element.setAttribute("data-scrolling", "true");

      const existingTimer = timers.get(element);
      if (existingTimer) {
        window.clearTimeout(existingTimer);
      }

      const timer = window.setTimeout(() => {
        element.removeAttribute("data-scrolling");
        timers.delete(element);
      }, SCROLL_HIDE_DELAY_MS);

      timers.set(element, timer);
    };

    const handleScroll = (event: Event) => {
      markScrolling(getScrollElement(event.target));
    };

    document.addEventListener("scroll", handleScroll, {
      capture: true,
      passive: true,
    });
    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      document.removeEventListener("scroll", handleScroll, { capture: true });
      window.removeEventListener("scroll", handleScroll);
      timers.forEach((timer, element) => {
        window.clearTimeout(timer);
        element.removeAttribute("data-scrolling");
      });
      timers.clear();
    };
  }, []);

  return null;
}
