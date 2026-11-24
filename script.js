const header = document.querySelector("[data-header]");
const pageProgress = document.querySelector("[data-page-progress]");
const navToggle = document.querySelector(".nav-toggle");
const nav = document.querySelector(".site-nav");
const navLinks = document.querySelectorAll(".site-nav a");
const year = document.querySelector("[data-year]");
const stageButtons = [...document.querySelectorAll("[data-stage]")];
const callouts = [...document.querySelectorAll("[data-callout]")];
const labStage = document.querySelector("[data-lab-stage]");
const labInsight = document.querySelector("[data-lab-insight]");
const heroRunway = document.querySelector("[data-hero-runway]");
const monolithStage = document.querySelector("[data-monolith-stage]");
const scrubVideo = document.querySelector("[data-scrub-video]");
const monolithCanvas = document.querySelector("[data-monolith-canvas]");
const parallaxWord = document.querySelector("[data-parallax-word]");
const scrubFill = document.querySelector("[data-scrub-fill]");
const scrollHint = document.querySelector("[data-scroll-hint]");
const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const saveData = Boolean(navigator.connection?.saveData);

const clamp = (val, min, max) => Math.min(max, Math.max(min, val));

const updateHeaderAndPageProgress = () => {
  header?.classList.toggle("is-scrolled", window.scrollY > 16);
  if (pageProgress) {
    const maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    const ratio = clamp(window.scrollY / maxScroll, 0, 1);
    pageProgress.style.transform = `scaleX(${ratio.toFixed(4)})`;
  }
};

const setNavOpen = (willOpen) => {
  navToggle?.setAttribute("aria-expanded", String(willOpen));
  nav?.classList.toggle("is-open", willOpen);
  header?.classList.toggle("is-menu-open", willOpen);
  document.body.classList.toggle("nav-open", willOpen);
};

const closeNav = () => setNavOpen(false);

navToggle?.addEventListener("click", () => {
  const willOpen = navToggle.getAttribute("aria-expanded") !== "true";
  setNavOpen(willOpen);
});

window.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && nav?.classList.contains("is-open")) {
    closeNav();
    navToggle?.focus();
  }
});

navLinks.forEach((link) => link.addEventListener("click", closeNav));
window.addEventListener("resize", () => {
  if (window.innerWidth > 900) closeNav();
  updateHeaderAndPageProgress();
});
updateHeaderAndPageProgress();

if (year) year.textContent = String(new Date().getFullYear());

/* WebGL White-Studio Alpha Keyer (accepts either HTMLVideoElement or cached ImageBitmap) */
const createWhiteKeyRenderer = (canvas) => {
  if (!canvas) return null;
  const gl = canvas.getContext("webgl", { alpha: true, premultipliedAlpha: true, antialias: true });
  if (!gl) {
    // 2D Canvas fallback
    const ctx2d = canvas.getContext("2d");
    if (!ctx2d) return null;
    canvas.style.mixBlendMode = "multiply";
    return (source, w, h) => {
      if (!source || !w || !h) return false;
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      ctx2d.clearRect(0, 0, w, h);
      ctx2d.drawImage(source, 0, 0, w, h);
      return true;
    };
  }

  const vsSrc = `
    attribute vec2 a_pos;
    varying vec2 v_uv;
    void main() {
      v_uv = a_pos * 0.5 + 0.5;
      v_uv.y = 1.0 - v_uv.y;
      gl_Position = vec4(a_pos, 0.0, 1.0);
    }
  `;
  const fsSrc = `
    precision mediump float;
    varying vec2 v_uv;
    uniform sampler2D u_tex;
    void main() {
      vec4 c = texture2D(u_tex, v_uv);
      float minCh = min(min(c.r, c.g), c.b);
      float maxCh = max(max(c.r, c.g), c.b);
      float sat = maxCh - minCh;
      float alpha = clamp((0.975 - minCh) / 0.11 + sat * 9.0, 0.0, 1.0);
      gl_FragColor = vec4(c.rgb * alpha, alpha);
    }
  `;

  const compile = (type, src) => {
    const sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    return gl.getShaderParameter(sh, gl.COMPILE_STATUS) ? sh : null;
  };
  const vs = compile(gl.VERTEX_SHADER, vsSrc);
  const fs = compile(gl.FRAGMENT_SHADER, fsSrc);
  if (!vs || !fs) return null;

  const prog = gl.createProgram();
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null;
  gl.useProgram(prog);

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, "a_pos");
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

  return (source, w, h) => {
    if (!source || !w || !h) return false;
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
      gl.viewport(0, 0, w, h);
    }
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    return true;
  };
};

