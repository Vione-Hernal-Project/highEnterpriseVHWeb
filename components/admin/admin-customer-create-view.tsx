"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent, type KeyboardEvent } from "react";
import { CalendarDays, ChevronRight, UserPlus, X } from "lucide-react";

import { getErrorMessage, getResponseErrorMessage, readJsonSafely } from "@/lib/http";

const CUSTOMER_TYPES = ["Retail", "Wholesale", "Stylist", "VIP Client", "Partner"];
const CUSTOMER_SOURCES = ["Admin Entry", "Storefront", "Instagram", "Referral", "Event", "Support"];
const CUSTOMER_GROUPS = ["General", "VIP", "Repeat Buyer", "Editorial", "Wholesale"];
const VIP_LEVELS = ["Standard", "VIP", "Platinum", "Private Client"];
const ACCOUNT_STATUSES = ["active", "inactive", "blocked"] as const;
const EMAIL_VERIFICATIONS = ["verified", "unverified"] as const;
const SUBSCRIPTION_STATUSES = ["subscribed", "unsubscribed", "pending"] as const;

type AccountStatus = (typeof ACCOUNT_STATUSES)[number];
type EmailVerification = (typeof EMAIL_VERIFICATIONS)[number];
type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

function todayDate() {
  return new Date().toISOString().slice(0, 10);
}

