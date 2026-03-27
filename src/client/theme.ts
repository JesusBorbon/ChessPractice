export type Theme = "forest" | "purple" | "walnut" | "refined";

const THEME_STORAGE_KEY = "chess-theme";
const THEME_PANEL_COLLAPSED_KEY = "chess-theme-panel-collapsed";

export type AnimationStyle = "smooth" | "epic";

const ANIMATION_STORAGE_KEY = "chess-animation-style";
const BLOOD_FX_STORAGE_KEY = "chess-blood-fx";
const LEGAL_MOVES_STORAGE_KEY = "chess-legal-moves"; // NEW

function setTheme(theme: Theme): void {
  if (theme === "forest") {
    document.documentElement.removeAttribute("data-theme");
  } else {
    document.documentElement.setAttribute("data-theme", theme);
  }
  localStorage.setItem(THEME_STORAGE_KEY, theme);
  document.querySelectorAll<HTMLElement>(".theme-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.theme === theme);
  });
}

function setAnimationStyle(style: AnimationStyle): void {
  localStorage.setItem(ANIMATION_STORAGE_KEY, style);
  document.querySelectorAll<HTMLElement>(".animation-btn").forEach((btn) => {
    const isActive = btn.dataset.animation === style;
    btn.classList.toggle("active", isActive);
    btn.setAttribute("aria-checked", String(isActive));
  });
  const event = new CustomEvent("animationchange", { detail: { style } });
  window.dispatchEvent(event);
}

function setBloodFxEnabled(enabled: boolean): void {
  localStorage.setItem(BLOOD_FX_STORAGE_KEY, enabled ? "on" : "off");
  document.querySelectorAll<HTMLElement>(".fx-btn:not(.legal-btn)").forEach((btn) => {
    const isActive = (btn.dataset.bloodfx === "on") === enabled;
    btn.classList.toggle("active", isActive);
    btn.setAttribute("aria-checked", String(isActive));
  });
  const event = new CustomEvent("bloodfxchange", { detail: { enabled } });
  window.dispatchEvent(event);
}

// NEW: Setter for Legal Moves
function setLegalMovesEnabled(enabled: boolean): void {
  localStorage.setItem(LEGAL_MOVES_STORAGE_KEY, enabled ? "on" : "off");
  document.querySelectorAll<HTMLElement>(".legal-btn").forEach((btn) => {
    const isActive = (btn.dataset.legal === "on") === enabled;
    btn.classList.toggle("active", isActive);
    btn.setAttribute("aria-checked", String(isActive));
  });
  const event = new CustomEvent("legalmoveschange", { detail: { enabled } });
  window.dispatchEvent(event);
}

function setPanelCollapsed(widget: HTMLElement, toggleBtn: HTMLButtonElement, collapsed: boolean): void {
  widget.classList.toggle("is-collapsed", collapsed);
  toggleBtn.setAttribute("aria-expanded", String(!collapsed));
  toggleBtn.style.transform = collapsed ? "rotate(0deg)" : "rotate(180deg)";
  localStorage.setItem(THEME_PANEL_COLLAPSED_KEY, collapsed ? "1" : "0");
}

