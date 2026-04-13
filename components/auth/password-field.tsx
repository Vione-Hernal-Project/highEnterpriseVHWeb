"use client";

import { useState, type InputHTMLAttributes } from "react";

type Props = {
  id: string;
  label: string;
} & Omit<InputHTMLAttributes<HTMLInputElement>, "id" | "type">;

export function PasswordField({ id, label, ...props }: Props) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="vh-field">
      <div className="vh-field__row">
        <label htmlFor={id}>{label}</label>
        <button
          type="button"
          className="vh-password-toggle"
          aria-label={`${visible ? "Hide" : "Show"} ${label.toLowerCase()}`}
          onClick={() => setVisible((current) => !current)}
        >
          {visible ? "Hide" : "Show"}
        </button>
      </div>
      <input id={id} type={visible ? "text" : "password"} className="vh-input" {...props} />
    </div>
  );
}
