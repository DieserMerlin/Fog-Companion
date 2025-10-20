import { Close, Delete } from '@mui/icons-material';
import Chip from '@mui/material/Chip';
import { ReactElement, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { create } from 'zustand';
import { kDbdGameId, kHotkeys } from '../../../consts';
import { useHotkeys } from '../../../utils/hooks/hotkey-hook';
import { useIngameApp } from '../use-ingame-app';
import { useTutorial } from '../welcome/AppTutorial';
import { useAppSettings } from './use-app-settings';

type HotkeyName = typeof kHotkeys[keyof typeof kHotkeys];
type Descriptor = { mainKey: string | null; mods: Mods; vk: number | null; label: string };

// --- Global edit state (only one chip can be in reassign mode) ---
type EditStore = {
  editingName: string | null;
  start: (name: string) => void;
  stop: () => void;
};
const useHotkeyEditStore = create<EditStore>((set) => ({
  editingName: null,
  start: (name) => set({ editingName: name }),
  stop: () => set({ editingName: null }),
}));

useAppSettings.subscribe(state => useHotkeyEditStore.getState().stop());
useIngameApp.subscribe(state => useHotkeyEditStore.getState().stop());
useTutorial.subscribe(state => useHotkeyEditStore.getState().stop());

type Mods = { ctrl: boolean; alt: boolean; shift: boolean };
const MOD_VKS = new Set([16, 17, 18, 91, 92]); // Shift, Ctrl, Alt, Meta/Win

function keyEventToDescriptor(e: KeyboardEvent): Descriptor {
  const mods: Mods = { ctrl: e.ctrlKey, alt: e.altKey, shift: e.shiftKey };

  // 1) VK direkt vom keydown – das ist genau das, was Overwolf erwartet
  //    (docs: "virtualKey corresponds to the keyDown event")
  //    https://dev.overwolf.com/.../hotkeys-api/
  const vk = typeof (e as any).keyCode === 'number'
    ? (e as any).keyCode as number
    : (typeof (e as any).which === 'number' ? (e as any).which as number : null);

  // 2) Für Label & Stabilität (Shift+1 etc.) 'mainKey' aus e.code/e.key ermitteln
  let mainKey: string | null = null;

  // Top-row digits -> stabil über e.code "DigitX"
  if (/^Digit[0-9]$/.test(e.code)) {
    mainKey = e.code.replace('Digit', ''); // "Digit1" -> "1"
  }

  // Buchstaben & Ziffern via e.key (falls noch nichts gesetzt)
  if (!mainKey && e.key && e.key.length === 1) {
    const ch = e.key.toUpperCase();
    if (/[A-Z0-9]/.test(ch)) mainKey = ch;
  }

  // Funktionstasten
  if (!mainKey && /^F\d{1,2}$/.test(e.key)) {
    mainKey = e.key;
  }

  // Sonstige commitwürdige Tasten (Pfeile, Navigation, Numpad, OEM)
  const codeCandidates = new Set([
    'Tab', 'Space', 'Enter', 'Backspace',
    'Insert', 'Delete', 'Home', 'End', 'PageUp', 'PageDown',
    'Minus', 'Equal', 'BracketLeft', 'BracketRight', 'Backslash',
    'Semicolon', 'Quote', 'Comma', 'Period', 'Slash', 'Backquote',
    'Numpad0', 'Numpad1', 'Numpad2', 'Numpad3', 'Numpad4', 'Numpad5', 'Numpad6', 'Numpad7', 'Numpad8', 'Numpad9',
    'NumpadMultiply', 'NumpadAdd', 'NumpadSubtract', 'NumpadDecimal', 'NumpadDivide',
    'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown',
  ]);
  if (!mainKey) {
    if (/^F\d{1,2}$/.test(e.code)) mainKey = e.code;
    else if (codeCandidates.has(e.code)) mainKey = e.code;
  }

  // 3) Label aufhübschen (immer stabil, z. B. „Shift+1“ statt „Shift+!“)
  const parts: string[] = [];
  if (mods.ctrl) parts.push('Ctrl');
  if (mods.alt) parts.push('Alt');
  if (mods.shift) parts.push('Shift');

  if (mainKey) {
    const pretty =
      mainKey === 'BracketLeft' ? '[' :
        mainKey === 'BracketRight' ? ']' :
          mainKey === 'Backslash' ? '\\' :
            mainKey === 'Semicolon' ? ';' :
              mainKey === 'Quote' ? '\'' :
                mainKey === 'Comma' ? ',' :
                  mainKey === 'Period' ? '.' :
                    mainKey === 'Slash' ? '/' :
                      mainKey === 'Minus' ? '-' :
                        mainKey === 'Equal' ? '=' :
                          mainKey === 'Backquote' ? '`' :
                            mainKey;
    parts.push(pretty);
  } else if (vk != null && !MOD_VKS.has(vk)) {
    // Fallback: wenn wir keinen hübschen Namen haben (z.B. exotische Taste),
    // wenigstens die VK-Zahl anzeigen
    parts.push(`VK${vk}`);
  }

  const label = parts.length ? parts.join('+') : 'Press keys…';
  return { mainKey, mods, vk, label };
}

type Props<T extends HotkeyName> = { name: T, small?: boolean, noDelete?: boolean, startIcon?: ReactElement };

export function SettingsHotkey<T extends HotkeyName>({ name, small, noDelete, startIcon }: Props<T>) {
  const hotkeys = useHotkeys();
  const binding = hotkeys[name] || 'Unassigned';

  // Global editing coordination
  const editingName = useHotkeyEditStore((s) => s.editingName);
  const startGlobal = useHotkeyEditStore((s) => s.start);
  const stopGlobal = useHotkeyEditStore((s) => s.stop);

  const [reassigning, setReassigning] = useState(false);
  const [tempLabel, setTempLabel] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const errorTimerRef = useRef<number | null>(null);
  const committingRef = useRef(false);

  // If another chip starts editing, exit this one
  useEffect(() => {
    if (editingName !== name && reassigning) {
      setReassigning(false);
      setTempLabel(null);
      committingRef.current = false;
    }
  }, [editingName, name, reassigning]);

  const startReassign = useCallback(() => {
    if (errorMsg) return; // locked during error display
    startGlobal(name as string);
    setReassigning(true);
    setTempLabel('Press keys…');
  }, [name, startGlobal, errorMsg]);

  const stopReassign = useCallback(() => {
    setReassigning(false);
    setTempLabel(null);
    committingRef.current = false;
    if (editingName === name) stopGlobal();
  }, [editingName, name, stopGlobal]);

  const showError = useCallback((msg: string) => {
    setErrorMsg(msg || 'Failed to assign');
    if (errorTimerRef.current) window.clearTimeout(errorTimerRef.current);
    errorTimerRef.current = window.setTimeout(() => {
      setErrorMsg(null);
      // fall back to whatever binding useHotkeys() shows
    }, 2000);
  }, []);

  useEffect(() => {
    return () => {
      if (errorTimerRef.current) window.clearTimeout(errorTimerRef.current);
    };
  }, []);

  const handleAssign = useCallback((vk: number, mods: Mods) => {
    committingRef.current = true;
    overwolf.settings.hotkeys.assign(
      {
        name: name as string,
        gameId: kDbdGameId,
        virtualKey: vk,
        modifiers: { ctrl: mods.ctrl, alt: mods.alt, shift: mods.shift },
      },
      (res: { success: boolean; error?: string | null }) => {
        stopReassign();
        if (!res?.success) {
          showError(res?.error || 'Assignment failed');
        }
      }
    );
  }, [name, stopReassign, showError]);

  const handleUnassign = useCallback(() => {
    if (errorMsg) return;
    stopReassign();
    overwolf.settings.hotkeys.unassign(
      {
        name: name as string,
        gameId: kDbdGameId,
      },
      (res: { success: boolean; error?: string | null }) => {
        if (!res?.success) {
          showError(res?.error || 'Unassign failed');
        }
      }
    );
  }, [name, stopReassign, showError, errorMsg]);

  useEffect(() => {
    if (!reassigning) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (errorMsg) return;

      // ESC bricht ab
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        stopReassign();
        return;
      }

      const { mainKey, mods, vk, label } = keyEventToDescriptor(e);
      setTempLabel(label);

      // UI nicht auslösen
      e.preventDefault();
      e.stopPropagation();

      // Commit nur bei echter Haupttaste (kein reiner Mod) + gültigem VK
      if (!committingRef.current && vk != null && !MOD_VKS.has(vk)) {
        handleAssign(vk, mods);
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (errorMsg) return;
      const { label } = keyEventToDescriptor(e);
      setTempLabel(label);
    };

    window.addEventListener('keydown', onKeyDown, { capture: true });
    window.addEventListener('keyup', onKeyUp, { capture: true });

    return () => {
      window.removeEventListener('keydown', onKeyDown as any, { capture: true } as any);
      window.removeEventListener('keyup', onKeyUp as any, { capture: true } as any);
    };
  }, [reassigning, handleAssign, stopReassign, errorMsg]);

  const label = useMemo(() => {
    if (errorMsg) return errorMsg;
    if (reassigning && tempLabel) return tempLabel;
    return binding || 'Unassigned';
  }, [errorMsg, reassigning, tempLabel, binding]);


  const chipProps = (errorMsg || noDelete) ? {} : reassigning
    ? ({ onDelete: stopReassign as (() => void), deleteIcon: <Close /> })
    : (!!binding && binding !== "Unassigned") ? { onDelete: handleUnassign as (() => void), deleteIcon: <Delete /> } : {};

  return (
    <Chip
      size={small ? 'small' : undefined}
      label={label}
      color={errorMsg ? 'error' : reassigning ? 'primary' : 'default'}
      variant={reassigning ? 'outlined' : 'filled'}
      onClick={!errorMsg ? (() => (!reassigning ? startReassign() : undefined)) : undefined}
      disabled={!!errorMsg}
      sx={{ cursor: errorMsg ? 'not-allowed' : 'pointer' }}
      icon={startIcon}
      {...chipProps}
    />
  );
}