/* Stage & Anatomical Callout UI synchronization */
let activeStage = -1;
const blueprintWords = ["VERIFIED", "HYPOTHESIS", "INSPECTED", "SURVIVES"];

const selectStage = (index) => {
  if (index === activeStage) return;
  const button = stageButtons[index];
  if (!button || !labStage || !labInsight) return;
  activeStage = index;
  stageButtons.forEach((stage, stageIndex) => {
    const isActive = stageIndex === index;
    stage.classList.toggle("is-active", isActive);
    stage.setAttribute("aria-pressed", String(isActive));
  });
  callouts.forEach((callout, calloutIdx) => {
    callout.classList.toggle("is-visible", calloutIdx === index);
  });
  if (parallaxWord && blueprintWords[index]) {
    parallaxWord.textContent = blueprintWords[index];
  }
  labStage.textContent = `FIELD NOTE / ${button.dataset.stage}`;
  labInsight.classList.remove("is-changing");
  void labInsight.offsetWidth;
  labInsight.textContent = button.dataset.insight;
  labInsight.classList.add("is-changing");
};

const stageIndexForProgress = (p) => {
  if (p < 0.2) return 0;
  if (p < 0.5) return 1;
  if (p < 0.8) return 2;
  return 3;
};

/*
 * Two-Tier Zero-Blocking Scroll Sculpture Engine:
 * - Tier 0 (0ms LCP): Pre-keyed 28KB/49KB Alpha-WebP <picture> renders immediately on HTML parse.
 * - Tier 1 (Deferred Idle Stream): After window.load + requestIdleCallback (or first scroll intent),
 *   selects the single smallest supported codec/resolution stream (~260KB mobile AV1 / ~700KB desktop AV1,
 *   H.264 MP4 fallback), streams via HTTP 206 Range requests, and harvests decoded ImageBitmaps in the
 *   background for 0.04ms O(1) bidirectional scrubbing with zero autoplay.
 */
