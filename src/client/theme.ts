type LegacyTheme = "forest" | "purple" | "walnut" | "refined" | "base" | "slate" | "crimson";
export type UiTheme = "purple" | "slate" | "walnut";
export type BoardTheme = LegacyTheme;
export type PieceThemeChoice = "original" | "chesscom" | "chesscomocean";
export type SoundThemeChoice = "original" | "chesscom";

const LEGACY_THEME_STORAGE_KEY = "chess-theme";
const UI_THEME_STORAGE_KEY = "chess-ui-theme";
const BOARD_THEME_STORAGE_KEY = "chess-board-theme";
const THEME_PANEL_COLLAPSED_KEY = "chess-theme-panel-collapsed";
const PIECE_THEME_STORAGE_KEY = "chess-piece-theme";
const SOUND_THEME_STORAGE_KEY = "chess-sound-theme";

export type AnimationStyle = "smooth" | "fast" | "epic";

const ANIMATION_STORAGE_KEY = "chess-animation-style";
const DRAG_EFFECT_STORAGE_KEY = "chess-drag-effect";
const BLOOD_FX_STORAGE_KEY = "chess-blood-fx";
const LEGAL_MOVES_STORAGE_KEY = "chess-legal-moves";
const UI_THEME_OPTIONS: readonly UiTheme[] = ["purple", "slate", "walnut"];
const BOARD_THEME_OPTIONS: readonly BoardTheme[] = ["forest", "purple", "walnut", "refined", "base", "slate", "crimson"];

export function normalizeAnimationStyle(value: string | null): AnimationStyle {
    if (value === "epic") return "epic";
    if (value === "fast") return "fast";
    return "smooth";
}

function normalizePieceTheme(value: string | null): PieceThemeChoice {
    if (value === "chesscom") return "chesscom";
    if (value === "chesscomocean" || value === "chessComOcean" || value === "chesscom-ocean") return "chesscomocean";
    return "original";
}

function normalizeSoundTheme(value: string | null): SoundThemeChoice {
    return value === "chesscom" ? "chesscom" : "original";
}

function normalizeLegacyTheme(value: string | null): LegacyTheme {
    if (value && BOARD_THEME_OPTIONS.includes(value as LegacyTheme)) {
        return value as LegacyTheme;
    }
    return "forest";
}

function normalizeUiTheme(value: string | null): UiTheme | null {
    if (value && UI_THEME_OPTIONS.includes(value as UiTheme)) {
        return value as UiTheme;
    }
    return null;
}

function normalizeBoardTheme(value: string | null): BoardTheme | null {
    if (value && BOARD_THEME_OPTIONS.includes(value as BoardTheme)) {
        return value as BoardTheme;
    }
    return null;
}

function mapLegacyToUiTheme(theme: LegacyTheme): UiTheme {
    if (theme === "purple") return "purple";
    if (theme === "slate" || theme === "refined") return "slate";
    return "walnut";
}

function resolveInitialUiTheme(): UiTheme {
    const savedUiTheme = normalizeUiTheme(localStorage.getItem(UI_THEME_STORAGE_KEY));
    if (savedUiTheme) return savedUiTheme;
    return mapLegacyToUiTheme(normalizeLegacyTheme(localStorage.getItem(LEGACY_THEME_STORAGE_KEY)));
}

function resolveInitialBoardTheme(): BoardTheme {
    const savedBoardTheme = normalizeBoardTheme(localStorage.getItem(BOARD_THEME_STORAGE_KEY));
    if (savedBoardTheme) return savedBoardTheme;
    return normalizeLegacyTheme(localStorage.getItem(LEGACY_THEME_STORAGE_KEY));
}

function setUiTheme(theme: UiTheme): void {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem(UI_THEME_STORAGE_KEY, theme);
    localStorage.setItem(LEGACY_THEME_STORAGE_KEY, theme);

    document.querySelectorAll<HTMLElement>(".ui-theme-btn").forEach((btn) => {
        const isActive = btn.dataset.uiTheme === theme;
        btn.classList.toggle("active", isActive);
        btn.setAttribute("aria-checked", String(isActive));
    });
}

function setBoardTheme(theme: BoardTheme): void {
    document.documentElement.setAttribute("data-board-theme", theme);
    localStorage.setItem(BOARD_THEME_STORAGE_KEY, theme);

    document.querySelectorAll<HTMLElement>(".board-theme-btn").forEach((btn) => {
        const isActive = btn.dataset.boardTheme === theme;
        btn.classList.toggle("active", isActive);
        btn.setAttribute("aria-checked", String(isActive));
    });
}

