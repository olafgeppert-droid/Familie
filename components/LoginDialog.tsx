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
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      inputRef.current?.focus();
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === CORRECT_PASSWORD) {
      setError("");
      onSuccess();
      onClose();
    } else {
      setError("Falsches Passwort!");
      inputRef.current?.focus();
    }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-2xl shadow-lg p-6 w-80">
        <h2 className="text-xl font-bold mb-4">🔐 Login</h2>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <input
            ref={inputRef}
            type="password"
            placeholder="Passwort eingeben"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="border rounded-lg p-2"
            autoComplete="current-password"
            autoCorrect="off"
            autoCapitalize="none"
            inputMode="text"
            enterKeyHint="go"   // zeigt „Los/Go“ auf iOS
            required            // erzwingt Submit-Trigger
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
              type="submit"  // sorgt dafür, dass Enter überall funktioniert
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
