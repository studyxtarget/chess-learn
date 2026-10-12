// Board appearance settings: square-colour themes and piece sets.
// Nothing here touches React — it is plain, SSR-safe helpers that Board and
// SettingsPanel share. Choices persist in localStorage and are broadcast on a
// window event so every mounted board updates live.

export type BoardTheme = {
  id: string;
  name: string;
  /** Light-square colour. */
  light: string;
  /** Dark-square colour. */
  dark: string;
};

export const BOARD_THEME_KEY = "chesslearn.boardTheme";
export const PIECE_SET_KEY = "chesslearn.pieceSet";

/** Fired on window whenever any appearance setting changes. */
export const SETTINGS_EVENT = "chesslearn:settings";

export const THEMES: BoardTheme[] = [
  { id: "classic", name: "Green", light: "#ebecd0", dark: "#739552" },
  { id: "blue", name: "Blue", light: "#dee3e6", dark: "#4a7ba6" },
  { id: "wood", name: "Wood", light: "#dcb38c", dark: "#8b5a2b" },
  { id: "grey", name: "Grey", light: "#e9e9e9", dark: "#8d8d8d" },
  { id: "purple", name: "Purple", light: "#e9e2f3", dark: "#8a63c9" },
  { id: "contrast", name: "High contrast", light: "#ffffff", dark: "#2b2b2b" },
];

export const DEFAULT_THEME_ID = "wood";

export type PieceSet = {
  id: string;
  name: string;
  /** Public path prefix, always ending in "/". */
  path: string;
};

export const PIECE_SETS: PieceSet[] = [
  { id: "cburnett", name: "Classic", path: "/pieces/cburnett/" },
  { id: "merida", name: "Merida", path: "/pieces/merida/" },
];

export const DEFAULT_PIECE_SET_ID = "cburnett";

// ---------------------------------------------------------------- storage ---

function readLS(key: string): string | null {
  try {
    return typeof window !== "undefined" ? window.localStorage.getItem(key) : null;
  } catch {
    return null;
  }
}

function writeLS(key: string, value: string): void {
  try {
    if (typeof window !== "undefined") window.localStorage.setItem(key, value);
  } catch {
    /* private mode / quota — ignore */
  }
}

export function getTheme(id: string | null | undefined): BoardTheme {
  return THEMES.find((t) => t.id === id) ?? THEMES[0];
}

export function getPieceSet(id: string | null | undefined): PieceSet {
  return PIECE_SETS.find((p) => p.id === id) ?? PIECE_SETS[0];
}

export function getStoredThemeId(): string {
  const id = readLS(BOARD_THEME_KEY);
  return THEMES.some((t) => t.id === id) ? (id as string) : DEFAULT_THEME_ID;
}

export function getStoredPieceSetId(): string {
  const id = readLS(PIECE_SET_KEY);
  return PIECE_SETS.some((p) => p.id === id) ? (id as string) : DEFAULT_PIECE_SET_ID;
}

// ------------------------------------------------------------- application ---

/**
 * Apply a theme by setting the two CSS variables the board squares already use.
 * No other CSS needs to change.
 */
export function applyBoardTheme(id: string): void {
  if (typeof document === "undefined") return;
  const theme = getTheme(id);
  const root = document.documentElement;
  root.style.setProperty("--light-sq", theme.light);
  root.style.setProperty("--dark-sq", theme.dark);
  root.setAttribute("data-board-theme", theme.id);
}

function emit(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(SETTINGS_EVENT));
  }
}

export function setBoardTheme(id: string): void {
  const theme = getTheme(id);
  writeLS(BOARD_THEME_KEY, theme.id);
  applyBoardTheme(theme.id);
  emit();
}

export function setPieceSet(id: string): void {
  const set = getPieceSet(id);
  writeLS(PIECE_SET_KEY, set.id);
  emit();
}

/** Subscribe to appearance changes (this tab and, via `storage`, other tabs). */
export function subscribeSettings(cb: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const onStorage = (e: StorageEvent) => {
    if (
      !e.key ||
      e.key === BOARD_THEME_KEY ||
      e.key === PIECE_SET_KEY ||
      e.key === "chesslearn.sound"
    ) {
      cb();
    }
  };
  window.addEventListener(SETTINGS_EVENT, cb);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(SETTINGS_EVENT, cb);
    window.removeEventListener("storage", onStorage);
  };
}

/** Full asset path for one piece, following the app's lower-case naming. */
export function piecePath(setId: string, color: string, type: string): string {
  const set = getPieceSet(setId);
  return `${set.path}${color}${type}.svg`;
}