function setAnimationStyle(style: AnimationStyle): void {
    localStorage.setItem(ANIMATION_STORAGE_KEY, style);
    document.querySelectorAll<HTMLElement>(".animation-btn[data-animation]").forEach((btn) => {
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

function setPieceTheme(theme: PieceThemeChoice): void {
    localStorage.setItem(PIECE_THEME_STORAGE_KEY, theme);
    document.querySelectorAll<HTMLElement>(".piece-theme-btn").forEach((btn) => {
        const isActive = btn.dataset.pieceTheme === theme;
        btn.classList.toggle("active", isActive);
        btn.setAttribute("aria-checked", String(isActive));
    });
    const event = new CustomEvent("piecethemechange", { detail: { theme } });
    window.dispatchEvent(event);
}

function setSoundTheme(theme: SoundThemeChoice): void {
    localStorage.setItem(SOUND_THEME_STORAGE_KEY, theme);
    document.querySelectorAll<HTMLElement>(".sound-theme-btn").forEach((btn) => {
        const isActive = btn.dataset.soundTheme === theme;
        btn.classList.toggle("active", isActive);
        btn.setAttribute("aria-checked", String(isActive));
    });
    const event = new CustomEvent("soundthemechange", { detail: { theme } });
    window.dispatchEvent(event);
}

function setPanelCollapsed(widget: HTMLElement, toggleBtn: HTMLButtonElement, collapsed: boolean): void {
    widget.classList.toggle("is-collapsed", collapsed);
    toggleBtn.setAttribute("aria-expanded", String(!collapsed));
    toggleBtn.style.transform = collapsed ? "rotate(0deg)" : "rotate(180deg)";
    localStorage.setItem(THEME_PANEL_COLLAPSED_KEY, collapsed ? "1" : "0");
}

export function mountThemeSwitcher(): void {
    const savedUiTheme = resolveInitialUiTheme();
    const savedBoardTheme = resolveInitialBoardTheme();
    const savedAnimationStyle = normalizeAnimationStyle(localStorage.getItem(ANIMATION_STORAGE_KEY));
    const savedPieceTheme = normalizePieceTheme(localStorage.getItem(PIECE_THEME_STORAGE_KEY));
    const savedSoundTheme = normalizeSoundTheme(localStorage.getItem(SOUND_THEME_STORAGE_KEY));

    const bloodFxRaw = localStorage.getItem(BLOOD_FX_STORAGE_KEY);
    const bloodFxEnabled = bloodFxRaw === "on";

    const dragEffectRaw = localStorage.getItem(DRAG_EFFECT_STORAGE_KEY);
    const isEpicDrag = dragEffectRaw === "epic";
    document.documentElement.dataset.dragEffect = isEpicDrag ? "epic" : "smooth";

    const legalMovesRaw = localStorage.getItem(LEGAL_MOVES_STORAGE_KEY);
    const legalMovesEnabled = legalMovesRaw !== "off";

    const collapsedRaw = localStorage.getItem(THEME_PANEL_COLLAPSED_KEY);
    const defaultCollapsed = window.matchMedia("(max-width: 640px)").matches;
    const initialCollapsed = collapsedRaw === null ? defaultCollapsed : collapsedRaw === "1";

    setUiTheme(savedUiTheme);
    setBoardTheme(savedBoardTheme);

    const widget = document.createElement("div");
    widget.className = "theme-switcher";
    widget.setAttribute("role", "group");
    widget.setAttribute("aria-label", "Interface, board, piece, sound and animation options");

    widget.innerHTML = `
    <button class="theme-toggle-btn" type="button" aria-label="Toggle theme selector" aria-expanded="true">▶</button>
    <div class="theme-switcher-content">
      <div class="theme-switcher-row">
        <span class="theme-switcher-label">Interface Theme</span>
        <div class="theme-switcher-options" role="radiogroup" aria-label="Interface theme">
          <button class="theme-btn ui-theme-btn" data-ui-theme="purple" title="Cosmic Purple" role="radio" aria-label="Cosmic Purple interface"></button>
          <button class="theme-btn ui-theme-btn" data-ui-theme="slate" title="Soft Slate" role="radio" aria-label="Soft Slate interface"></button>
          <button class="theme-btn ui-theme-btn" data-ui-theme="walnut" title="Walnut and Cream" role="radio" aria-label="Walnut and Cream interface"></button>
        </div>
      </div>
      <div class="theme-switcher-row">
        <span class="theme-switcher-label">Board Style</span>
        <div class="theme-switcher-options board-theme-options" role="radiogroup" aria-label="Board theme">
          <button class="theme-btn board-theme-btn" data-board-theme="walnut" title="Walnut board" role="radio" aria-label="Walnut board"></button>
          <button class="theme-btn board-theme-btn" data-board-theme="purple" title="Cosmic Purple board" role="radio" aria-label="Cosmic Purple board"></button>
          <button class="theme-btn board-theme-btn" data-board-theme="slate" title="Soft Slate board" role="radio" aria-label="Soft Slate board"></button>
          <button class="theme-btn board-theme-btn" data-board-theme="crimson" title="Red Light board" role="radio" aria-label="Red Light board"></button>
          <button class="theme-btn board-theme-btn" data-board-theme="forest" title="Classic Forest board" role="radio" aria-label="Classic Forest board"></button>
          <button class="theme-btn board-theme-btn" data-board-theme="base" title="Base Amber board" role="radio" aria-label="Base Amber board"></button>
          <button class="theme-btn board-theme-btn" data-board-theme="refined" title="Refined Blue board" role="radio" aria-label="Refined Blue board"></button>
        </div>
      </div>
      <div class="theme-switcher-row">
        <span class="theme-switcher-label">Animations</span>
        <div class="animation-segment animation-style-segment" role="radiogroup" aria-label="Animation style">
          <button class="animation-btn" type="button" data-animation="smooth" role="radio" aria-label="Smooth animations">Smooth</button>
          <button class="animation-btn" type="button" data-animation="fast" role="radio" aria-label="Fast animations">Fast</button>
          <button class="animation-btn" type="button" data-animation="epic" role="radio" aria-label="Epic animations">Epic</button>
        </div>
      </div>
      <div class="theme-switcher-row">
        <span class="theme-switcher-label">Drag Effect</span>
        <div class="fx-segment drag-effect-segment" role="radiogroup" aria-label="Drag effect">
          <button class="drag-effect-btn fx-btn" type="button" data-drageffect="smooth" role="radio" aria-label="Smooth drag">Smooth</button>
          <button class="drag-effect-btn fx-btn" type="button" data-drageffect="epic" role="radio" aria-label="Epic drag">Epic</button>
        </div>
      </div>
      <div class="theme-switcher-row">
        <span class="theme-switcher-label">Piece Set</span>
        <div class="animation-segment piece-theme-segment" role="radiogroup" aria-label="Piece style">
          <button class="piece-theme-btn animation-btn" type="button" data-piece-theme="original" role="radio" aria-label="Use default pieces">
            <img class="piece-theme-preview" src="/pieces/wN.svg" alt="" aria-hidden="true" draggable="false">
            <span class="piece-theme-label">Default</span>
          </button>
          <button class="piece-theme-btn animation-btn" type="button" data-piece-theme="chesscom" role="radio" aria-label="Use Neo pieces">
            <img class="piece-theme-preview" src="/pieces/chessComPieces/wnCom.png" alt="" aria-hidden="true" draggable="false">
            <span class="piece-theme-label">Neo</span>
          </button>
          <button class="piece-theme-btn animation-btn" type="button" data-piece-theme="chesscomocean" role="radio" aria-label="Use Ocean pieces">
            <img class="piece-theme-preview" src="/pieces/chessComOcean/wn.png" alt="" aria-hidden="true" draggable="false">
            <span class="piece-theme-label">Ocean</span>
          </button>
        </div>
      </div>
      <div class="theme-switcher-row">
        <span class="theme-switcher-label">Sound Pack</span>
        <div class="animation-segment" role="radiogroup" aria-label="Sound style">
          <button class="sound-theme-btn animation-btn" type="button" data-sound-theme="original" role="radio" aria-label="Use original sounds">Original</button>
          <button class="sound-theme-btn animation-btn" type="button" data-sound-theme="chesscom" role="radio" aria-label="Use Chess.com sounds">Chess.com</button>
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

        const uiThemeBtn = (e.target as Element).closest<HTMLButtonElement>(".ui-theme-btn");
        if (uiThemeBtn?.dataset.uiTheme) {
            setUiTheme(uiThemeBtn.dataset.uiTheme as UiTheme);
            return;
        }

        const boardThemeBtn = (e.target as Element).closest<HTMLButtonElement>(".board-theme-btn");
        if (boardThemeBtn?.dataset.boardTheme) {
            setBoardTheme(boardThemeBtn.dataset.boardTheme as BoardTheme);
            return;
        }

        const pieceThemeBtn = (e.target as Element).closest<HTMLButtonElement>(".piece-theme-btn");
        if (pieceThemeBtn?.dataset.pieceTheme) {
            setPieceTheme(normalizePieceTheme(pieceThemeBtn.dataset.pieceTheme));
            return;
        }

        const soundThemeBtn = (e.target as Element).closest<HTMLButtonElement>(".sound-theme-btn");
        if (soundThemeBtn?.dataset.soundTheme) {
            setSoundTheme(normalizeSoundTheme(soundThemeBtn.dataset.soundTheme));
            return;
        }

        const animBtn = (e.target as Element).closest<HTMLButtonElement>(".animation-btn[data-animation]");
        if (animBtn?.dataset.animation) {
            setAnimationStyle(animBtn.dataset.animation as AnimationStyle);
            return;
        }

        const targetEl = e.target as Element;
        if (targetEl.closest(".drag-effect-btn")) {
            const dragBtn = targetEl.closest<HTMLButtonElement>(".drag-effect-btn");
            if (dragBtn?.dataset.drageffect) {
                const isEpic = dragBtn.dataset.drageffect === "epic";
                if (isEpic) document.documentElement.dataset.dragEffect = "epic";
                else document.documentElement.dataset.dragEffect = "smooth";
                localStorage.setItem(DRAG_EFFECT_STORAGE_KEY, dragBtn.dataset.drageffect);

                document.querySelectorAll<HTMLElement>(".drag-effect-btn").forEach((b) => {
                    const isActive = b.dataset.drageffect === dragBtn.dataset.drageffect;
                    b.classList.toggle("active", isActive);
                    b.setAttribute("aria-checked", String(isActive));
                });
            }
        } else if (targetEl.closest(".legal-btn")) {
            const legalBtn = targetEl.closest<HTMLButtonElement>(".legal-btn");
            if (legalBtn?.dataset.legal) setLegalMovesEnabled(legalBtn.dataset.legal === "on");
        } else if (targetEl.closest(".fx-btn")) {
            const fxBtn = targetEl.closest<HTMLButtonElement>(".fx-btn");
            if (fxBtn?.dataset.bloodfx) setBloodFxEnabled(fxBtn.dataset.bloodfx === "on");
        }
    });

    document.querySelectorAll<HTMLElement>(".ui-theme-btn").forEach((btn) => {
        const isActive = btn.dataset.uiTheme === savedUiTheme;
        btn.classList.toggle("active", isActive);
        btn.setAttribute("aria-checked", String(isActive));
    });

    document.querySelectorAll<HTMLElement>(".board-theme-btn").forEach((btn) => {
        const isActive = btn.dataset.boardTheme === savedBoardTheme;
        btn.classList.toggle("active", isActive);
        btn.setAttribute("aria-checked", String(isActive));
    });

    document.querySelectorAll<HTMLElement>(".animation-btn[data-animation]").forEach((btn) => {
        const isActive = btn.dataset.animation === savedAnimationStyle;
        btn.classList.toggle("active", isActive);
        btn.setAttribute("aria-checked", String(isActive));
    });

    document.querySelectorAll<HTMLElement>(".piece-theme-btn").forEach((btn) => {
        const isActive = btn.dataset.pieceTheme === savedPieceTheme;
        btn.classList.toggle("active", isActive);
        btn.setAttribute("aria-checked", String(isActive));
    });

    document.querySelectorAll<HTMLElement>(".sound-theme-btn").forEach((btn) => {
        const isActive = btn.dataset.soundTheme === savedSoundTheme;
        btn.classList.toggle("active", isActive);
        btn.setAttribute("aria-checked", String(isActive));
    });
    document.querySelectorAll<HTMLElement>(".drag-effect-btn").forEach((btn) => {
        const isActive = (btn.dataset.drageffect === "epic") === isEpicDrag;
        btn.classList.toggle("active", isActive);
        btn.setAttribute("aria-checked", String(isActive));
    });
    document.querySelectorAll<HTMLElement>(".fx-btn[data-bloodfx]").forEach((btn) => {
        const isActive = (btn.dataset.bloodfx === "on") === bloodFxEnabled;
        btn.classList.toggle("active", isActive);
        btn.setAttribute("aria-checked", String(isActive));
    });

    document.querySelectorAll<HTMLElement>(".legal-btn").forEach((btn) => {
        const isActive = (btn.dataset.legal === "on") === legalMovesEnabled;
        btn.classList.toggle("active", isActive);
        btn.setAttribute("aria-checked", String(isActive));
    });
}