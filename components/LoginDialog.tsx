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
      if (inputRef.current) {
        inputRef.current.focus();
      }
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  // ✅ ERWEITERTER KeyDown Handler für iPad Meter-Taste
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Unterstütze ALLE Enter-Tasten Varianten:
    if (e.key === 'Enter' || 
        e.key === 'Go' || 
        e.key === 'Next' || 
        e.key === 'Done' || 
        e.key === 'Send' ||
        e.keyCode === 13 ||   // Standard Enter
        e.keyCode === 10 ||   // Alternative Enter
        e.which === 13 ||     // Legacy Support
        e.which === 10) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === CORRECT_PASSWORD) {
      setError("");
      onSuccess();
      onClose();
    } else {
      setError("Falsches Passwort!");
      if (inputRef.current) {
        inputRef.current.focus();
      }
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
            onKeyDown={handleKeyDown}
            className="border rounded-lg p-2"
            autoComplete="current-password"
            autoCorrect="off"
            autoCapitalize="none"
            // ✅ WICHTIG für iPad: inputmode für bessere Tastatur
            inputMode="text"
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
