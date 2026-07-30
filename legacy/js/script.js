/* ── 1. THEME TOGGLE ── */
const themeBtn = document.getElementById("themeBtn");
const themeIcon = document.getElementById("themeIcon");
const html = document.documentElement;

const saved =
  localStorage.getItem("theme") ||
  (window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light");

html.setAttribute("data-theme", saved);
themeIcon.innerHTML =
  saved === "dark" ? '<use href="#ico-sun"/>' : '<use href="#ico-moon"/>';

themeBtn.addEventListener("click", () => {
  const next = html.getAttribute("data-theme") === "light" ? "dark" : "light";
  html.setAttribute("data-theme", next);
  localStorage.setItem("theme", next);
  themeIcon.innerHTML =
    next === "dark" ? '<use href="#ico-sun"/>' : '<use href="#ico-moon"/>';
  // Visual feedback: flash the button
  themeBtn.classList.add("theme-btn--active");
  setTimeout(() => themeBtn.classList.remove("theme-btn--active"), 300);
});

/* ── 2. MOBILE HAMBURGER ── */
const menuBtn = document.getElementById("menuBtn");
const navLinks = document.getElementById("navLinks");

function closeMenu() {
  navLinks.classList.remove("open");
  menuBtn.setAttribute("aria-expanded", "false");
  menuBtn.querySelector("svg").innerHTML = '<use href="#ico-menu"/>';
}

menuBtn.addEventListener("click", () => {
  const open = navLinks.classList.toggle("open");
  menuBtn.setAttribute("aria-expanded", open);
  menuBtn.querySelector("svg").innerHTML = open
    ? '<use href="#ico-close"/>'
    : '<use href="#ico-menu"/>';
});

navLinks
  .querySelectorAll("a")
  .forEach((a) => a.addEventListener("click", closeMenu));
themeBtn.addEventListener("click", closeMenu);
document.addEventListener("click", (e) => {
  if (!menuBtn.contains(e.target) && !navLinks.contains(e.target)) closeMenu();
});

/* ── 3. TYPING EFFECT ── */
const phrases = [
  "Future Primary School Teacher (12+4)",
  "Passionate Mathematics Educator",
  "Inspiring Young Minds",
  "Making Learning Enjoyable",
  "Open to Teaching Opportunities",
];
const typingEl = document.getElementById("typingText");
let pIdx = 0,
  cIdx = 0,
  del = false;

function type() {
  const p = phrases[pIdx];
  typingEl.textContent = del ? p.slice(0, --cIdx) : p.slice(0, ++cIdx);
  if (!del && cIdx === p.length) {
    del = true;
    setTimeout(type, 1800);
    return;
  }
  if (del && cIdx === 0) {
    del = false;
    pIdx = (pIdx + 1) % phrases.length;
  }
  setTimeout(type, del ? 45 : 75);
}
type();

/* ── 4. INTERSECTION OBSERVER — scroll-reveal + skill bars + progress bars ── */
let skillsDone = false;
let projectsDone = false;

const obs = new IntersectionObserver(
  (entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      e.target.classList.add("visible");
      if (e.target.id === "skills" && !skillsDone) {
        document.querySelectorAll(".sk-fill").forEach((b) => {
          setTimeout(() => {
            b.style.width = b.dataset.w + "%";
          }, 100);
        });
        skillsDone = true;
      }
      if (e.target.id === "projects" && !projectsDone) {
        document.querySelectorAll(".pj-progress-fill").forEach((b) => {
          setTimeout(() => {
            b.style.width = b.dataset.w + "%";
          }, 150);
        });
        projectsDone = true;
      }
    });
  },
  { threshold: 0.08, rootMargin: "0px 0px -60px 0px" },
);

document.querySelectorAll("section").forEach((s) => obs.observe(s));
document.querySelector(".hero").classList.add("visible");

/* ── 5. SCROLLSPY ── */
const navAnchors = document.querySelectorAll(".nav-links a");
const sections = document.querySelectorAll("section[id]");

const spyObs = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        navAnchors.forEach((a) => a.classList.remove("active"));
        const active = document.querySelector(
          `.nav-links a[href="#${entry.target.id}"]`,
        );
        if (active) active.classList.add("active");
      }
    });
  },
  { threshold: 0.35, rootMargin: "-60px 0px -35% 0px" },
);
sections.forEach((s) => spyObs.observe(s));

/* ── 6. BACK TO TOP ── */
const b2t = document.getElementById("b2t");
window.addEventListener(
  "scroll",
  () => {
    b2t.classList.toggle("show", window.scrollY > 350);
  },
  { passive: true },
);
b2t.addEventListener("click", () =>
  window.scrollTo({ top: 0, behavior: "smooth" }),
);

/* ── 7. AVAILABILITY BANNER DISMISS ── */
const bannerClose = document.getElementById("bannerClose");
const availBanner = document.getElementById("availBanner");
if (bannerClose && availBanner) {
  if (sessionStorage.getItem("bannerDismissed"))
    availBanner.classList.add("hidden");
  bannerClose.addEventListener("click", () => {
    availBanner.classList.add("hidden");
    sessionStorage.setItem("bannerDismissed", "1");
  });
}

/* ── 8. PROJECTS CAROUSEL — 3-peek + scale/zoom transition ── */
const track = document.getElementById("pjTrack");
const dotsContainer = document.getElementById("pjDots");
const prevBtn = document.getElementById("pjPrev");
const nextBtn = document.getElementById("pjNext");

