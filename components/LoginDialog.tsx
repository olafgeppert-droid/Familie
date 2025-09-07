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

  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 100);
    return () => clearTimeout(t);
  }, []);

  const handleSubmit = (e?: React.FormEvent) => {
    // Verhindert das Standard-Reload der Seite, falls das Ereignis vorhanden ist
    e?.preventDefault();

    if (password === CORRECT_PASSWORD) {
      setError("");
      onSuccess();
      onClose();
    } else {
      setError("Falsches Passwort!");
      setPassword(""); 
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Liste der möglichen Enter-Key-Namen auf mobilen Tastaturen
    const enterKeys = ["Enter", "Return", "Go", "Done", "Next", "Search"];
    
    if (enterKeys.includes(e.key)) {
      e.preventDefault(); // Verhindert unerwünschtes Verhalten
      handleSubmit();     // Löst die Überprüfung aus
    }
  };

  return (
    <div
      className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50"
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-white rounded-2xl shadow-lg p-6 w-80">
        <h2 className="text-xl font-bold mb-4">🔐 Login</h2>
        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-3"
          noValidate
        >
          <input
            ref={inputRef}
            type="password"
            placeholder="Passwort eingeben"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={handleKeyDown} {/* Neuer Handler */}
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
