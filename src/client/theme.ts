export type Theme = "forest" | "purple" | "walnut" | "refined";

const THEME_STORAGE_KEY = "chess-theme";
const THEME_PANEL_COLLAPSED_KEY = "chess-theme-panel-collapsed";

export type AnimationStyle = "smooth" | "epic";

const ANIMATION_STORAGE_KEY = "chess-animation-style";
const BLOOD_FX_STORAGE_KEY = "chess-blood-fx";

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
  document.querySelectorAll<HTMLElement>(".fx-btn").forEach((btn) => {
    const isActive = (btn.dataset.bloodfx === "on") === enabled;
    btn.classList.toggle("active", isActive);
    btn.setAttribute("aria-checked", String(isActive));
  });
  const event = new CustomEvent("bloodfxchange", { detail: { enabled } });
  window.dispatchEvent(event);
}

function setPanelCollapsed(widget: HTMLElement, toggleButton: HTMLButtonElement, collapsed: boolean): void {
  widget.classList.toggle("is-collapsed", collapsed);
  toggleButton.setAttribute("aria-expanded", String(!collapsed));
  toggleButton.textContent = collapsed ? "◀" : "▶";
  toggleButton.title = collapsed ? "Show customization" : "Hide customization";
  localStorage.setItem(THEME_PANEL_COLLAPSED_KEY, collapsed ? "1" : "0");
}

export function mountThemeSwitcher(): void {
  const themeRaw = localStorage.getItem(THEME_STORAGE_KEY);
  const savedTheme = (themeRaw === "forest" || themeRaw === "purple" || themeRaw === "walnut" || themeRaw === "refined")
    ? themeRaw
    : "forest";
  const collapsedRaw = localStorage.getItem(THEME_PANEL_COLLAPSED_KEY);
  const animationRaw = localStorage.getItem(ANIMATION_STORAGE_KEY);
  const savedAnimationStyle: AnimationStyle = animationRaw === "epic" ? "epic" : "smooth";
  
  const bloodFxRaw = localStorage.getItem(BLOOD_FX_STORAGE_KEY);
  const bloodFxEnabled = bloodFxRaw === "on";

  const defaultCollapsed = window.matchMedia("(max-width: 640px)").matches;
  const initialCollapsed = collapsedRaw === null ? defaultCollapsed : collapsedRaw === "1";

  setTheme(savedTheme);

  const widget = document.createElement("div");
  widget.className = "theme-switcher";
  widget.setAttribute("role", "group");
  widget.setAttribute("aria-label", "Theme and animation options");
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

    const fxBtn = (e.target as Element).closest<HTMLButtonElement>(".fx-btn");
    if (fxBtn?.dataset.bloodfx) setBloodFxEnabled(fxBtn.dataset.bloodfx === "on");
  });

  document.querySelectorAll<HTMLElement>(".animation-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.animation === savedAnimationStyle);
    btn.setAttribute("aria-checked", String(btn.dataset.animation === savedAnimationStyle));
  });

  document.querySelectorAll<HTMLElement>(".fx-btn").forEach((btn) => {
    const isActive = (btn.dataset.bloodfx === "on") === bloodFxEnabled;
    btn.classList.toggle("active", isActive);
    btn.setAttribute("aria-checked", String(isActive));
  });
}