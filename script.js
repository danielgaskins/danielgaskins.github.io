const header = document.querySelector("[data-header]");
const navToggle = document.querySelector(".nav-toggle");
const nav = document.querySelector(".site-nav");
const navLinks = document.querySelectorAll(".site-nav a");
const year = document.querySelector("[data-year]");
const stageButtons = [...document.querySelectorAll("[data-stage]")];
const labStage = document.querySelector("[data-lab-stage]");
const labInsight = document.querySelector("[data-lab-insight]");
const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const updateHeader = () => {
  header?.classList.toggle("is-scrolled", window.scrollY > 16);
};

const closeNav = () => {
  navToggle?.setAttribute("aria-expanded", "false");
  nav?.classList.remove("is-open");
  document.body.classList.remove("nav-open");
};

navToggle?.addEventListener("click", () => {
  const willOpen = navToggle.getAttribute("aria-expanded") !== "true";
  navToggle.setAttribute("aria-expanded", String(willOpen));
  nav?.classList.toggle("is-open", willOpen);
  document.body.classList.toggle("nav-open", willOpen);
});

navLinks.forEach((link) => link.addEventListener("click", closeNav));
window.addEventListener("scroll", updateHeader, { passive: true });
window.addEventListener("resize", () => {
  if (window.innerWidth > 900) closeNav();
});
updateHeader();

if (year) year.textContent = String(new Date().getFullYear());

let activeStage = 0;
let stageTimer;

const selectStage = (index) => {
  const button = stageButtons[index];
  if (!button || !labStage || !labInsight) return;
  activeStage = index;
  stageButtons.forEach((stage, stageIndex) => {
    const isActive = stageIndex === index;
    stage.classList.toggle("is-active", isActive);
    stage.setAttribute("aria-pressed", String(isActive));
  });
  labStage.textContent = `FIELD NOTE / ${button.dataset.stage}`;
  labInsight.classList.remove("is-changing");
  void labInsight.offsetWidth;
  labInsight.textContent = button.dataset.insight;
  labInsight.classList.add("is-changing");
};

const stopStageRotation = () => window.clearInterval(stageTimer);

stageButtons.forEach((button, index) => {
  button.addEventListener("click", () => {
    stopStageRotation();
    selectStage(index);
  });
  button.addEventListener("focus", stopStageRotation);
});

if (stageButtons.length && !prefersReducedMotion) {
  stageTimer = window.setInterval(() => selectStage((activeStage + 1) % stageButtons.length), 3600);
}

const revealItems = document.querySelectorAll("[data-reveal]");

if (prefersReducedMotion || !("IntersectionObserver" in window)) {
  revealItems.forEach((item) => item.classList.add("is-visible"));
} else {
  document.documentElement.classList.add("reveal-ready");
  const revealObserver = new IntersectionObserver(
    (entries, observer) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      });
    },
    { threshold: 0.12, rootMargin: "0px 0px -40px" },
  );
  revealItems.forEach((item) => {
    if (item.getBoundingClientRect().top < window.innerHeight * 1.05) {
      item.classList.add("is-visible");
    } else {
      revealObserver.observe(item);
    }
  });
}

window.addEventListener("load", async () => {
  if (!window.location.hash) return;
  const target = document.querySelector(window.location.hash);
  if (!target) return;
  if (document.fonts?.ready) await document.fonts.ready;
  requestAnimationFrame(() => {
    const top = target.getBoundingClientRect().top + window.scrollY - 64;
    window.scrollTo({ top, behavior: "instant" });
  });
});