export function AdminCustomerCreateView() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phoneCountryCode, setPhoneCountryCode] = useState("+63");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [customerType, setCustomerType] = useState("");
  const [source, setSource] = useState("Admin Entry");
  const [customerGroup, setCustomerGroup] = useState("General");
  const [vipLevel, setVipLevel] = useState("Standard");
  const [referralBy, setReferralBy] = useState("");
  const [addressLine1, setAddressLine1] = useState("");
  const [addressLine2, setAddressLine2] = useState("");
  const [city, setCity] = useState("");
  const [stateProvince, setStateProvince] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [country, setCountry] = useState("Philippines");
  const [accountStatus, setAccountStatus] = useState<AccountStatus>("active");
  const [emailVerification, setEmailVerification] = useState<EmailVerification>("verified");
  const [hasAccountAccess, setHasAccountAccess] = useState(true);
  const [subscriptionStatus, setSubscriptionStatus] = useState<SubscriptionStatus>("subscribed");
  const [subscribedOn, setSubscribedOn] = useState(todayDate);
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  function addTag(value: string) {
    const nextTag = value.trim();

    if (!nextTag || tags.some((tag) => tag.toLowerCase() === nextTag.toLowerCase())) {
      setTagInput("");
      return;
    }

    setTags((currentTags) => [...currentTags, nextTag].slice(0, 12));
    setTagInput("");
  }

  function handleTagKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter") {
      return;
    }

    event.preventDefault();
    addTag(tagInput);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch("/api/admin/customers", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fullName,
          email,
          phoneCountryCode,
          phoneNumber,
          dateOfBirth: dateOfBirth || null,
          customerType,
          source,
          customerGroup,
          vipLevel,
          referralBy,
          addressLine1,
          addressLine2,
          city,
          stateProvince,
          postalCode,
          country,
          accountStatus,
          emailVerification,
          hasAccountAccess,
          subscriptionStatus,
          subscribedOn: subscriptionStatus === "subscribed" ? subscribedOn || null : null,
          tags,
          notes,
        }),
      });
      const payload = await readJsonSafely<{ error?: string }>(response);

      if (!response.ok) {
        throw new Error(getResponseErrorMessage(payload, "Unable to save the customer."));
      }

      setMessage("Customer created.");
      router.push("/admin/customers");
      router.refresh();
    } catch (saveError) {
      setError(getErrorMessage(saveError, "Unable to save the customer."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="vh-admin-create-collection vh-admin-create-customer" onSubmit={handleSubmit}>
      <header className="vh-admin-create-collection__header">
        <div>
          <h1>Add Customer</h1>
          <nav className="vh-admin-breadcrumb" aria-label="Breadcrumb">
            <Link href="/admin">Dashboard</Link>
            <ChevronRight size={14} strokeWidth={1.8} aria-hidden="true" />
            <Link href="/admin/customers">Customers</Link>
            <ChevronRight size={14} strokeWidth={1.8} aria-hidden="true" />
            <span>Add Customer</span>
          </nav>
        </div>
        <div className="vh-admin-create-collection__actions">
          <Link className="vh-admin-action-button" href="/admin/customers">Cancel</Link>
          <button className="vh-admin-action-button vh-admin-action-button--primary" type="submit" disabled={loading}>
            <UserPlus size={16} strokeWidth={1.9} aria-hidden="true" />
            <span>{loading ? "Saving..." : "Save Customer"}</span>
          </button>
        </div>
      </header>

      {message ? <div className="vh-admin-alert"><p>{message}</p></div> : null}
      {error ? <div className="vh-admin-alert vh-admin-alert--error"><p>{error}</p></div> : null}

      <div className="vh-admin-create-collection__layout">
        <main className="vh-admin-create-collection__main">
          <section className="vh-admin-form-card">
            <div className="vh-admin-form-card__header">
              <h2>Customer Information</h2>
              <p>Add the basic information about your customer.</p>
            </div>

            <div className="vh-admin-form-grid">
              <label className="vh-admin-form-field">
                <span>Full Name <b>*</b></span>
                <input value={fullName} onChange={(event) => setFullName(event.target.value)} placeholder="Enter full name" required />
              </label>

              <label className="vh-admin-form-field">
                <span>Email Address <b>*</b></span>
                <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Enter email address" required />
              </label>

              <label className="vh-admin-form-field">
                <span>Phone Number</span>
                <span className="vh-admin-phone-input">
                  <select value={phoneCountryCode} onChange={(event) => setPhoneCountryCode(event.target.value)} aria-label="Phone country code">
                    <option value="+63">PH +63</option>
                    <option value="+1">US +1</option>
                    <option value="+44">UK +44</option>
                    <option value="+81">JP +81</option>
                  </select>
                  <input value={phoneNumber} onChange={(event) => setPhoneNumber(event.target.value)} placeholder="Enter phone number" />
                </span>
              </label>

              <label className="vh-admin-form-field">
                <span>Date of Birth</span>
                <span className="vh-admin-input-icon">
                  <CalendarDays size={16} aria-hidden="true" />
                  <input type="date" value={dateOfBirth} onChange={(event) => setDateOfBirth(event.target.value)} />
                </span>
              </label>

              <label className="vh-admin-form-field">
                <span>Customer Type</span>
                <select value={customerType} onChange={(event) => setCustomerType(event.target.value)}>
                  <option value="">Select customer type</option>
                  {CUSTOMER_TYPES.map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              </label>

              <label className="vh-admin-form-field">
                <span>Source</span>
                <select value={source} onChange={(event) => setSource(event.target.value)}>
                  {CUSTOMER_SOURCES.map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              </label>
            </div>

            <label className="vh-admin-form-field">
              <span>Customer Group / Segment</span>
              <select value={customerGroup} onChange={(event) => setCustomerGroup(event.target.value)}>
                {CUSTOMER_GROUPS.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </label>

            <div className="vh-admin-form-grid">
              <label className="vh-admin-form-field">
                <span>VIP Level</span>
                <select value={vipLevel} onChange={(event) => setVipLevel(event.target.value)}>
                  {VIP_LEVELS.map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              </label>

              <label className="vh-admin-form-field">
                <span>Referral By <em>(Optional)</em></span>
                <input value={referralBy} onChange={(event) => setReferralBy(event.target.value)} placeholder="Search customer by name or email" />
              </label>
            </div>
          </section>

          <section className="vh-admin-form-card">
            <div className="vh-admin-form-card__header">
              <h2>Address Information <span>(Optional)</span></h2>
              <p>Add the customer&apos;s default address.</p>
            </div>

            <div className="vh-admin-form-grid">
              <label className="vh-admin-form-field">
                <span>Address Line 1</span>
                <input value={addressLine1} onChange={(event) => setAddressLine1(event.target.value)} placeholder="Enter address line 1" />
              </label>
              <label className="vh-admin-form-field">
                <span>Address Line 2</span>
                <input value={addressLine2} onChange={(event) => setAddressLine2(event.target.value)} placeholder="Enter address line 2" />
              </label>
              <label className="vh-admin-form-field">
                <span>City</span>
                <input value={city} onChange={(event) => setCity(event.target.value)} placeholder="Enter city" />
              </label>
              <label className="vh-admin-form-field">
                <span>State / Province</span>
                <input value={stateProvince} onChange={(event) => setStateProvince(event.target.value)} placeholder="Enter state or province" />
              </label>
              <label className="vh-admin-form-field">
                <span>Postal / ZIP Code</span>
                <input value={postalCode} onChange={(event) => setPostalCode(event.target.value)} placeholder="Enter postal or ZIP code" />
              </label>
              <label className="vh-admin-form-field">
                <span>Country</span>
                <select value={country} onChange={(event) => setCountry(event.target.value)}>
                  <option value="Philippines">Philippines</option>
                  <option value="United States">United States</option>
                  <option value="United Kingdom">United Kingdom</option>
                  <option value="Japan">Japan</option>
                </select>
              </label>
            </div>
          </section>
        </main>

        <aside className="vh-admin-create-collection__sidebar">
          <section className="vh-admin-form-card">
            <div className="vh-admin-form-card__header">
              <h2>Account &amp; Status</h2>
              <p>Manage customer account access and status.</p>
            </div>

            <label className="vh-admin-form-field">
              <span>Account Status</span>
              <select value={accountStatus} onChange={(event) => setAccountStatus(event.target.value as AccountStatus)}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="blocked">Blocked</option>
              </select>
            </label>

            <label className="vh-admin-form-field">
              <span>Email Verification</span>
              <select value={emailVerification} onChange={(event) => setEmailVerification(event.target.value as EmailVerification)}>
                <option value="verified">Verified</option>
                <option value="unverified">Unverified</option>
              </select>
            </label>

            <fieldset className="vh-admin-radio-stack">
              <legend>Account Access</legend>
              <label>
                <input type="radio" name="accountAccess" checked={hasAccountAccess} onChange={() => setHasAccountAccess(true)} />
                <span>
                  <strong>Has Access</strong>
                  <small>Customer can log in to their account.</small>
                </span>
              </label>
              <label>
                <input type="radio" name="accountAccess" checked={!hasAccountAccess} onChange={() => setHasAccountAccess(false)} />
                <span>
                  <strong>No Access</strong>
                  <small>Customer will not be able to log in.</small>
                </span>
              </label>
            </fieldset>

            <label className="vh-admin-form-field">
              <span>Subscription Status</span>
              <select value={subscriptionStatus} onChange={(event) => setSubscriptionStatus(event.target.value as SubscriptionStatus)}>
                <option value="subscribed">Subscribed</option>
                <option value="unsubscribed">Unsubscribed</option>
                <option value="pending">Pending</option>
              </select>
            </label>

            <label className="vh-admin-form-field">
              <span>Subscribed On</span>
              <span className="vh-admin-input-icon">
                <CalendarDays size={16} aria-hidden="true" />
                <input type="date" value={subscribedOn} onChange={(event) => setSubscribedOn(event.target.value)} disabled={subscriptionStatus !== "subscribed"} />
              </span>
            </label>

            <div className="vh-admin-form-field">
              <span>Tags</span>
              <div className="vh-admin-tag-editor">
                {tags.length ? (
                  <div className="vh-admin-tag-list">
                    {tags.map((tag) => (
                      <button key={tag} type="button" onClick={() => setTags((currentTags) => currentTags.filter((currentTag) => currentTag !== tag))}>
                        <span>{tag}</span>
                        <X size={12} aria-hidden="true" />
                      </button>
                    ))}
                  </div>
                ) : null}
                <input value={tagInput} onChange={(event) => setTagInput(event.target.value)} onKeyDown={handleTagKeyDown} onBlur={() => addTag(tagInput)} placeholder="Add tags..." />
              </div>
              <small>Press Enter to add multiple tags.</small>
            </div>
          </section>

          <section className="vh-admin-form-card">
            <div className="vh-admin-form-card__header">
              <h2>Customer Notes <span>(Optional)</span></h2>
              <p>Add any notes about this customer.</p>
            </div>
            <label className="vh-admin-form-field">
              <span>Notes</span>
              <textarea value={notes} onChange={(event) => setNotes(event.target.value.slice(0, 500))} placeholder="Enter notes about this customer..." />
              <small>Maximum 500 characters.</small>
            </label>
          </section>
        </aside>
      </div>
    </form>
  );
}