export function mountThemeSwitcher(): void {
  const savedTheme = (localStorage.getItem(THEME_STORAGE_KEY) as Theme | null) || "forest";
  const savedAnimationStyle = (localStorage.getItem(ANIMATION_STORAGE_KEY) as AnimationStyle | null) || "smooth";
  
  const bloodFxRaw = localStorage.getItem(BLOOD_FX_STORAGE_KEY);
  const bloodFxEnabled = bloodFxRaw === "on";

  // NEW: Read legal moves state (defaults to true if not set)
  const legalMovesRaw = localStorage.getItem(LEGAL_MOVES_STORAGE_KEY);
  const legalMovesEnabled = legalMovesRaw !== "off"; 

  const collapsedRaw = localStorage.getItem(THEME_PANEL_COLLAPSED_KEY);
  const defaultCollapsed = window.matchMedia("(max-width: 640px)").matches;
  const initialCollapsed = collapsedRaw === null ? defaultCollapsed : collapsedRaw === "1";

  setTheme(savedTheme);

  const widget = document.createElement("div");
  widget.className = "theme-switcher";
  widget.setAttribute("role", "group");
  widget.setAttribute("aria-label", "Theme and animation options");
  
  // NEW: Added the "Watch Legal Moves" row
  widget.innerHTML = `
    <button class="theme-toggle-btn" type="button" aria-label="Toggle theme selector" aria-expanded="true">▶</button>
    <div class="theme-switcher-content">
      <div class="theme-switcher-row">
        <span class="theme-switcher-label">Theme</span>
        <div class="theme-switcher-options">
          <button class="theme-btn" data-theme="forest" title="Classic Forest" aria-label="Classic Forest theme"></button>
          <button class="theme-btn" data-theme="purple" title="Cosmic Purple" aria-label="Cosmic Purple theme"></button>
          <button class="theme-btn" data-theme="walnut" title="Walnut & Cream" aria-label="Walnut & Cream theme"></button>
          <button class="theme-btn" data-theme="refined" title="Refined" aria-label="Refined theme"></button>
        </div>
      </div>
      <div class="theme-switcher-row">
        <span class="theme-switcher-label">Animations</span>
        <div class="animation-segment" role="radiogroup" aria-label="Animation style">
          <button class="animation-btn" type="button" data-animation="smooth" role="radio" aria-label="Smooth animations">Smooth</button>
          <button class="animation-btn" type="button" data-animation="epic" role="radio" aria-label="Epic animations">Epic</button>
        </div>
      </div>
      <div class="theme-switcher-row">
        <span class="theme-switcher-label">Blood FX</span>
        <div class="fx-segment" role="radiogroup" aria-label="Blood effect toggle">
          <button class="fx-btn" type="button" data-bloodfx="off" role="radio" aria-label="Disable blood effect">Off</button>
          <button class="fx-btn" type="button" data-bloodfx="on" role="radio" aria-label="Enable blood effect">On</button>
        </div>
      </div>
      <div class="theme-switcher-row">
        <span class="theme-switcher-label">Watch Legal Moves</span>
        <div class="fx-segment" role="radiogroup" aria-label="Legal moves toggle">
          <button class="legal-btn fx-btn" type="button" data-legal="off" role="radio" aria-label="Hide legal moves">Off</button>
          <button class="legal-btn fx-btn" type="button" data-legal="on" role="radio" aria-label="Show legal moves">On</button>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(widget);

  const toggleButton = widget.querySelector<HTMLButtonElement>(".theme-toggle-btn");
  if (!toggleButton) return;

  setPanelCollapsed(widget, toggleButton, initialCollapsed);

  widget.addEventListener("click", (e) => {
    const toggle = (e.target as Element).closest<HTMLButtonElement>(".theme-toggle-btn");
    if (toggle) {
      const collapsed = !widget.classList.contains("is-collapsed");
      setPanelCollapsed(widget, toggleButton, collapsed);
      return;
    }

    const btn = (e.target as Element).closest<HTMLButtonElement>(".theme-btn");
    if (btn?.dataset.theme) setTheme(btn.dataset.theme as Theme);

    const animBtn = (e.target as Element).closest<HTMLButtonElement>(".animation-btn");
    if (animBtn?.dataset.animation) setAnimationStyle(animBtn.dataset.animation as AnimationStyle);

    // Differentiate between Blood FX and Legal Moves buttons
    const targetEl = e.target as Element;
    if (targetEl.closest(".legal-btn")) {
      const legalBtn = targetEl.closest<HTMLButtonElement>(".legal-btn");
      if (legalBtn?.dataset.legal) setLegalMovesEnabled(legalBtn.dataset.legal === "on");
    } else if (targetEl.closest(".fx-btn")) {
      const fxBtn = targetEl.closest<HTMLButtonElement>(".fx-btn");
      if (fxBtn?.dataset.bloodfx) setBloodFxEnabled(fxBtn.dataset.bloodfx === "on");
    }
  });

  document.querySelectorAll<HTMLElement>(".animation-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.animation === savedAnimationStyle);
    btn.setAttribute("aria-checked", String(btn.dataset.animation === savedAnimationStyle));
  });

  document.querySelectorAll<HTMLElement>(".fx-btn:not(.legal-btn)").forEach((btn) => {
    const isActive = (btn.dataset.bloodfx === "on") === bloodFxEnabled;
    btn.classList.toggle("active", isActive);
    btn.setAttribute("aria-checked", String(isActive));
  });

  // NEW: Initialize Legal Moves buttons
  document.querySelectorAll<HTMLElement>(".legal-btn").forEach((btn) => {
    const isActive = (btn.dataset.legal === "on") === legalMovesEnabled;
    btn.classList.toggle("active", isActive);
    btn.setAttribute("aria-checked", String(isActive));
  });
}