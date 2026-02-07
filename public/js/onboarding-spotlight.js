// onboarding-spotlight.js
// Lichtgewicht, stabiele GSTour-engine zonder logspam / infinite loops

(function () {
  const GSTour = {
    steps: [],
    state: {
      isActive: false,
      currentStepIndex: 0,
      highlightEl: null,
      tooltipEl: null,
      currentTarget: null,
      resizeHandler: null,
      scrollHandler: null,
      onStepChange: null,
      onFinish: null,
      isInitialRender: false, // Flag voor eerste render op deze pagina
    },

    log(...args) {
      // Alleen loggen als er echt iets mis gaat, anders stil
      if (args[0] && typeof args[0] === 'string' && args[0].includes('[GSTour]')) {
        console.log(...args);
      }
    },

    init(steps) {
      this.steps = steps || [];
    },

    start(steps, options = {}) {
      if (!steps || steps.length === 0) {
        this.log("[GSTour] no steps configured, aborting start()");
        return;
      }

      this.log("[GSTour] FORCE start tour at step", options.initialIndex || 0);

      // Uitschakelen van oude overlays die de highlight blokkeren (maar NIET tour-pre-dim!)
      const oldOverlay = document.querySelector('#spotlightTour, .spotlight-tour, .spotlight-overlay');
      if (oldOverlay) {
        oldOverlay.style.display = 'none';
        oldOverlay.style.pointerEvents = 'none';
        oldOverlay.style.background = 'transparent';
      }

      this.steps = steps;
      this.state.isActive = true;
      this.state.currentStepIndex = options.initialIndex || 0;
      this.state.currentTarget = null;
      this.state.onStepChange = options.onStepChange || null;
      this.state.onFinish = options.onFinish || null;
      this.state.isInitialRender = true; // Markeer als eerste render op deze pagina

      // Elements aanmaken als ze er nog niet zijn
      if (!this.state.highlightEl || !this.state.tooltipEl) {
        this.ensureDom();
      }

      // Highlight direct klaarzetten, maar nog niet zichtbaar
      const h = this.state.highlightEl;
      if (h) {
        h.style.opacity = "0";
        h.style.transition = "none"; // geen animatie bij eerste render
      }

      // Body-class voor eventuele globale styling
      document.body.classList.add('gs-tour-active');

      // Altijd direct de huidige stap renderen
      this.renderCurrentStep();

      return {
        next: () => this.next(),
        back: () => this.prev(),
        stop: () => this.stop(),
      };
    },

    stop() {
      this.log("[GSTour] stop tour");

      this.state.isActive = false;
      this.state.currentStepIndex = 0;
      this.state.currentTarget = null;

      // Zorg dat oude overlays ook echt weg zijn (maar NIET tour-pre-dim, dat wordt in positionHighlightAndTooltip gedaan)
      const oldOverlays = document.querySelectorAll('#spotlightTour, .spotlight-tour, .spotlight-overlay');
      oldOverlays.forEach(el => {
        el.style.display = 'none';
        el.style.pointerEvents = 'none';
        el.style.background = 'transparent';
      });

      if (this.state.highlightEl) {
        Object.assign(this.state.highlightEl.style, {
          opacity: '0',
          boxShadow: 'none',
          background: 'transparent',
          WebkitMaskImage: 'none',
          maskImage: 'none'
        });
        this.state.highlightEl.hidden = true;
      }

      if (this.state.tooltipEl) {
        this.state.tooltipEl.style.opacity = '0';
        this.state.tooltipEl.hidden = true;
      }

      document.body.classList.remove('gs-tour-active');

      // Remove listeners
      if (this.state.resizeHandler) {
        window.removeEventListener("resize", this.state.resizeHandler);
        this.state.resizeHandler = null;
      }
      if (this.state.scrollHandler) {
        window.removeEventListener("scroll", this.state.scrollHandler);
        this.state.scrollHandler = null;
      }

      // Call onFinish callback if provided
      if (this.state.onFinish) {
        this.state.onFinish();
      }
    },

    next() {
      if (!this.state.isActive) return;
      if (this.state.currentStepIndex >= this.steps.length - 1) {
        this.stop();
        return;
      }
      this.state.currentStepIndex++;
      
      // Check of volgende step naar andere pagina moet navigeren
      const nextStep = this.steps[this.state.currentStepIndex];
      if (nextStep && nextStep.page && window.location.pathname !== nextStep.page) {
        // Navigeer naar de juiste pagina
        const url = new URL(window.location.href);
        url.pathname = nextStep.page;
        url.searchParams.set('tour', 'true');
        url.searchParams.set('step', this.state.currentStepIndex.toString());
        window.location.href = url.toString();
        return;
      }
      
      this.renderCurrentStep();
    },

    prev() {
      if (!this.state.isActive) return;
      if (this.state.currentStepIndex <= 0) return;
      this.state.currentStepIndex--;
      this.renderCurrentStep();
    },

    getStepRect(step) {
      const selector = step.selector || (step.highlightSelectors && step.highlightSelectors[0]) || null;
      if (!selector) return null;

      const target = document.querySelector(selector);
      if (!target) return null;

      // ✅ Speciale case: meerdere aparte highlights (voor KPI cards)
      if (step.spotlightChildrenSelector && step.multipleHighlights) {
        const nodes = target.querySelectorAll(step.spotlightChildrenSelector);
        if (!nodes.length) {
          return target.getBoundingClientRect();
        }

        // Retourneer array van rects voor meerdere gaten
        return Array.from(nodes).map(el => {
          const r = el.getBoundingClientRect();
          return {
            top: r.top,
            left: r.left,
            width: r.width,
            height: r.height,
            right: r.right,
            bottom: r.bottom
          };
        });
      }

      // ✅ Speciale case: highlight om alle child-elementen heen (union rect)
      if (step.spotlightChildrenSelector) {
        const nodes = target.querySelectorAll(step.spotlightChildrenSelector);
        if (!nodes.length) {
          return target.getBoundingClientRect();
        }

        let top = Infinity;
        let left = Infinity;
        let right = -Infinity;
        let bottom = -Infinity;

        nodes.forEach((el) => {
          const r = el.getBoundingClientRect();
          top = Math.min(top, r.top);
          left = Math.min(left, r.left);
          right = Math.max(right, r.right);
          bottom = Math.max(bottom, r.bottom);
        });

        return {
          top,
          left,
          width: right - left,
          height: bottom - top,
        };
      }

      // default: gewoon 1 element
      return target.getBoundingClientRect();
    },

    createMultiSpotlightMask(rects, padding, step) {
      const borderRadius =
        typeof step?.borderRadius === "number" ? step.borderRadius : 12;

      const fullW = window.innerWidth;
      const fullH = window.innerHeight;

      // Bereken de maximale hoogte van alle rects (voor uniforme highlights)
      const maxHeight = Math.max(...rects.map(r => r.height));

      const holes = rects
        .map(r => {
          const x = Math.max(r.left - padding, 0);
          const y = Math.max(r.top - padding, 0);
          const w = r.width + padding * 2;
          // Gebruik maxHeight voor alle highlights zodat ze even hoog zijn
          const h = maxHeight + padding * 2;
          // ZWART = gat (transparant), WIT = dim
          return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${borderRadius}" ry="${borderRadius}" fill="black"/>`;
        })
        .join("");

      const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${fullW}" height="${fullH}">
  <defs>
    <mask id="gs-tour-mask" maskUnits="userSpaceOnUse">
      <rect x="0" y="0" width="${fullW}" height="${fullH}" fill="white"/>
      ${holes}
    </mask>
  </defs>
  <rect x="0" y="0" width="${fullW}" height="${fullH}" fill="black" mask="url(#gs-tour-mask)"/>
</svg>
      `.trim();

      const encoded = encodeURIComponent(svg).replace(/%0A/g, "");
      return `url("data:image/svg+xml,${encoded}")`;
    },

    renderCurrentStep() {
      if (!this.state.isActive) return;

      const index = this.state.currentStepIndex;
      const step = this.steps[index];
      if (!step) {
        this.log("[GSTour] no step found for index", index);
        this.stop();
        return;
      }

      // Optioneel: simpele page-check (als je multi-page tour wilt)
      if (step.page && window.location.pathname !== step.page) {
        this.log(
          `[GSTour] step ${index} expects page ${step.page}, current page is ${window.location.pathname}. Navigating...`
        );
        // Navigeer naar de juiste pagina met tour parameters
        const url = new URL(window.location.href);
        url.pathname = step.page;
        url.searchParams.set('tour', 'true');
        url.searchParams.set('step', index.toString());
        window.location.href = url.toString();
        return;
      }

      // Wacht op waitFor als die bestaat
        if (typeof step.waitFor === 'function') {
        step._waitStart = step._waitStart || performance.now();
          if (!step.waitFor()) {
          const elapsed = performance.now() - step._waitStart;
          if (elapsed > (step.maxWaitMs || 2500)) {
            this.log(`[GSTour] waitFor timeout for step ${index}, continuing anyway`);
          } else {
            // Nog even wachten
            setTimeout(() => this.renderCurrentStep(), 80);
            return;
          }
        }
      }

      // Gebruik selector of highlightSelectors
      const selector = step.selector || (step.highlightSelectors && step.highlightSelectors[0]) || null;
      if (!selector) {
        this.log(`[GSTour] no selector found for step ${index}, stopping tour.`);
        this.stop();
          return;
        }

      const target = document.querySelector(selector);
      if (!target) {
        console.error(`[GSTour] DEBUG: selector "${selector}" not found`);
        console.error(`[GSTour] DEBUG: Available elements:`, document.querySelectorAll(selector.split(',')[0] || selector));
        console.error(`[GSTour] DEBUG: Page: ${window.location.pathname}, Step page: ${step.page}`);
        this.log(
          `[GSTour] target element not found for selector "${selector}", stopping tour.`
        );
        // Wacht even en probeer opnieuw (voor dynamisch geladen content)
        if (step._retryCount === undefined) {
          step._retryCount = 0;
        }
        if (step._retryCount < 5) {
          step._retryCount++;
          setTimeout(() => this.renderCurrentStep(), 200);
          return;
        }
        this.stop();
        return;
      }
      // Reset retry count als element gevonden is
      if (step._retryCount !== undefined) {
        step._retryCount = 0;
      }
      console.log(`[GSTour] DEBUG: Found target:`, target, `rect:`, target.getBoundingClientRect());

      this.state.currentTarget = target;

      // Zorg dat DOM voor spotlight + tooltip bestaat
      this.ensureDom();

      // Update content + positie
      this.updateTooltipContent(step, index);
      
      // Bereken rect(s) op basis van step config (inclusief spotlightChildrenSelector)
      const rectOrRects = this.getStepRect(step);
      this.positionHighlightAndTooltip(rectOrRects);

      // Call onStepChange callback if provided
      if (this.state.onStepChange) {
        this.state.onStepChange(index);
      }
    },

    ensureDom() {
      // Highlight element (met dikke box-shadow als dim-overlay)
      if (!this.state.highlightEl) {
        const highlight = document.createElement("div");
        highlight.setAttribute("id", "gs-tour-highlight");

        // Highlight (dim + gat)
        Object.assign(highlight.style, {
          position: "fixed",
          top: "0",
          left: "0",
          width: "0",
          height: "0",
          borderRadius: "0", // default, per step overschrijven
          boxShadow: "0 0 0 2000px rgba(0,0,0,0.72)", // zwarte dim
          background: "transparent",
          transition: "opacity 0.18s ease-out", // GEEN width/height/left/top animatie
          zIndex: "2147483645", // Hoger dan oude overlays (99999999) maar onder tooltip
          pointerEvents: "none", // nooit clicks blokkeren
          opacity: "0" // Start hidden, wordt 1 in positionHighlightAndTooltip
        });

        document.body.appendChild(highlight);
        this.state.highlightEl = highlight;
      }

      // Tooltip element
      if (!this.state.tooltipEl) {
        const tooltip = document.createElement("div");
        tooltip.setAttribute("id", "gs-tour-tooltip");

        // Tooltip
        Object.assign(tooltip.style, {
          position: "fixed",
          zIndex: "2147483646",  // boven highlight
          pointerEvents: "auto",
          opacity: "0",
          visibility: "hidden",
          maxWidth: "360px",
          background: "white",
          borderRadius: "12px",
          boxShadow: "none", // Geen schaduw rond tooltip
          padding: "16px 18px",
          fontFamily:
            'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
          fontSize: "14px",
          color: "#0f172a",
          display: "flex",
          flexDirection: "column",
          gap: "10px",
          marginTop: "8px", // Minder ruimte boven de tooltip
        });

        // Title
        const titleEl = document.createElement("div");
        titleEl.setAttribute("data-gs-tour-title", "true");
        Object.assign(titleEl.style, {
          fontSize: "15px",
          fontWeight: "600",
        });

        // Body
        const bodyEl = document.createElement("div");
        bodyEl.setAttribute("data-gs-tour-body", "true");
        Object.assign(bodyEl.style, {
          fontSize: "14px",
          lineHeight: "1.5",
          color: "#64748b",
        });

        // Buttons
        const footerEl = document.createElement("div");
        Object.assign(footerEl.style, {
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "8px",
          marginTop: "4px",
        });

        const leftGroup = document.createElement("div");
        Object.assign(leftGroup.style, {
          display: "flex",
          gap: "8px",
        });

        const btnPrev = document.createElement("button");
        btnPrev.type = "button";
        btnPrev.textContent = "Terug";
        btnPrev.setAttribute("data-gs-tour-prev", "true");
        Object.assign(btnPrev.style, {
          padding: "6px 10px",
          borderRadius: "9999px",
          border: "1px solid #cbd5f5",
          background: "white",
          fontSize: "13px",
          cursor: "pointer",
        });

        const btnNext = document.createElement("button");
        btnNext.type = "button";
        btnNext.textContent = "Volgende";
        btnNext.setAttribute("data-gs-tour-next", "true");
        Object.assign(btnNext.style, {
          padding: "6px 12px",
          borderRadius: "9999px",
          border: "none",
          background: "#ea5d0d",
          color: "white",
          fontSize: "13px",
          fontWeight: "500",
          cursor: "pointer",
        });

        const btnSkip = document.createElement("button");
        btnSkip.type = "button";
        btnSkip.textContent = "Overslaan";
        btnSkip.setAttribute("data-gs-tour-skip", "true");
        Object.assign(btnSkip.style, {
          padding: "4px 10px",
          borderRadius: "9999px",
          border: "none",
          background: "transparent",
          fontSize: "12px",
          color: "#64748b",
          cursor: "pointer",
        });

        leftGroup.appendChild(btnPrev);
        leftGroup.appendChild(btnNext);
        footerEl.appendChild(leftGroup);
        footerEl.appendChild(btnSkip);

        tooltip.appendChild(titleEl);
        tooltip.appendChild(bodyEl);
        tooltip.appendChild(footerEl);

        document.body.appendChild(tooltip);
        this.state.tooltipEl = tooltip;

        // Button events
        btnPrev.addEventListener("click", () => this.prev());
        btnNext.addEventListener("click", () => this.next());
        btnSkip.addEventListener("click", () => this.stop());

        // Listeners voor reposition - bij scroll/resize moet tooltip opnieuw gepositioneerd worden
        const reposition = () => {
          const step = this.steps[this.state.currentStepIndex];
          if (step && this.state.currentTarget) {
            // Herhaal de rect berekening om scroll-positie te updaten
            const rectOrRects = this.getStepRect(step);
            this.positionHighlightAndTooltip(rectOrRects);
          }
        };
        window.addEventListener("resize", reposition);
        window.addEventListener("scroll", reposition, { passive: true });

        this.state.resizeHandler = reposition;
        this.state.scrollHandler = reposition;
      }
    },

    updateTooltipContent(step, index) {
      if (!this.state.tooltipEl) return;

      const titleEl = this.state.tooltipEl.querySelector(
        "[data-gs-tour-title]"
      );
      const bodyEl = this.state.tooltipEl.querySelector(
        "[data-gs-tour-body]"
      );
      const btnPrev = this.state.tooltipEl.querySelector(
        "[data-gs-tour-prev]"
      );
      const btnNext = this.state.tooltipEl.querySelector(
        "[data-gs-tour-next]"
      );
      const btnSkip = this.state.tooltipEl.querySelector(
        "[data-gs-tour-skip]"
      );

      if (titleEl) {
        titleEl.textContent = step.title || `Stap ${index + 1}`;
      }
      if (bodyEl) {
        bodyEl.textContent = step.text || step.body || "";
      }

      // Button states
      if (btnPrev) {
        btnPrev.disabled = index === 0;
        btnPrev.style.opacity = index === 0 ? "0.5" : "1";
        btnPrev.style.cursor = index === 0 ? "default" : "pointer";
      }
      if (btnNext) {
        const isLast = index === this.steps.length - 1;
        btnNext.textContent = isLast ? "Klaar" : "Volgende";
        if (isLast && step.labels && step.labels.done) {
          btnNext.textContent = step.labels.done;
        }
      }
      if (btnSkip) {
        const isLast = index === this.steps.length - 1;
        if (isLast && step.labels && step.labels.skip) {
          btnSkip.textContent = step.labels.skip;
        } else if (isLast && step.labels && step.labels.later) {
          btnSkip.textContent = step.labels.later;
        }
      }
    },

    positionHighlightAndTooltip(rectOrRects) {
      if (!this.state.isActive) return;
      if (!this.state.highlightEl || !this.state.tooltipEl) return;

      const step = this.steps[this.state.currentStepIndex];

      // --- RECT NORMALISEREN ---
      let rects = [];
      const hasArray = Array.isArray(rectOrRects);
      const allowMultiple = !!(step && step.multipleHighlights);

      if (hasArray && allowMultiple && rectOrRects.length > 0) {
        rects = rectOrRects;
      } else {
        let r = rectOrRects;
        if (!r && this.state.currentTarget) {
          r = this.state.currentTarget.getBoundingClientRect();
        }
        if (!r) {
          this.state.highlightEl.hidden = true;
          this.state.tooltipEl.hidden = true;
          if (this.state.isInitialRender) {
            document.body.classList.remove("tour-loading", "tour-pre-dim", "gs-tour-pre-dim");
            document.documentElement.classList.remove("tour-pre-dim");
            this.state.isInitialRender = false;
          }
          return;
        }
        rects = [r];
      }

      const padding = typeof step?.padding === "number" ? step.padding : 8;
      const highlight = this.state.highlightEl;

      // Altijd eerst oude styles resetten
      Object.assign(highlight.style, {
        boxShadow: "none",
        background: "transparent",
        WebkitMaskImage: "none",
        maskImage: "none",
        WebkitMaskRepeat: "no-repeat",
        maskRepeat: "no-repeat",
        WebkitMaskSize: "100% 100%",
        maskSize: "100% 100%"
      });

      // --- SCROLL NAAR EERSTE RECT (indien nodig) ---
      const firstRect = rects[0];
      if (
        step &&
        !step.allowOffscreen &&
        (firstRect.top < 0 || firstRect.bottom > window.innerHeight)
      ) {
        const targetY = Math.max(0, firstRect.top + window.scrollY - 120);
        window.scrollTo({ top: targetY, behavior: "auto" });
      }

      // --- HIGHLIGHT TEKENEN ---
      if (allowMultiple && rects.length > 1) {
        // MULTI-SPOTLIGHT (MEERDERE GATEN)
        const maskUrl = this.createMultiSpotlightMask(rects, padding, step);

        highlight.style.top = "0px";
        highlight.style.left = "0px";
        highlight.style.width = `${window.innerWidth}px`;
        highlight.style.height = `${window.innerHeight}px`;
        highlight.style.background = "rgba(0,0,0,0.72)";

        highlight.style.WebkitMaskImage = maskUrl;
        highlight.style.maskImage = maskUrl;

        highlight.style.opacity = "1";
        highlight.hidden = false;
      } else {
        // SINGLE HIGHLIGHT (SIDEBAR, KPI-CONTAINER, etc.)
        const r = rects[0];
        if (!r || r.width <= 0 || r.height <= 0) {
          highlight.hidden = true;
          this.state.tooltipEl.hidden = true;
          if (this.state.isInitialRender) {
            document.body.classList.remove("tour-loading", "tour-pre-dim", "gs-tour-pre-dim");
            document.documentElement.classList.remove("tour-pre-dim");
            this.state.isInitialRender = false;
          }
          return;
        }

        const top = Math.max(r.top - padding, 0);
        const left = Math.max(r.left - padding, 0);
        const width = r.width + padding * 2;
        const height = r.height + padding * 2;

        const borderRadius =
          step?.borderRadius !== undefined
            ? step.borderRadius
            : step?.id === "sidebar"
            ? 0
            : 12;

        // 👉 GEEN transition op geometrie, alleen op opacity
        highlight.style.top = `${top}px`;
        highlight.style.left = `${left}px`;
        highlight.style.width = `${width}px`;
        highlight.style.height = `${height}px`;
        highlight.style.borderRadius = `${borderRadius}px`;
        highlight.style.boxShadow = "0 0 0 2000px rgba(0,0,0,0.72)";
        highlight.style.background = "transparent";
        highlight.style.pointerEvents = "none";
        highlight.hidden = false;
      }

      // ===== FLICKER FIX: initial render zonder gap =====
      const isInitial = this.state.isInitialRender === true;

      if (isInitial) {
        // 1) spotlight meteen zichtbaar, maar zonder fade
        highlight.style.transition = "none";
        highlight.style.opacity = "1";

        // 2) Double rAF: wacht tot browser heeft gepaint voordat we overlay verwijderen (voorkomt flicker)
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            document.body.classList.remove("tour-loading", "tour-pre-dim", "gs-tour-pre-dim");
            document.documentElement.classList.remove("tour-pre-dim");
            if (highlight) highlight.style.transition = "opacity 0.18s ease-out";
            this.state.isInitialRender = false;
          });
        });
      } else {
        // Bij volgende stappen op dezelfde pagina: normale transition
        highlight.style.transition = "opacity 0.18s ease-out";
      }

      // --- TOOLTIP POSITIONEREN ---

      // Content eerst bijwerken zodat de afmetingen kloppen
      this.updateTooltipContent(step, this.state.currentStepIndex);
      const tooltip = this.state.tooltipEl;
      const tooltipRect = tooltip.getBoundingClientRect();
      const baseGap = 20;

      // Anchor rect = de union van alle rects bij multiple, anders de eerste
      let anchor = firstRect;
      if (allowMultiple && rects.length > 1) {
        let minTop = rects[0].top;
        let minLeft = rects[0].left;
        let maxRight = rects[0].right;
        let maxBottom = rects[0].bottom;
        rects.forEach(r => {
          if (r.top < minTop) minTop = r.top;
          if (r.left < minLeft) minLeft = r.left;
          if (r.right > maxRight) maxRight = r.right;
          if (r.bottom > maxBottom) maxBottom = r.bottom;
        });
        anchor = {
          top: minTop,
          left: minLeft,
          right: maxRight,
          bottom: maxBottom,
          width: maxRight - minLeft,
          height: maxBottom - minTop
        };
      }

      const position = step?.position || "bottom";
      const tipOffset = step?.tipOffset || { x: 0, y: 0 };
      let tTop, tLeft;

      if (position === "right") {
        tTop = Math.max(anchor.top, 40) + (tipOffset.y || 0);
        tLeft = anchor.right + baseGap + (tipOffset.x || 0);
      } else if (position === "top") {
        tTop = anchor.top - tooltipRect.height - baseGap + (tipOffset.y || 0);
        tLeft = anchor.left + (tipOffset.x || 0);
      } else {
        // bottom (default)
        tTop = anchor.bottom + baseGap + (tipOffset.y || 0);
        tLeft = anchor.left + (tipOffset.x || 0);
      }

      // Extra per-step offset
      if (typeof step?.tooltipOffsetY === "number") {
        tTop += step.tooltipOffsetY;
      }

      // Clamp naar viewport
      if (tTop < 40) tTop = 40;
      if (tTop + tooltipRect.height > window.innerHeight - 16) {
        const altTop = anchor.top - tooltipRect.height - baseGap;
        tTop = Math.max(40, Math.min(altTop, window.innerHeight - tooltipRect.height - 16));
      }

      const maxTooltipWidth = 360;
      if (tLeft + maxTooltipWidth > window.innerWidth - 16) {
        tLeft = window.innerWidth - maxTooltipWidth - 16;
      }
      if (tLeft < 8) tLeft = 8;

      Object.assign(tooltip.style, {
        top: `${tTop}px`,
        left: `${tLeft}px`,
        opacity: "1",
        visibility: "visible",
        display: "flex"
      });
      tooltip.hidden = false;
    },
  };

  // Maak globaal beschikbaar
  window.GSTour = GSTour;
})();