if (scrubVideo && monolithStage && stageButtons.length) {
  let duration = 4.8;
  let targetProgress = 0;
  let renderedProgress = 0;
  let rafId = null;
  let streamStarted = false;
  let canvasActivated = false;

  const frameCount = window.innerWidth <= 900 ? 64 : 84;
  const frameBitmaps = new Array(frameCount).fill(null);
  let bitmapReadyCount = 0;
  let userInteracted = false;
  let drawSource = null;
  let rendererInitialized = false;

  const getDrawSource = () => {
    if (!rendererInitialized) {
      rendererInitialized = true;
      drawSource = createWhiteKeyRenderer(monolithCanvas);
    }
    return drawSource;
  };

  const activateCanvas = () => {
    if (!canvasActivated) {
      canvasActivated = true;
      monolithStage.classList.add("is-canvas-active");
    }
  };

  const renderAtProgress = (p) => {
    const clamped = clamp(p, 0, 1);
    // At exact 0% rest state before user scrolls, keep the razor-sharp pre-keyed LCP WebP!
    if (clamped <= 0.002 && !canvasActivated) return;

    const render = getDrawSource();
    const idx = Math.round(clamped * (frameCount - 1));
    const bmp = frameBitmaps[idx];
    if (bmp && render?.(bmp, bmp.width, bmp.height)) {
      activateCanvas();
      return;
    }

    // Immediate HTTP 206 Range -g 12 fallback seek while background frame cache warms
    if (!streamStarted) startDeferredStream();
    if (scrubVideo.readyState >= 2 && !scrubVideo.seeking) {
      const desiredTime = clamp(clamped * duration, 0, Math.max(0, duration - 0.02));
      if (Math.abs(scrubVideo.currentTime - desiredTime) > 0.01) {
        scrubVideo.currentTime = desiredTime;
      } else if (render?.(scrubVideo, scrubVideo.videoWidth, scrubVideo.videoHeight)) {
        activateCanvas();
      }
    }
  };

  const updateTelemetry = (p) => {
    const clamped = clamp(p, 0, 1);
    if (scrubFill) {
      scrubFill.style.transform = `scaleX(${clamped.toFixed(4)})`;
    }
    if (parallaxWord) {
      const shiftY = (-52 + clamped * 8).toFixed(2);
      const scale = (1.0 - clamped * 0.04).toFixed(4);
      parallaxWord.style.transform = `translate(-50%, ${shiftY}%) scale(${scale})`;
    }
    if (scrollHint) {
      const pct = String(Math.round(clamped * 100)).padStart(2, "0");
      scrollHint.textContent = `SCROLL TO OPEN THE SYSTEM · ${pct}%`;
    }
    selectStage(stageIndexForProgress(clamped));
  };

  const computeRunwayProgress = () => {
    if (!heroRunway) return 0;
    const rect = heroRunway.getBoundingClientRect();
    const scrollable = heroRunway.offsetHeight - window.innerHeight;
    if (scrollable <= 20) return 0;
    return clamp(-rect.top / scrollable, 0, 1);
  };

  const pickBestStreamUrl = () => {
    const isMobile = window.innerWidth <= 900;
    const canAv1 =
      scrubVideo.canPlayType('video/webm; codecs="av01.0.05M.08"') === "probably" ||
      scrubVideo.canPlayType('video/webm; codecs="av01.0.04M.08"') === "probably";
    if (canAv1) {
      return isMobile ? monolithStage.dataset.av1Mobile : monolithStage.dataset.av1Desktop;
    }
    return isMobile ? monolithStage.dataset.h264Mobile : monolithStage.dataset.h264Desktop;
  };

  // Background sequential ImageBitmap harvester using a separate offscreen decoder element
  // so scrubVideo stays 100% paused and ready for immediate scroll seeking!
  const harvestFramesInBackground = (streamUrl) => {
    if (typeof window.createImageBitmap !== "function") return;
    const decoder = document.createElement("video");
    decoder.muted = true;
    decoder.playsInline = true;
    decoder.preload = "auto";
    decoder.src = streamUrl;

    decoder.addEventListener(
      "loadeddata",
      () => {
        const dur = Number.isFinite(decoder.duration) && decoder.duration > 0 ? decoder.duration : 4.8;
        let stepIdx = 0;

        const decodeNext = () => {
          if (stepIdx >= frameCount) {
            decoder.removeAttribute("src");
            decoder.load();
            return;
          }
          decoder.currentTime = clamp((stepIdx / (frameCount - 1)) * dur, 0, Math.max(0, dur - 0.02));
        };

        decoder.addEventListener("seeked", () => {
          const capturedIdx = stepIdx;
          window
            .createImageBitmap(decoder)
            .then((bmp) => {
              frameBitmaps[capturedIdx] = bmp;
              bitmapReadyCount += 1;
              // Re-render current scroll target cleanly if user is resting near this frame
              const activeIdx = Math.round(renderedProgress * (frameCount - 1));
              if (capturedIdx === activeIdx && renderedProgress > 0.002) {
                renderAtProgress(renderedProgress);
              }
              stepIdx += 1;
              const delayMs = userInteracted ? 4 : 28;
              window.setTimeout(() => {
                if ("requestIdleCallback" in window && !userInteracted) {
                  window.requestIdleCallback(decodeNext, { timeout: 250 });
                } else {
                  decodeNext();
                }
              }, delayMs);
            })
            .catch(() => {});
        });

        decodeNext();
      },
      { once: true },
    );
  };

  function startDeferredStream() {
    if (streamStarted || prefersReducedMotion || saveData) return;
    streamStarted = true;
    const chosenUrl = pickBestStreamUrl();
    if (!chosenUrl) return;

    scrubVideo.preload = "auto";
    scrubVideo.src = chosenUrl;
    scrubVideo.load();

    scrubVideo.addEventListener("seeked", () => {
      const render = getDrawSource();
      if (renderedProgress > 0.002 && render?.(scrubVideo, scrubVideo.videoWidth, scrubVideo.videoHeight)) {
        activateCanvas();
      }
    });

    scrubVideo.addEventListener(
      "loadedmetadata",
      () => {
        if (Number.isFinite(scrubVideo.duration) && scrubVideo.duration > 0) {
          duration = scrubVideo.duration;
        }
        scrubVideo.pause();
        if (renderedProgress > 0.002) {
          renderAtProgress(renderedProgress);
        }
        harvestFramesInBackground(chosenUrl);
      },
      { once: true },
    );
  }

  // Fast-track stream + WebGL warmup immediately on any scroll/touch/pointer intent,
  // or gently during browser idle after First Paint & LCP.
  const onFirstIntent = () => {
    userInteracted = true;
    getDrawSource();
    startDeferredStream();
  };
  ["wheel", "touchstart", "pointerdown", "keydown"].forEach((evt) => {
    window.addEventListener(evt, onFirstIntent, { once: true, passive: true });
  });

  const scheduleStreamWarmup = () => {
    if (prefersReducedMotion || saveData) return;
    window.setTimeout(() => {
      if ("requestIdleCallback" in window) {
        window.requestIdleCallback(() => startDeferredStream(), { timeout: 2000 });
      } else {
        startDeferredStream();
      }
    }, 900);
  };

  if (document.readyState === "complete") {
    scheduleStreamWarmup();
  } else {
    window.addEventListener("load", scheduleStreamWarmup, { once: true });
  }

  const tick = () => {
    const diff = targetProgress - renderedProgress;
    if (Math.abs(diff) > 0.0006) {
      renderedProgress += diff * 0.24;
    } else {
      renderedProgress = targetProgress;
    }

    renderAtProgress(renderedProgress);
    updateTelemetry(renderedProgress);

    if (Math.abs(targetProgress - renderedProgress) > 0.0006) {
      rafId = window.requestAnimationFrame(tick);
    } else {
      rafId = null;
    }
  };

  const ensureTick = () => {
    if (!rafId) rafId = window.requestAnimationFrame(tick);
  };

  window.addEventListener(
    "scroll",
    () => {
      updateHeaderAndPageProgress();
      if (prefersReducedMotion) return;
      if (!streamStarted && window.scrollY > 2) startDeferredStream();
      targetProgress = computeRunwayProgress();
      ensureTick();
    },
    { passive: true },
  );

  stageButtons.forEach((button, index) => {
    button.addEventListener("click", () => {
      if (!streamStarted) startDeferredStream();
      const stageTarget = Number.parseFloat(button.dataset.targetProgress ?? "0");
      selectStage(index);
      const scrollable = heroRunway ? heroRunway.offsetHeight - window.innerHeight : 0;
      if (heroRunway && scrollable > 20 && !prefersReducedMotion) {
        const runwayTop = heroRunway.getBoundingClientRect().top + window.scrollY;
        window.scrollTo({
          top: runwayTop + stageTarget * scrollable,
          behavior: "smooth",
        });
      } else {
        targetProgress = stageTarget;
        ensureTick();
      }
    });
  });

  selectStage(0);
  targetProgress = computeRunwayProgress();
  renderedProgress = targetProgress;
  updateTelemetry(renderedProgress);
  void bitmapReadyCount;
} else {
  window.addEventListener("scroll", updateHeaderAndPageProgress, { passive: true });
}

/* Scroll reveal observer */
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
