/* ─────────────────────────────────────────────────────
   Earth Tennis Club — JS Animation Module
   ───────────────────────────────────────────────────── */

/* Tab button ripple on click */
export function initTabRipple() {
  document.querySelectorAll(".tab-button").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const r = document.createElement("span");
      r.className = "tab-ripple";
      const rect = btn.getBoundingClientRect();
      const size = Math.max(rect.width, rect.height);
      r.style.cssText = `
        width:${size}px; height:${size}px;
        left:${e.clientX - rect.left - size / 2}px;
        top:${e.clientY  - rect.top  - size / 2}px;
      `;
      btn.appendChild(r);
      r.addEventListener("animationend", () => r.remove());
    });
  });
}

/* Count-up animation for hero metric values */
export function initCountUp() {
  document.querySelectorAll(".metric-value").forEach((el) => {
    const raw = el.textContent.trim();
    const num = parseInt(raw, 10);
    if (isNaN(num)) return;

    const suffix = raw.replace(/^\d+/, "");
    const duration = 900;
    let startTime = null;

    function step(ts) {
      if (!startTime) startTime = ts;
      const p = Math.min((ts - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3); // ease-out cubic
      el.textContent = Math.floor(eased * num) + suffix;
      if (p < 1) requestAnimationFrame(step);
    }

    setTimeout(() => requestAnimationFrame(step), 600);
  });
}

/* Intersection Observer — reveal cards as they scroll into view
   (used for dynamically rendered content in long lists) */
export function initScrollReveal() {
  if (!("IntersectionObserver" in window)) return;

  const obs = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("sr-visible");
          obs.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.08, rootMargin: "0px 0px -24px 0px" }
  );

  /* Re-observe whenever new dynamic content appears */
  const mutObs = new MutationObserver(() => {
    document.querySelectorAll(
      ".gear-card:not(.sr-visible), .tournament-card:not(.sr-visible)"
    ).forEach((el) => {
      el.classList.add("sr-target");
      obs.observe(el);
    });
  });

  mutObs.observe(document.body, { childList: true, subtree: true });
}

/* Subtle tennis ball trail on mouse — draws fading dots behind cursor */
export function initBallTrail() {
  const POOL_SIZE = 12;
  const pool = [];
  let idx = 0;

  for (let i = 0; i < POOL_SIZE; i++) {
    const dot = document.createElement("div");
    dot.style.cssText = `
      position:fixed; pointer-events:none; z-index:9999;
      width:6px; height:6px; border-radius:50%;
      background:radial-gradient(circle at 35% 35%, #d4ff70, #7a9900);
      opacity:0; transition:opacity 0.4s ease, transform 0.4s ease;
      transform:translate(-50%,-50%) scale(0);
    `;
    document.body.appendChild(dot);
    pool.push(dot);
  }

  let lastX = 0, lastY = 0, ticking = false;

  document.addEventListener("mousemove", (e) => {
    const dx = e.clientX - lastX;
    const dy = e.clientY - lastY;
    if (dx * dx + dy * dy < 400) return; // only every ~20px movement

    lastX = e.clientX;
    lastY = e.clientY;

    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      const dot = pool[idx % POOL_SIZE];
      idx++;
      dot.style.left = `${lastX}px`;
      dot.style.top  = `${lastY}px`;
      dot.style.opacity = "0.32";
      dot.style.transform = "translate(-50%,-50%) scale(1)";

      clearTimeout(dot._t);
      dot._t = setTimeout(() => {
        dot.style.opacity = "0";
        dot.style.transform = "translate(-50%,-50%) scale(0.3)";
      }, 120);

      ticking = false;
    });
  });
}

/* Animate nav member area in when updated */
export function animateNavUpdate(el) {
  if (!el) return;
  el.style.animation = "none";
  void el.offsetWidth; // reflow
  el.style.animation = "";
}

/* Burst confetti for milestone events (e.g., first match record saved) */
export function burstConfetti(originEl) {
  if (!originEl) return;
  const rect = originEl.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top  + rect.height / 2;
  const colors = ["#c8e823", "#00C2E8", "#0047A0", "#F59E0B", "#fff"];

  for (let i = 0; i < 18; i++) {
    const p = document.createElement("div");
    const color = colors[i % colors.length];
    const angle = (i / 18) * 360;
    const dist = 60 + Math.random() * 80;
    const size = 5 + Math.random() * 5;

    p.style.cssText = `
      position:fixed; pointer-events:none; z-index:9999;
      left:${cx}px; top:${cy}px;
      width:${size}px; height:${size}px;
      border-radius:${Math.random() > 0.5 ? "50%" : "2px"};
      background:${color};
      transform:translate(-50%,-50%);
      animation:confetti-fly 0.7s cubic-bezier(0.22,1,0.36,1) ${i * 18}ms both;
      --dx:${Math.cos((angle * Math.PI) / 180) * dist}px;
      --dy:${Math.sin((angle * Math.PI) / 180) * dist}px;
    `;
    document.body.appendChild(p);
    p.addEventListener("animationend", () => p.remove());
  }
}

/* inject confetti keyframe once */
if (!document.getElementById("confetti-style")) {
  const s = document.createElement("style");
  s.id = "confetti-style";
  s.textContent = `
    @keyframes confetti-fly {
      0%   { opacity:1; transform:translate(-50%,-50%) scale(1); }
      100% { opacity:0; transform:translate(calc(-50% + var(--dx)), calc(-50% + var(--dy))) scale(0.3) rotate(360deg); }
    }
  `;
  document.head.appendChild(s);
}
