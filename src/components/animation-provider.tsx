"use client";

import { useEffect } from "react";

const STAGGER_STEP_MS = 25;
const STAGGER_MAX_MS = 400;
const ANIMATION_DURATION_MS = 500;

function collectAnimatableElements(root: HTMLElement) {
  return [...root.getElementsByTagName("*")].filter(
    (el): el is HTMLElement =>
      el instanceof HTMLElement &&
      el.tagName !== "DIV" &&
      !el.classList.contains("sr-only")
  );
}

function animateMain(main: HTMLElement) {
  const animations: Animation[] = [];
  const revealedElements = new WeakSet<HTMLElement>();
  const observedElements = new WeakSet<HTMLElement>();
  let revealOrder = 0;

  const revealElement = (el: HTMLElement) => {
    if (revealedElements.has(el)) return;
    revealedElements.add(el);

    const delay = Math.min(revealOrder * STAGGER_STEP_MS, STAGGER_MAX_MS);
    revealOrder += 1;
    const animation = el.animate(
      [
        { opacity: 0, transform: "translateY(6px)" },
        { opacity: 1, transform: "translateY(0)" },
      ],
      {
        duration: ANIMATION_DURATION_MS,
        delay,
        fill: "both",
        easing: "ease-out",
      }
    );
    animations.push(animation);
  };

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const el = entry.target as HTMLElement;
        revealElement(el);
        observer.unobserve(el);
      });
    },
    { threshold: 0.1, rootMargin: "0px 0px -5% 0px" }
  );

  const registerElement = (el: HTMLElement) => {
    if (observedElements.has(el)) return;
    observedElements.add(el);
    observer.observe(el);
  };

  collectAnimatableElements(main).forEach(registerElement);

  const mutationObserver = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (!(node instanceof HTMLElement)) return;
        if (node.tagName !== "DIV" && !node.classList.contains("sr-only"))
          registerElement(node);
        collectAnimatableElements(node).forEach(registerElement);
      });
    });
  });

  mutationObserver.observe(main, { childList: true, subtree: true });

  return () => {
    observer.disconnect();
    mutationObserver.disconnect();
    animations.forEach((animation) => animation.cancel());
  };
}

export default function AnimationProvider() {
  useEffect(() => {
    let cleanupAnimation: (() => void) | undefined;
    let observedMain: HTMLElement | null = null;
    let raf = 0;

    const attachAnimation = () => {
      if (window.location.pathname.startsWith("/admin")) {
        cleanupAnimation?.();
        cleanupAnimation = undefined;
        observedMain = null;
        return;
      }

      const main = document.querySelector<HTMLElement>("main");
      if (!main || main === observedMain) return;

      cleanupAnimation?.();
      observedMain = main;
      cleanupAnimation = animateMain(main);
    };

    const scheduleAnimation = () => {
      window.cancelAnimationFrame(raf);
      raf = window.requestAnimationFrame(attachAnimation);
    };

    if (document.readyState === "complete") {
      scheduleAnimation();
    } else {
      window.addEventListener("load", scheduleAnimation, { once: true });
    }

    const documentObserver = new MutationObserver(() => {
      scheduleAnimation();
    });
    documentObserver.observe(document.body, { childList: true, subtree: true });

    window.addEventListener("popstate", scheduleAnimation);

    return () => {
      documentObserver.disconnect();
      window.removeEventListener("load", scheduleAnimation);
      window.removeEventListener("popstate", scheduleAnimation);
      window.cancelAnimationFrame(raf);
      cleanupAnimation?.();
    };
  }, []);
  return null;
}
