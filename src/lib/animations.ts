import gsap from "gsap";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(useGSAP);

/** Compositor-friendly defaults — transforms + opacity only. */
gsap.defaults({
  ease: "power2.out",
  overwrite: "auto",
});

export { gsap, useGSAP };

let reducedMotion = false;

if (typeof window !== "undefined") {
  const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
  reducedMotion = mq.matches;
  mq.addEventListener("change", (e) => {
    reducedMotion = e.matches;
  });
}

export function prefersReducedMotion(): boolean {
  return reducedMotion;
}

function kill(targets: gsap.DOMTarget) {
  gsap.killTweensOf(targets);
}

/** Entrance for a new round’s cards / options */
export function animateRoundIn(
  root: HTMLElement | null,
  selector = "[data-animate='item']",
) {
  if (!root) return;
  const items = root.querySelectorAll(selector);
  if (items.length === 0) return;

  kill(items);

  if (reducedMotion) {
    gsap.set(items, { autoAlpha: 1, x: 0, y: 0, scale: 1 });
    return;
  }

  gsap.fromTo(
    items,
    { autoAlpha: 0, y: 16, scale: 0.97 },
    {
      autoAlpha: 1,
      y: 0,
      scale: 1,
      duration: 0.38,
      stagger: 0.07,
      ease: "power3.out",
      force3D: true,
    },
  );
}

/** Correct answer pulse — scale only */
export function animateCorrect(el: HTMLElement | null) {
  if (!el) return;
  kill(el);
  if (reducedMotion) return;

  gsap.fromTo(
    el,
    { scale: 1 },
    {
      scale: 1.04,
      duration: 0.2,
      yoyo: true,
      repeat: 1,
      ease: "power2.out",
      force3D: true,
    },
  );
}

/** Wrong answer shake — single x tween, no keyframe allocs */
export function animateWrong(el: HTMLElement | null) {
  if (!el) return;
  kill(el);
  if (reducedMotion) return;

  gsap.fromTo(
    el,
    { x: 0 },
    {
      x: 6,
      duration: 0.05,
      repeat: 5,
      yoyo: true,
      ease: "power1.inOut",
      force3D: true,
      onComplete: () => {
        gsap.set(el, { x: 0 });
      },
    },
  );
}

/** Wrong pick + delayed correct highlight on a timeline */
export function animateRevealOptions(
  wrongEl: HTMLElement | null,
  correctEl: HTMLElement | null,
) {
  if (reducedMotion) return;

  const targets = [wrongEl, correctEl].filter(Boolean) as HTMLElement[];
  kill(targets);

  const tl = gsap.timeline({ defaults: { force3D: true } });

  if (wrongEl) {
    tl.fromTo(
      wrongEl,
      { x: 0 },
      {
        x: 6,
        duration: 0.05,
        repeat: 5,
        yoyo: true,
        ease: "power1.inOut",
        onComplete: () => gsap.set(wrongEl, { x: 0 }),
      },
    );
  }

  if (correctEl) {
    tl.fromTo(
      correctEl,
      { scale: 1 },
      {
        scale: 1.04,
        duration: 0.2,
        yoyo: true,
        repeat: 1,
        ease: "power2.out",
      },
      wrongEl ? "-=0.05" : 0,
    );
  }

  return tl;
}

/** Feedback banner pop-in */
export function animateFeedbackIn(el: HTMLElement | null) {
  if (!el) return;
  kill(el);

  if (reducedMotion) {
    gsap.set(el, { autoAlpha: 1, y: 0, scale: 1 });
    return;
  }

  gsap.fromTo(
    el,
    { autoAlpha: 0, y: 8, scale: 0.94 },
    {
      autoAlpha: 1,
      y: 0,
      scale: 1,
      duration: 0.32,
      ease: "power3.out",
      force3D: true,
    },
  );
}

/** Results screen entrance */
export function animateResultsIn(el: HTMLElement | null) {
  if (!el) return;
  const parts = el.querySelectorAll("[data-animate='result']");
  const targets = parts.length > 0 ? parts : el;
  kill(targets);

  if (reducedMotion) {
    gsap.set(targets, { autoAlpha: 1, y: 0 });
    return;
  }

  gsap.fromTo(
    targets,
    { autoAlpha: 0, y: 14 },
    {
      autoAlpha: 1,
      y: 0,
      duration: 0.4,
      stagger: 0.07,
      ease: "power3.out",
      force3D: true,
    },
  );
}

/** Brief flash on naming input hit/miss */
export function animateFlash(
  el: HTMLElement | null,
  kind: "hit" | "miss",
) {
  if (!el) return;
  kill(el);
  if (reducedMotion) return;

  if (kind === "hit") {
    gsap.fromTo(
      el,
      { scale: 1 },
      {
        scale: 1.02,
        duration: 0.14,
        yoyo: true,
        repeat: 1,
        ease: "power2.out",
        force3D: true,
      },
    );
  } else {
    animateWrong(el);
  }
}

/** Pop in a single newly-added chip */
export function animateChipIn(el: HTMLElement | null) {
  if (!el) return;
  kill(el);

  if (reducedMotion) {
    gsap.set(el, { autoAlpha: 1, scale: 1, y: 0 });
    return;
  }

  gsap.fromTo(
    el,
    { autoAlpha: 0, scale: 0.75, y: 6 },
    {
      autoAlpha: 1,
      scale: 1,
      y: 0,
      duration: 0.3,
      ease: "power3.out",
      force3D: true,
    },
  );
}

/** Score bump — scale + y only */
export function animateScoreBump(el: HTMLElement | null) {
  if (!el || reducedMotion) return;
  kill(el);
  gsap.fromTo(
    el,
    { scale: 1.2, y: -2 },
    {
      scale: 1,
      y: 0,
      duration: 0.32,
      ease: "power3.out",
      force3D: true,
    },
  );
}

/** Streak badge appear */
export function animateStreakIn(el: HTMLElement | null) {
  if (!el || reducedMotion) return;
  kill(el);
  gsap.fromTo(
    el,
    { scale: 0.88, autoAlpha: 0.4 },
    {
      scale: 1,
      autoAlpha: 1,
      duration: 0.28,
      ease: "power3.out",
      force3D: true,
    },
  );
}

/**
 * Progress fill via scaleX (compositor) instead of width (layout).
 * Expects transform-origin: left center on the element.
 */
export function animateProgress(
  el: HTMLElement | null,
  progress01: number,
) {
  if (!el) return;
  const scaleX = Math.max(0, Math.min(1, progress01));

  if (reducedMotion) {
    gsap.set(el, { scaleX });
    return;
  }

  gsap.to(el, {
    scaleX,
    duration: 0.45,
    ease: "power2.out",
    force3D: true,
    overwrite: "auto",
  });
}
