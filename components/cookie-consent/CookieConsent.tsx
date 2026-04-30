"use client";

import { useEffect, useState } from "react";

import {
  defaultCookieConsentPreferences,
  getStoredCookieConsent,
  saveCookieConsent,
  type CookieConsentPreferences,
} from "@/lib/cookie-consent/consentStorage";
import { exposeCookieConsentGlobals, updateGoogleConsentMode } from "@/lib/cookie-consent/scriptLoader";

export function CookieConsent() {
  const [visible, setVisible] = useState(false);
  const [customizing, setCustomizing] = useState(false);
  const [preferences, setPreferences] = useState<CookieConsentPreferences>(defaultCookieConsentPreferences);

  useEffect(() => {
    exposeCookieConsentGlobals();

    const storedConsent = getStoredCookieConsent();

    if (storedConsent) {
      setPreferences(storedConsent.preferences);
      updateGoogleConsentMode();
      return;
    }

    const showTimer = window.setTimeout(() => setVisible(true), 450);

    return () => window.clearTimeout(showTimer);
  }, []);

  function commitConsent(nextPreferences: CookieConsentPreferences) {
    const savedConsent = saveCookieConsent(nextPreferences);

    if (savedConsent) {
      setPreferences(savedConsent.preferences);
    }

    exposeCookieConsentGlobals();
    updateGoogleConsentMode();
    setVisible(false);
    setCustomizing(false);
  }

  if (!visible) {
    return null;
  }

  return (
    <section className="vh-cookie-consent" aria-label="Cookie consent" role="dialog" aria-modal="false">
      <div className="vh-cookie-consent__panel">
        <div className="vh-cookie-consent__copy">
          <p className="vh-cookie-consent__eyebrow">Privacy Preferences</p>
          <h2 className="vh-cookie-consent__title">Cookies, curated quietly.</h2>
          <p className="vh-cookie-consent__text">
            We use essential cookies to operate the site. Analytics and marketing cookies help us refine the experience and may be turned off.
          </p>
        </div>

        {customizing ? (
          <div className="vh-cookie-consent__choices" aria-label="Cookie categories">
            <label className="vh-cookie-consent__choice">
              <input type="checkbox" checked readOnly />
              <span>
                <strong>Essential</strong>
                <small>Always active</small>
              </span>
            </label>
            <label className="vh-cookie-consent__choice">
              <input
                type="checkbox"
                checked={preferences.analytics}
                onChange={(event) => setPreferences((current) => ({ ...current, analytics: event.target.checked }))}
              />
              <span>
                <strong>Analytics</strong>
                <small>Performance insights</small>
              </span>
            </label>
            <label className="vh-cookie-consent__choice">
              <input
                type="checkbox"
                checked={preferences.marketing}
                onChange={(event) => setPreferences((current) => ({ ...current, marketing: event.target.checked }))}
              />
              <span>
                <strong>Marketing</strong>
                <small>Personalized campaigns</small>
              </span>
            </label>
          </div>
        ) : null}

        <div className="vh-cookie-consent__actions">
          {customizing ? (
            <button type="button" className="vh-cookie-consent__button vh-cookie-consent__button--dark" onClick={() => commitConsent(preferences)}>
              Save Preferences
            </button>
          ) : (
            <button
              type="button"
              className="vh-cookie-consent__button vh-cookie-consent__button--dark"
              onClick={() => commitConsent({ essential: true, analytics: true, marketing: true })}
            >
              Accept All
            </button>
          )}
          <button
            type="button"
            className="vh-cookie-consent__button"
            onClick={() => commitConsent({ essential: true, analytics: false, marketing: false })}
          >
            Reject All
          </button>
          <button type="button" className="vh-cookie-consent__link" onClick={() => setCustomizing((current) => !current)}>
            {customizing ? "Back" : "Customize"}
          </button>
        </div>
      </div>

      <style>{`
        .vh-cookie-consent {
          position: fixed;
          inset: auto 0 0 0;
          z-index: 2147483000;
          display: flex;
          justify-content: center;
          padding: 1rem;
          pointer-events: none;
        }

        .vh-cookie-consent__panel {
          width: min(100%, 58rem);
          display: grid;
          grid-template-columns: 1fr;
          gap: 1rem;
          background: rgba(255, 255, 255, 0.98);
          border: 1px solid rgba(17, 17, 20, 0.14);
          box-shadow: 0 18px 54px rgba(0, 0, 0, 0.14);
          color: #111114;
          padding: 1rem;
          pointer-events: auto;
          animation: vh-cookie-consent-enter 260ms ease both;
        }

        .vh-cookie-consent__eyebrow {
          margin: 0 0 0.4rem;
          font-size: 0.68rem;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .vh-cookie-consent__title {
          margin: 0 0 0.45rem;
          font-family: "Oswald", "Montserrat", sans-serif;
          font-size: 1.18rem;
          line-height: 1.05;
          text-transform: uppercase;
        }

        .vh-cookie-consent__text {
          margin: 0;
          max-width: 43rem;
          color: #3f3f43;
          font-size: 0.86rem;
          line-height: 1.55;
        }

        .vh-cookie-consent__choices {
          display: grid;
          gap: 0.55rem;
        }

        .vh-cookie-consent__choice {
          display: flex;
          align-items: center;
          gap: 0.7rem;
          border: 1px solid rgba(17, 17, 20, 0.12);
          padding: 0.72rem;
        }

        .vh-cookie-consent__choice input {
          width: 1rem;
          height: 1rem;
          accent-color: #111114;
        }

        .vh-cookie-consent__choice span {
          display: grid;
          gap: 0.12rem;
        }

        .vh-cookie-consent__choice strong {
          font-size: 0.78rem;
          text-transform: uppercase;
        }

        .vh-cookie-consent__choice small {
          color: #66666b;
          font-size: 0.74rem;
        }

        .vh-cookie-consent__actions {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 0.55rem;
        }

        .vh-cookie-consent__button,
        .vh-cookie-consent__link {
          min-height: 2.6rem;
          border: 1px solid #111114;
          background: #fff;
          color: #111114;
          padding: 0 1rem;
          font-size: 0.72rem;
          font-weight: 700;
          letter-spacing: 0.05em;
          text-transform: uppercase;
          cursor: pointer;
        }

        .vh-cookie-consent__button--dark {
          background: #111114;
          color: #fff;
        }

        .vh-cookie-consent__link {
          border-color: transparent;
          text-decoration: underline;
          text-underline-offset: 0.22rem;
        }

        @keyframes vh-cookie-consent-enter {
          from {
            opacity: 0;
            transform: translateY(10px);
          }

          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @media (min-width: 760px) {
          .vh-cookie-consent {
            justify-content: flex-start;
            padding: 1.25rem;
          }

          .vh-cookie-consent__panel {
            grid-template-columns: 1fr auto;
            align-items: end;
            padding: 1.15rem 1.25rem;
          }

          .vh-cookie-consent__choices {
            grid-column: 1 / -1;
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .vh-cookie-consent__panel {
            animation: none;
          }
        }
      `}</style>
    </section>
  );
}

