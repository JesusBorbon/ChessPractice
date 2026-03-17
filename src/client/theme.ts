export type Theme = "forest" | "purple" | "walnut" | "refined";

const THEME_STORAGE_KEY = "chess-theme";
const THEME_PANEL_COLLAPSED_KEY = "chess-theme-panel-collapsed";

export type AnimationStyle = "smooth" | "epic";

const ANIMATION_STORAGE_KEY = "chess-animation-style";

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
      btn.classList.toggle("active", btn.dataset.animation === style);
    });
    // Actualizar el estado en la app
    const event = new CustomEvent("animationchange", { detail: { style } });
    window.dispatchEvent(event);
  }
function setPanelCollapsed(widget: HTMLElement, toggleButton: HTMLButtonElement, collapsed: boolean): void {
  widget.classList.toggle("is-collapsed", collapsed);
  toggleButton.setAttribute("aria-expanded", String(!collapsed));
  toggleButton.textContent = collapsed ? "◀" : "▶";
  toggleButton.title = collapsed ? "Show themes" : "Hide themes";
  localStorage.setItem(THEME_PANEL_COLLAPSED_KEY, collapsed ? "1" : "0");
}

export function mountThemeSwitcher(): void {
  const themeRaw = localStorage.getItem(THEME_STORAGE_KEY);
  const savedTheme = (themeRaw === "forest" || themeRaw === "purple" || themeRaw === "walnut" || themeRaw === "refined") ? themeRaw : "forest";
  const collapsedRaw = localStorage.getItem(THEME_PANEL_COLLAPSED_KEY);
  const defaultCollapsed = window.matchMedia("(max-width: 640px)").matches;
  const initialCollapsed = collapsedRaw === null ? defaultCollapsed : collapsedRaw === "1";

  setTheme(savedTheme);

  const widget = document.createElement("div");
  widget.className = "theme-switcher";
  widget.setAttribute("role", "group");
  widget.setAttribute("aria-label", "Choose theme");
  widget.innerHTML = `
    <button class="theme-toggle-btn" type="button" aria-label="Toggle theme selector" aria-expanded="true">▶</button>
    <div class="theme-switcher-options">
      <span class="theme-switcher-label">Theme</span>
      <button class="theme-btn" data-theme="forest" title="Classic Forest" aria-label="Classic Forest theme"></button>
      <button class="theme-btn" data-theme="purple" title="Cosmic Purple" aria-label="Cosmic Purple theme"></button>
      <button class="theme-btn" data-theme="walnut" title="Walnut & Cream" aria-label="Walnut & Cream theme"></button>
      <button class="theme-btn" data-theme="refined" title="Refined" aria-label="Refined theme"></button>
    </div>
  `;

    // Agregar estilos de animación solo si hay una partida en curso
    const savedAnimationStyle = (localStorage.getItem(ANIMATION_STORAGE_KEY) ?? "smooth") as AnimationStyle;
    const animationsHtml = `
      <div class="animation-switcher-options" id="animationOptions">
        <span class="theme-switcher-label">Animations</span>
        <button class="animation-btn" data-animation="smooth" title="Smooth" aria-label="Smooth animations"></button>
        <button class="animation-btn" data-animation="epic" title="Epic" aria-label="Epic animations"></button>
      </div>
    `;
    widget.innerHTML += animationsHtml;
  document.body.appendChild(widget);

  const toggleButton = widget.querySelector<HTMLButtonElement>(".theme-toggle-btn");
  if (!toggleButton) {
    return;
  }

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
  });

    // Inicializar botones de animación con estilo guardado (usando la var declarada arriba)
    document.querySelectorAll<HTMLElement>(".animation-btn").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.animation === savedAnimationStyle);
    });

    // Manejar clics en botones de animación
    document.addEventListener("click", (e) => {
      const animBtn = (e.target as Element).closest<HTMLButtonElement>(".animation-btn");
      if (animBtn?.dataset.animation) {
        setAnimationStyle(animBtn.dataset.animation as AnimationStyle);
      }
    });
}