if (track) {
  const cards = Array.from(track.querySelectorAll(".pj-card"));
  let current = 0;
  let animating = false;

  // Build dots
  cards.forEach((_, i) => {
    const dot = document.createElement("button");
    dot.className = "pj-dot" + (i === 0 ? " active" : "");
    dot.setAttribute("aria-label", `Go to project ${i + 1}`);
    dot.addEventListener("click", () => goTo(i));
    dotsContainer.appendChild(dot);
  });

  function updateCards() {
    cards.forEach((card, i) => {
      card.classList.remove(
        "pj-active",
        "pj-peek-left",
        "pj-peek-right",
        "pj-hidden",
      );
      const diff = i - current;
      if (diff === 0) {
        card.classList.add("pj-active");
      } else if (diff === -1 || (current === 0 && i === cards.length - 1)) {
        card.classList.add("pj-peek-left");
      } else if (diff === 1 || (current === cards.length - 1 && i === 0)) {
        card.classList.add("pj-peek-right");
      } else {
        card.classList.add("pj-hidden");
      }
    });

    document.querySelectorAll(".pj-dot").forEach((d, i) => {
      d.classList.toggle("active", i === current);
    });

    prevBtn.disabled = current === 0;
    nextBtn.disabled = current === cards.length - 1;
  }

  function goTo(index) {
    if (animating) return;
    const next = Math.max(0, Math.min(index, cards.length - 1));
    if (next === current) return;
    animating = true;

    // Zoom out active card
    const activeCard = cards[current];
    activeCard.classList.add("pj-zoom-out");

    setTimeout(() => {
      current = next;
      updateCards();
      // Zoom in new active card
      cards[current].classList.add("pj-zoom-in");
      setTimeout(() => {
        cards.forEach((c) => c.classList.remove("pj-zoom-out", "pj-zoom-in"));
        animating = false;
      }, 350);
    }, 200);
  }

  prevBtn.addEventListener("click", () => goTo(current - 1));
  nextBtn.addEventListener("click", () => goTo(current + 1));

  // Touch/swipe support
  let startX = 0;
  track.addEventListener(
    "touchstart",
    (e) => {
      startX = e.touches[0].clientX;
    },
    { passive: true },
  );
  track.addEventListener("touchend", (e) => {
    const diff = startX - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 50) goTo(diff > 0 ? current + 1 : current - 1);
  });

  // Init
  updateCards();
}

/* ── 9. CONTACT FORM ── */
const form = document.getElementById("ctForm");
const fMsg = document.getElementById("fMsg");
const submitBtn = form.querySelector(".sub-btn");
const EMAIL_RE = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/;

let fMsgTimer = null;
let countdownTimer = null;

function showMsg(text, type, autohide = true) {
  clearTimeout(fMsgTimer);
  fMsg.textContent = text;
  fMsg.className = `f-msg ${type}`;
  fMsg.style.display = "block";
  if (autohide)
    fMsgTimer = setTimeout(() => {
      fMsg.style.display = "none";
    }, 7000);
}

function resetBtn() {
  submitBtn.innerHTML =
    '<svg stroke="currentColor" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><use href="#ico-send"/></svg> Send Message';
  submitBtn.disabled = false;
}

function formatTime(seconds) {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60),
    s = seconds % 60;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

function startCooldownUI(secondsLeft, reason) {
  clearTimeout(fMsgTimer);
  clearInterval(countdownTimer);
  submitBtn.disabled = true;
  let remaining = secondsLeft;
  function tick() {
    remaining--;
    if (remaining <= 0) {
      clearInterval(countdownTimer);
      resetBtn();
      fMsg.style.display = "none";
      return;
    }
    const label =
      reason === "hourly"
        ? `⏳ Limit reached. Try again in ${formatTime(remaining)}.`
        : `⏳ Please wait ${formatTime(remaining)} before sending again.`;
    fMsg.textContent = label;
    fMsg.className = "f-msg err";
    fMsg.style.display = "block";
    submitBtn.innerHTML = `<svg stroke="currentColor" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><use href="#ico-send"/></svg> Wait ${formatTime(remaining)}`;
  }
  tick();
  countdownTimer = setInterval(tick, 1000);
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const n = form.name.value.trim();
  const em = form.email.value.trim();
  const mg = form.message.value.trim();

  if (!n || !em || !mg) {
    showMsg("⚠️ Please fill in all fields.", "err");
    return;
  }
  if (!EMAIL_RE.test(em)) {
    showMsg("⚠️ Please enter a valid email address.", "err");
    return;
  }
  if (n.length > 100) {
    showMsg("⚠️ Name is too long (max 100 characters).", "err");
    return;
  }
  if (mg.length > 2000) {
    showMsg("⚠️ Message is too long (max 2000 characters).", "err");
    return;
  }

  submitBtn.innerHTML =
    '<svg stroke="currentColor" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><use href="#ico-send"/></svg> Sending…';
  submitBtn.disabled = true;

  try {
    const res = await fetch("/.netlify/functions/contact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: n, email: em, message: mg }),
    });
    const data = await res.json();
    if (res.ok) {
      showMsg("✅ Message sent! I'll get back to you soon.", "ok");
      form.reset();
      resetBtn();
    } else if (res.status === 429) {
      startCooldownUI(data.secondsLeft || 120, data.reason || "cooldown");
    } else {
      showMsg(
        `❌ ${data.error || "Something went wrong. Please email me directly."}`,
        "err",
      );
      resetBtn();
    }
  } catch {
    showMsg("❌ Network error. Please email me directly.", "err");
    resetBtn();
  }
});

/* ── 10. AUTO-UPDATE COPYRIGHT YEAR ── */
document.getElementById("yr").textContent = new Date().getFullYear();