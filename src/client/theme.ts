export type Theme = "forest" | "purple" | "walnut" | "refined";

const THEME_STORAGE_KEY = "chess-theme";

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

export function mountThemeSwitcher(): void {
  const themeRaw = localStorage.getItem(THEME_STORAGE_KEY);
  const savedTheme = (themeRaw === "forest" || themeRaw === "purple" || themeRaw === "walnut" || themeRaw === "refined") ? themeRaw : "forest";

  setTheme(savedTheme);

  const widget = document.createElement("div");
  widget.className = "theme-switcher";
  widget.setAttribute("role", "group");
  widget.setAttribute("aria-label", "Choose theme");
  widget.innerHTML = `
    <span class="theme-switcher-label">Theme</span>
    <button class="theme-btn" data-theme="forest" title="Classic Forest" aria-label="Classic Forest theme"></button>
    <button class="theme-btn" data-theme="purple" title="Cosmic Purple" aria-label="Cosmic Purple theme"></button>
    <button class="theme-btn" data-theme="walnut" title="Walnut & Cream" aria-label="Walnut & Cream theme"></button>
    <button class="theme-btn" data-theme="refined" title="Refined" aria-label="Refined theme"></button>
  `;
  document.body.appendChild(widget);

  widget.addEventListener("click", (e) => {
    const btn = (e.target as Element).closest<HTMLButtonElement>(".theme-btn");
    if (btn?.dataset.theme) setTheme(btn.dataset.theme as Theme);
  });
}
