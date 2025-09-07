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

  const handleSubmit = (e?: Event | React.FormEvent) => {
    try { e?.preventDefault?.(); } catch {}
    if (submittingRef.current) return;
    submittingRef.current = true;
    setTimeout(() => { submittingRef.current = false; }, 500);

    if (password === CORRECT_PASSWORD) {
      setError("");
      onSuccess();
      onClose();
    } else {
      setError("Falsches Passwort!");
      inputRef.current?.focus();
    }
  };

  const checkForEnter = (e: React.KeyboardEvent<HTMLInputElement>) => {
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
      if (submitBtnRef.current) {
        setTimeout(() => submitBtnRef.current?.click(), 0);
      } else {
        handleSubmit();
      }
    }
  };

  useEffect(() => {
    const nativeHandler = (e: KeyboardEvent) => {
      if (!isFocusedRef.current) return;

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
        if (submitBtnRef.current) {
          submitBtnRef.current.click();
        } else {
          handleSubmit();
        }
      }
    };

    window.addEventListener("keydown", nativeHandler, true);
    return () => window.removeEventListener("keydown", nativeHandler, true);
  }, [password]);

  return (
    <div
      className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50"
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-white rounded-2xl shadow-lg p-6 w-80">
        <h2 className="text-xl font-bold mb-4">🔐 Login</h2>
        <form
          onSubmit={(e) => handleSubmit(e)}
          className="flex flex-col gap-3"
          noValidate
        >
          <input
            ref={inputRef}
            type="password"
            placeholder="Passwort eingeben"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={checkForEnter}
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
