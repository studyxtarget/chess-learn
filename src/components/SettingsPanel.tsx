"use client";

import { useEffect, useState } from "react";
import { asset } from "@/lib/data";
import {
  PIECE_SETS,
  THEMES,
  applyBoardTheme,
  getStoredPieceSetId,
  getStoredThemeId,
  piecePath,
  setBoardTheme,
  setPieceSet,
  subscribeSettings,
} from "@/lib/theme";
import { isSoundOn, playSound, setSoundOn } from "@/lib/sounds";

type Props = {
  open: boolean;
  onClose: () => void;
};

/**
 * Appearance settings, presented as a bottom sheet that reuses the existing
 * `.sheet` / `.sheet-backdrop` pattern from the Analyze page.
 */
export default function SettingsPanel({ open, onClose }: Props) {
  const [themeId, setThemeId] = useState("classic");
  const [pieceSetId, setPieceSetId] = useState("cburnett");
  const [soundOn, setSoundOnState] = useState(true);

  // Sync local state from storage when the sheet opens (and on any change).
  useEffect(() => {
    if (!open) return;
    const sync = () => {
      setThemeId(getStoredThemeId());
      setPieceSetId(getStoredPieceSetId());
      setSoundOnState(isSoundOn());
    };
    sync();
    return subscribeSettings(sync);
  }, [open]);

  // Escape closes; lock background scroll while open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  function chooseTheme(id: string) {
    setThemeId(id);
    setBoardTheme(id);
    applyBoardTheme(id);
    playSound("move");
  }

  function choosePieceSet(id: string) {
    setPieceSetId(id);
    setPieceSet(id);
  }

  function toggleSound() {
    const next = !soundOn;
    setSoundOnState(next);
    setSoundOn(next);
    if (next) playSound("promotion");
  }

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div
        className="sheet settings-sheet"
        role="dialog"
        aria-modal="true"
        aria-label="Settings"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sheet-head">
          <span className="sheet-handle" />
          <button type="button" onClick={onClose} aria-label="Close settings">
            ✕
          </button>
        </div>

        <h3 className="settings-title">Settings</h3>

        <section className="settings-section">
          <h4 className="settings-label">Board theme</h4>
          <div className="theme-grid" role="group" aria-label="Board theme">
            {THEMES.map((t) => (
              <button
                key={t.id}
                type="button"
                className={`theme-swatch${t.id === themeId ? " active" : ""}`}
                aria-pressed={t.id === themeId}
                onClick={() => chooseTheme(t.id)}
              >
                <span className="theme-preview" aria-hidden="true">
                  <span className="tp-sq" style={{ background: t.light }} />
                  <span className="tp-sq" style={{ background: t.dark }} />
                  <span className="tp-sq" style={{ background: t.dark }} />
                  <span className="tp-sq" style={{ background: t.light }} />
                </span>
                <span className="theme-name">{t.name}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="settings-section">
          <h4 className="settings-label">Piece set</h4>
          <div className="piece-grid" role="group" aria-label="Piece set">
            {PIECE_SETS.map((ps) => (
              <button
                key={ps.id}
                type="button"
                className={`piece-opt${ps.id === pieceSetId ? " active" : ""}`}
                aria-pressed={ps.id === pieceSetId}
                onClick={() => choosePieceSet(ps.id)}
              >
                <span className="piece-preview" aria-hidden="true">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={asset(piecePath(ps.id, "w", "n"))} alt="" draggable={false} />
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={asset(piecePath(ps.id, "b", "k"))} alt="" draggable={false} />
                </span>
                <span className="piece-name">{ps.name}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="settings-section">
          <h4 className="settings-label">Sound</h4>
          <button
            type="button"
            className="toggle-row"
            aria-pressed={soundOn}
            onClick={toggleSound}
          >
            <span className="toggle-txt">
              Move sounds
              <span className="toggle-sub">{soundOn ? "On" : "Off"}</span>
            </span>
            <span className={`switch${soundOn ? " on" : ""}`} aria-hidden="true">
              <span className="knob" />
            </span>
          </button>
        </section>

        <p className="settings-note">
          Settings are saved in this browser and applied automatically the next
          time you open the app.
        </p>
      </div>
    </div>
  );
}
