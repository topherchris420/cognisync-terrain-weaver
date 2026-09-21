import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import {
  SensorOpticMode,
  OPTIC_MODES,
  playTacticalSound,
  type OpticConfig,
} from "./sensor-optics";

interface SensorOpticsContextType {
  mode: SensorOpticMode;
  setMode: (mode: SensorOpticMode) => void;
  opticConfig: OpticConfig;
  hudOpen: boolean;
  setHudOpen: React.Dispatch<React.SetStateAction<boolean>>;
  commandPaletteOpen: boolean;
  setCommandPaletteOpen: React.Dispatch<React.SetStateAction<boolean>>;
  detectionOpen: boolean;
  setDetectionOpen: React.Dispatch<React.SetStateAction<boolean>>;
  soundEnabled: boolean;
  setSoundEnabled: React.Dispatch<React.SetStateAction<boolean>>;
  cycleMode: () => void;
}

const SensorOpticsContext = createContext<SensorOpticsContextType | null>(null);

export function SensorOpticsProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<SensorOpticMode>("NORMAL");
  const [hudOpen, setHudOpen] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [detectionOpen, setDetectionOpen] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);

  const opticConfig = OPTIC_MODES[mode];

  const setMode = useCallback(
    (nextMode: SensorOpticMode) => {
      setModeState(nextMode);
      if (soundEnabled) {
        playTacticalSound("switch");
      }
    },
    [soundEnabled]
  );

  const cycleMode = useCallback(() => {
    const modes: SensorOpticMode[] = ["NORMAL", "NVG", "FLIR", "CRT", "NOIR", "IR"];
    const currentIndex = modes.indexOf(mode);
    const nextIndex = (currentIndex + 1) % modes.length;
    setMode(modes[nextIndex]);
  }, [mode, setMode]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept typing in input fields
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }

      // Cmd+K or Ctrl+K for Command Palette
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCommandPaletteOpen((prev) => !prev);
        if (soundEnabled) playTacticalSound("click");
        return;
      }

      // Key 1-6 for Sensor Optics
      if (!e.metaKey && !e.ctrlKey && !e.altKey) {
        if (e.key === "1") {
          e.preventDefault();
          setMode("NORMAL");
        } else if (e.key === "2") {
          e.preventDefault();
          setMode("NVG");
        } else if (e.key === "3") {
          e.preventDefault();
          setMode("FLIR");
        } else if (e.key === "4") {
          e.preventDefault();
          setMode("CRT");
        } else if (e.key === "5") {
          e.preventDefault();
          setMode("NOIR");
        } else if (e.key === "6") {
          e.preventDefault();
          setMode("IR");
        } else if (e.key.toLowerCase() === "h") {
          e.preventDefault();
          setHudOpen((prev) => !prev);
          if (soundEnabled) playTacticalSound("click");
        } else if (e.key.toLowerCase() === "d") {
          e.preventDefault();
          setDetectionOpen((prev) => !prev);
          if (soundEnabled) playTacticalSound("click");
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [setMode, soundEnabled]);

  return (
    <SensorOpticsContext.Provider
      value={{
        mode,
        setMode,
        opticConfig,
        hudOpen,
        setHudOpen,
        commandPaletteOpen,
        setCommandPaletteOpen,
        detectionOpen,
        setDetectionOpen,
        soundEnabled,
        setSoundEnabled,
        cycleMode,
      }}
    >
      <div
        className="relative w-full h-full"
        style={{
          filter: opticConfig.cssFilter !== "none" ? opticConfig.cssFilter : undefined,
          transition: "filter 0.3s ease-in-out",
        }}
      >
        {children}
        {opticConfig.overlayClass && (
          <div
            className={`fixed inset-0 z-50 pointer-events-none ${opticConfig.overlayClass}`}
            aria-hidden="true"
          />
        )}
      </div>
    </SensorOpticsContext.Provider>
  );
}

export function useSensorOptics() {
  const ctx = useContext(SensorOpticsContext);
  if (!ctx) {
    throw new Error("useSensorOptics must be used within a SensorOpticsProvider");
  }
  return ctx;
}
