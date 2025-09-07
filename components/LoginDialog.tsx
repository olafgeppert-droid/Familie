// src/components/LoginDialog.tsx
import React, { useState, useEffect, useRef } from "react";

interface LoginDialogProps {
  onSuccess: () => void;
  onClose: () => void;
}

const CORRECT_PASSWORD = import.meta.env.VITE_APP_PASSWORD as string;

export const LoginDialog: React.FC<LoginDialogProps> = ({ onSuccess, onClose }) => {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);
  const submittingRef = useRef(false); // verhindert Doppel-Submits

  useEffect(() => {
    const timer = setTimeout(() => {
      inputRef.current?.focus();
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  // handleSubmit ist jetzt event-optional — kann also auch von Key-Handlern
  // ohne Event aufgerufen werden.
  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();

    if (submittingRef.current) return;
    submittingRef.current = true;
    // Safety: reset after kurzer Zeit
    setTimeout(() => { submittingRef.current = false; }, 500);

    // Debug: log damit du auf dem iPad sehen kannst, ob Submit ausgelöst wurde
    console.log("handleSubmit called. password length:", password.length);

    if (password === CORRECT_PASSWORD) {
      setError("");
      onSuccess();
      onClose();
    } else {
      setError("Falsches Passwort!");
      inputRef.current?.focus();
    }
  };

  // Gemeinsame Prüffunktion für alle Keyboard-Events
  const checkForEnter = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Debug: was feuert auf dem iPad?
    console.log("key event:", { type: e.type, key: e.key, code: (e as any).code, which: (e as any).which, keyCode: (e as any).keyCode });

    // Verlasse dich primär auf e.key, fallback auf numeric codes:
    const key = e.key;
    const isEnter =
      key === "Enter" ||
      key === "Go" ||
      key === "Done" ||
      key === "Next" ||
      key === "Search" ||
      (typeof (e as any).which === "number" && (e as any).which === 13) ||
      (typeof (e as any).keyCode === "number" && (e as any).keyCode === 13);

    if (isEnter) {
      // Verhindere Doppel-Auswahl/Default-Verhalten
      e.preventDefault();
      // Rufe handleSubmit ohne Event auf (sauber)
      handleSubmit();
    }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-2xl shadow-lg p-6 w-80" role="dialog" aria-modal="true">
        <h2 className="text-xl font-bold mb-4">🔐 Login</h2>
        <form onSubmit={(e) => handleSubmit(e)} className="flex flex-col gap-3">
          <input
            ref={inputRef}
            type="password"
            placeholder="Passwort eingeben"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={checkForEnter}
            onKeyPress={checkForEnter}
            onKeyUp={checkForEnter}
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
