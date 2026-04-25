"use client";

import { useEffect, useMemo, useState, type ChangeEvent, type InputHTMLAttributes } from "react";

type Props = {
  id: string;
  label: string;
  showStrengthFeedback?: boolean;
  strengthMinLength?: number;
} & Omit<InputHTMLAttributes<HTMLInputElement>, "id" | "type">;

type PasswordStrength = {
  label: "Weak" | "Medium" | "Strong";
  tone: "weak" | "medium" | "strong";
  score: number;
  checks: Array<{
    label: string;
    passed: boolean;
  }>;
};

function getPasswordStrength(password: string, minLength: number): PasswordStrength {
  const checks = [
    {
      label: `At least ${minLength} characters`,
      passed: password.length >= minLength,
    },
    {
      label: "Includes uppercase and lowercase letters",
      passed: /[A-Z]/.test(password) && /[a-z]/.test(password),
    },
    {
      label: "Includes a number",
      passed: /\d/.test(password),
    },
    {
      label: "Includes a symbol",
      passed: /[^A-Za-z0-9]/.test(password),
    },
  ];
  const score = checks.filter((check) => check.passed).length;

  if (score >= 4) {
    return {
      label: "Strong",
      tone: "strong",
      score,
      checks,
    };
  }

  if (score >= 2) {
    return {
      label: "Medium",
      tone: "medium",
      score,
      checks,
    };
  }

  return {
    label: "Weak",
    tone: "weak",
    score,
    checks,
  };
}

export function PasswordField({ id, label, showStrengthFeedback = false, strengthMinLength, ...props }: Props) {
  const [visible, setVisible] = useState(false);
  const [value, setValue] = useState(typeof props.defaultValue === "string" ? props.defaultValue : "");
  const strengthRuleMinLength = strengthMinLength ?? 10;
  const strength = useMemo(() => getPasswordStrength(value, strengthRuleMinLength), [strengthRuleMinLength, value]);

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
              style={{ width: `${Math.max(12, (strength.score / strength.checks.length) * 100)}%` }}
            />
          </div>
          <div className="vh-password-strength__checks">
            {strength.checks.map((check) => (
              <p key={check.label} className={`vh-password-strength__check ${check.passed ? "is-passed" : ""}`}>
                {check.label}
              </p>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
