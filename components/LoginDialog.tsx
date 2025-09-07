// src/components/LoginDialog.tsx
import React, { useEffect, useRef, useState } from "react";

interface LoginDialogProps {
  onSuccess: () => void;
  onClose: () => void;
}

const CORRECT_PASSWORD = (import.meta.env.VITE_APP_PASSWORD ?? "") as string;

export const LoginDialog: React.FC<LoginDialogProps> = ({ onSuccess, onClose }) => {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);
  const submitBtnRef = useRef<HTMLButtonElement | null>(null);
  const submittingRef = useRef(false);
  const isFocusedRef = useRef(false);

  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 100);
    return () => clearTimeout(t);
  }, []);

  // Sauberes, event-optional handleSubmit
  const handleSubmit = (e?: Event | React.FormEvent) => {
    try { e?.preventDefault?.(); } catch {}
    if (submittingRef.current) return;
    submittingRef.current = true;
    setTimeout(() => { submittingRef.current = false; }, 500);

    console.log("handleSubmit called (JS). pw length:", password.length);

    if (password === CORRECT_PASSWORD) {
      setError("");
      onSuccess();
      onClose();
    } else {
      setError("Falsches Passwort!");
      inputRef.current?.focus();
    }
  };

  // Gemeinsame Prüffunktion (React events)
  const checkForEnter = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Debug: was kommt an?
    console.log("React key event:", { type: e.type, key: e.key, code: (e as any).code, which: (e as any).which, keyCode: (e as any).keyCode });

    const key = e.key;
    const isEnter =
      key === "Enter" ||
      key === "Return" ||
      key === "Go" ||
      key === "Done" ||
      key === "Next" ||
      key === "Search" ||
      (typeof (e as any).which === "number" && (e as any).which === 13) ||
      (typeof (e as any).keyCode === "number" && (e as any).keyCode === 13);

    if (isEnter) {
      e.preventDefault();
      // bevorzugt: Klick auf echten Submit-Button (Browser-Submit-Fallback)
      if (submitBtnRef.current) {
        // kleiner Timeout, damit iOS ggf. DOM-Fokus/Keyboard abschließen kann
        setTimeout(() => submitBtnRef.current?.click(), 0);
      } else {
        handleSubmit();
      }
    }
  };

  // Globaler nativer Listener als Fallback (Capture-Phase)
  useEffect(() => {
    const nativeHandler = (e: KeyboardEvent) => {
      // Nur reagieren, wenn das Input gerade fokussiert ist
      if (!isFocusedRef.current) return;

      console.log("native key event:", { type: e.type, key: e.key, code: e.code, keyCode: e.keyCode });

      const k = e.key;
      const isEnter =
        k === "Enter" ||
        k === "Return" ||
        k === "Go" ||
        k === "Done" ||
        k === "Next" ||
        k === "Search" ||
        e.keyCode === 13;

      if (isEnter) {
        e.preventDefault();
        // Erst versuchen, echten Klick auszulösen (best compatibility)
        if (submitBtnRef.current) {
          submitBtnRef.current.click();
        } else {
          handleSubmit();
        }
      }
    };

    // Capture = true, damit wir Events fangen, die vorher gestoppt wurden
    window.addEventListener("keydown", nativeHandler, true);
    return () => window.removeEventListener("keydown", nativeHandler, true);
  }, [password]);

  return (
    <div
      className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50"
      role="dialog"
      aria-modal="true"
      // Capture auf Wrapper, falls Input-Events nicht durchkommen
      onKeyDownCapture={(e) => {
        // @ts-ignore
        checkForEnter(e);
      }}
    >
      <div className="bg-white rounded-2xl shadow-lg p-6 w-80">
        <h2 className="text-xl font-bold mb-4">🔐 Login</h2>
        <form
          onSubmit={(e) => handleSubmit(e)}
          className="flex flex-col gap-3"
          // fallback: falls ein externes Script 'submit' verhindert
          noValidate
        >
          <input
            ref={inputRef}
            type="password"
            placeholder="Passwort eingeben"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={checkForEnter}
            onKeyPress={checkForEnter}
            onKeyUp={checkForEnter}
            onFocus={() => { isFocusedRef.current = true; }}
            onBlur={() => { isFocusedRef.current = false; }}
            className="border rounded-lg p-2"
            autoComplete="current-password"
            autoCorrect="off"
            autoCapitalize="none"
            inputMode="text"
            enterKeyHint="go"
            required
            spellCheck={false}
          />
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1 bg-gray-300 rounded-lg"
            >
              Abbrechen
            </button>
            <button
              ref={submitBtnRef}
              type="submit"
              className="px-3 py-1 bg-blue-600 text-white rounded-lg"
            >
              Login
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
