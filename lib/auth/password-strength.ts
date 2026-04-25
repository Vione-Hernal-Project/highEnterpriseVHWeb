import zxcvbn from "zxcvbn";

export type PasswordStrengthTone = "weak" | "medium" | "strong";

export type PasswordStrengthCheck = {
  label: string;
  passed: boolean;
};

export type PasswordStrengthEvaluation = {
  label: "Weak" | "Medium" | "Strong";
  tone: PasswordStrengthTone;
  accepted: boolean;
  score: number;
  warning: string;
  suggestions: string[];
  checks: PasswordStrengthCheck[];
};

const MIN_PASSWORD_LENGTH = 12;
const BRAND_PASSWORD_INPUTS = ["vione", "hernal", "vione hernal"];

export function evaluatePasswordStrength(password: string, userInputs: string[] = []): PasswordStrengthEvaluation {
  const normalizedUserInputs = [...BRAND_PASSWORD_INPUTS, ...userInputs]
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  const result = zxcvbn(password, normalizedUserInputs);
  const checks: PasswordStrengthCheck[] = [
    {
      label: `At least ${MIN_PASSWORD_LENGTH} characters`,
      passed: password.length >= MIN_PASSWORD_LENGTH,
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
  const meetsComposition = checks.every((check) => check.passed);
  const accepted = password.length >= MIN_PASSWORD_LENGTH && meetsComposition && result.score >= 3;
  let label: PasswordStrengthEvaluation["label"] = "Weak";
  let tone: PasswordStrengthTone = "weak";

  if (accepted && result.score >= 4) {
    label = "Strong";
    tone = "strong";
  } else if (accepted) {
    label = "Medium";
    tone = "medium";
  }

  return {
    label,
    tone,
    accepted,
    score: result.score,
    warning: result.feedback.warning || "",
    suggestions: result.feedback.suggestions || [],
    checks,
  };
}

export function getPasswordStrengthError(password: string, userInputs: string[] = []) {
  const evaluation = evaluatePasswordStrength(password, userInputs);

  if (evaluation.accepted) {
    return null;
  }

  if (evaluation.warning) {
    return evaluation.warning;
  }

  const firstFailedCheck = evaluation.checks.find((check) => !check.passed);

  if (firstFailedCheck) {
    return `Password requirement: ${firstFailedCheck.label}.`;
  }

  return "Choose a stronger password with more length and less predictable wording.";
}

export function getPasswordStrengthInputs(email: string) {
  const normalizedEmail = email.trim().toLowerCase();

  if (!normalizedEmail) {
    return BRAND_PASSWORD_INPUTS;
  }

  const [localPart = "", domainPart = ""] = normalizedEmail.split("@");
  const domainName = domainPart.split(".")[0] || "";

  return [...BRAND_PASSWORD_INPUTS, normalizedEmail, localPart, domainName];
}

export const passwordStrengthRules = {
  minLength: MIN_PASSWORD_LENGTH,
};
