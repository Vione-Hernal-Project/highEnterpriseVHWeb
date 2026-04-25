"use client";

import { useEffect, useMemo, useState, type ChangeEvent, type InputHTMLAttributes } from "react";

import { evaluatePasswordStrength, passwordStrengthRules } from "@/lib/auth/password-strength";

type Props = {
  id: string;
  label: string;
  showStrengthFeedback?: boolean;
  strengthInputs?: string[];
} & Omit<InputHTMLAttributes<HTMLInputElement>, "id" | "type">;

export function PasswordField({ id, label, showStrengthFeedback = false, strengthInputs = [], ...props }: Props) {
  const [visible, setVisible] = useState(false);
  const [value, setValue] = useState(typeof props.defaultValue === "string" ? props.defaultValue : "");
  const strength = useMemo(() => evaluatePasswordStrength(value, strengthInputs), [strengthInputs, value]);

  useEffect(() => {
    if (typeof props.value === "string") {
      setValue(props.value);
    }
  }, [props.value]);

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    setValue(event.target.value);
    props.onChange?.(event);
  }

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
      <input id={id} type={visible ? "text" : "password"} className="vh-input" {...props} onChange={handleChange} />
      {showStrengthFeedback ? (
        <div className="vh-password-strength" aria-live="polite">
          <div className="vh-password-strength__header">
            <p className="vh-password-strength__label">Password strength</p>
            <span className={`vh-password-strength__status vh-password-strength__status--${strength.tone}`}>
              {value ? strength.label : "Add a password"}
            </span>
          </div>
          <div className="vh-password-strength__meter" aria-hidden="true">
            <span
              className={`vh-password-strength__meter-fill vh-password-strength__meter-fill--${strength.tone}`}
              style={{ width: `${Math.max(12, ((strength.score + 1) / 5) * 100)}%` }}
            />
          </div>
          <div className="vh-password-strength__checks">
            {strength.checks.map((check) => (
              <p key={check.label} className={`vh-password-strength__check ${check.passed ? "is-passed" : ""}`}>
                {check.label}
              </p>
            ))}
          </div>
          {value ? (
            <p className="vh-password-strength__hint">
              {strength.warning || `Use a unique password with at least ${passwordStrengthRules.minLength} characters.`}
            </p>
          ) : null}
          {value && strength.suggestions.length ? (
            <p className="vh-password-strength__hint">{strength.suggestions[0]}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
