"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, ChevronRight, Mail, Megaphone, Monitor, Save, Smartphone, Users } from "lucide-react";
import { FormEvent, KeyboardEvent, useMemo, useState } from "react";

import { getErrorMessage, getResponseErrorMessage, readJsonSafely } from "@/lib/http";
import { CAMPAIGN_CHANNELS } from "@/lib/validations/campaign";

type CampaignChannel = (typeof CAMPAIGN_CHANNELS)[number];

const CHANNEL_OPTIONS: Array<{
  value: CampaignChannel;
  label: string;
  copy: string;
  icon: typeof Mail;
}> = [
  { value: "email", label: "Email", copy: "Send emails to your subscribers", icon: Mail },
  { value: "sms", label: "SMS", copy: "Send text messages", icon: Smartphone },
  { value: "push", label: "Push Notification", copy: "Send push notifications", icon: Bell },
  { value: "social", label: "Social Media", copy: "Promote on social platforms", icon: Megaphone },
  { value: "banner", label: "Website Banner", copy: "Display banners on your website", icon: Monitor },
];

function toLocalDateTimeValue(date = new Date()) {
  const offsetDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);

  return offsetDate.toISOString().slice(0, 16);
}

function toIsoDateTime(value: string) {
  return value ? new Date(value).toISOString() : null;
}

function ToggleControl({
  checked,
  label,
  copy,
  onChange,
}: {
  checked: boolean;
  label: string;
  copy: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="vh-admin-toggle-row">
      <span>
        <strong>{label}</strong>
        <small>{copy}</small>
      </span>
      <button
        className={`vh-admin-toggle${checked ? " vh-admin-toggle--on" : ""}`}
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
      >
        <i />
      </button>
    </div>
  );
}

export function AdminCampaignCreateView() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [campaignType, setCampaignType] = useState("");
  const [goal, setGoal] = useState("");
  const [description, setDescription] = useState("");
  const [startsAt, setStartsAt] = useState(toLocalDateTimeValue());
  const [endsAt, setEndsAt] = useState("");
  const [budgetAmount, setBudgetAmount] = useState("");
  const [dailyBudgetAmount, setDailyBudgetAmount] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [channels, setChannels] = useState<CampaignChannel[]>(["email"]);
  const [audienceType, setAudienceType] = useState("");
  const [audience, setAudience] = useState("");
  const [trackConversions, setTrackConversions] = useState(true);
  const [abTestEnabled, setAbTestEnabled] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const previewTags = useMemo(() => tags.slice(0, 6), [tags]);

  function toggleChannel(channel: CampaignChannel) {
    setChannels((current) =>
      current.includes(channel)
        ? current.filter((item) => item !== channel)
        : [...current, channel],
    );
  }

  function addTag() {
    const tag = tagInput.trim();

    if (!tag || tags.includes(tag)) {
      setTagInput("");
      return;
    }

    setTags((current) => [...current, tag]);
    setTagInput("");
  }

  function handleTagKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter") {
      return;
    }

    event.preventDefault();
    addTag();
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");

    try {
      const response = await fetch("/api/admin/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          campaignType,
          goal,
          description,
          startsAt: toIsoDateTime(startsAt),
          endsAt: toIsoDateTime(endsAt),
          budgetAmount,
          dailyBudgetAmount,
          tags,
          channels,
          audienceType,
          audience,
          trackConversions,
          abTestEnabled,
        }),
      });
      const payload = await readJsonSafely<{ error?: string }>(response);

      if (!response.ok) {
        throw new Error(getResponseErrorMessage(payload, "Unable to save the campaign."));
      }

      router.push("/admin/marketing");
      router.refresh();
    } catch (saveError) {
      setError(getErrorMessage(saveError, "Unable to save the campaign."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="vh-admin-create-collection" onSubmit={handleSubmit}>
      <header className="vh-admin-create-collection__header">
        <div>
          <h1>Create Campaign</h1>
          <nav className="vh-admin-breadcrumb" aria-label="Breadcrumb">
            <Link href="/admin">Dashboard</Link>
            <ChevronRight size={14} aria-hidden="true" />
            <Link href="/admin/marketing">Marketing</Link>
            <ChevronRight size={14} aria-hidden="true" />
            <Link href="/admin/marketing">Campaigns</Link>
            <ChevronRight size={14} aria-hidden="true" />
            <span>Create Campaign</span>
          </nav>
        </div>
        <div className="vh-admin-create-collection__actions">
          <Link className="vh-admin-action-button" href="/admin/marketing">Cancel</Link>
          <button className="vh-admin-action-button vh-admin-action-button--primary" type="submit" disabled={saving}>
            <Save size={16} strokeWidth={1.9} aria-hidden="true" />
            <span>{saving ? "Saving..." : "Save Campaign"}</span>
          </button>
        </div>
      </header>

      {error ? <div className="vh-admin-form-alert vh-admin-form-alert--error">{error}</div> : null}

      <div className="vh-admin-create-collection__layout">
        <main className="vh-admin-create-collection__main">
          <section className="vh-admin-form-card">
            <div className="vh-admin-form-card__header">
              <h2>Campaign Information</h2>
              <p>Add the essential details about your campaign.</p>
            </div>
            <div className="vh-admin-form-grid">
              <label className="vh-admin-form-field">
                <span>Campaign Name <b>*</b></span>
                <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Enter campaign name" required />
                <small>Internal name for reference only.</small>
              </label>
              <label className="vh-admin-form-field">
                <span>Campaign Type <b>*</b></span>
                <select value={campaignType} onChange={(event) => setCampaignType(event.target.value)} required>
                  <option value="">Select campaign type</option>
                  <option value="email">Email</option>
                  <option value="sms">SMS</option>
                  <option value="social">Social Media</option>
                  <option value="banner">Website Banner</option>
                  <option value="multi-channel">Multi-channel</option>
                </select>
                <small>Choose the type of campaign.</small>
              </label>
              <label className="vh-admin-form-field">
                <span>Campaign Goal <em>(Optional)</em></span>
                <select value={goal} onChange={(event) => setGoal(event.target.value)}>
                  <option value="">Select campaign goal</option>
                  <option value="awareness">Awareness</option>
                  <option value="traffic">Traffic</option>
                  <option value="conversions">Conversions</option>
                  <option value="retention">Customer retention</option>
                  <option value="launch">Product launch</option>
                </select>
                <small>What do you want to achieve with this campaign?</small>
              </label>
            </div>
            <label className="vh-admin-form-field">
              <span>Description <em>(Optional)</em></span>
              <textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Enter campaign description" />
              <small>Add a brief description about your campaign.</small>
            </label>
          </section>

          <section className="vh-admin-form-card">
            <div className="vh-admin-form-card__header">
              <h2>Campaign Settings</h2>
              <p>Configure the scheduling and budget for your campaign.</p>
            </div>
            <div className="vh-admin-form-grid">
              <label className="vh-admin-form-field">
                <span>Start Date <b>*</b></span>
                <input type="datetime-local" value={startsAt} onChange={(event) => setStartsAt(event.target.value)} required />
                <small>When the campaign will start.</small>
              </label>
              <label className="vh-admin-form-field">
                <span>End Date <em>(Optional)</em></span>
                <input type="datetime-local" value={endsAt} onChange={(event) => setEndsAt(event.target.value)} />
                <small>When the campaign will end.</small>
              </label>
              <label className="vh-admin-form-field">
                <span>Budget <em>(Optional)</em></span>
                <input inputMode="decimal" value={budgetAmount} onChange={(event) => setBudgetAmount(event.target.value)} placeholder="Enter budget amount" />
                <small>Total budget for this campaign.</small>
              </label>
              <label className="vh-admin-form-field">
                <span>Daily Budget <em>(Optional)</em></span>
                <input inputMode="decimal" value={dailyBudgetAmount} onChange={(event) => setDailyBudgetAmount(event.target.value)} placeholder="Enter daily budget" />
                <small>Maximum amount spent per day.</small>
              </label>
            </div>
            <label className="vh-admin-form-field">
              <span>Tags <em>(Optional)</em></span>
              <input value={tagInput} onChange={(event) => setTagInput(event.target.value)} onKeyDown={handleTagKeyDown} onBlur={addTag} placeholder="Add tags..." />
              <small>Press Enter to add tags.</small>
            </label>
            {previewTags.length ? (
              <div className="vh-admin-tag-list">
                {previewTags.map((tag) => (
                  <button key={tag} type="button" onClick={() => setTags((current) => current.filter((item) => item !== tag))}>
                    {tag}
                  </button>
                ))}
              </div>
            ) : null}
          </section>
        </main>

        <aside className="vh-admin-create-collection__sidebar">
          <section className="vh-admin-form-card">
            <div className="vh-admin-form-card__header">
              <h2>Select Channels</h2>
              <p>Choose where you want to run this campaign.</p>
            </div>
            <fieldset className="vh-admin-campaign-channel-list">
              <legend>Channels <b>*</b></legend>
              {CHANNEL_OPTIONS.map((option) => {
                const Icon = option.icon;
                const checked = channels.includes(option.value);

                return (
                  <label key={option.value} className="vh-admin-campaign-channel">
                    <input type="checkbox" checked={checked} onChange={() => toggleChannel(option.value)} />
                    <span className="vh-admin-campaign-channel__icon">
                      <Icon size={18} aria-hidden="true" />
                    </span>
                    <span>
                      <strong>{option.label}</strong>
                      <small>{option.copy}</small>
                    </span>
                  </label>
                );
              })}
            </fieldset>
          </section>

          <section className="vh-admin-form-card">
            <div className="vh-admin-form-card__header">
              <h2>Audience</h2>
              <p>Define who will see this campaign.</p>
            </div>
            <label className="vh-admin-form-field">
              <span>Audience Type <b>*</b></span>
              <select value={audienceType} onChange={(event) => setAudienceType(event.target.value)} required>
                <option value="">Select audience type</option>
                <option value="all-customers">All customers</option>
                <option value="subscribers">Subscribers</option>
                <option value="vip">VIP customers</option>
                <option value="new-customers">New customers</option>
                <option value="custom">Custom audience</option>
              </select>
            </label>
            <label className="vh-admin-form-field">
              <span>Audience <em>(Optional)</em></span>
              <select value={audience} onChange={(event) => setAudience(event.target.value)}>
                <option value="">Select audience</option>
                <option value="newsletter">Newsletter subscribers</option>
                <option value="recent-buyers">Recent buyers</option>
                <option value="high-value">High value customers</option>
              </select>
              <small>Choose a saved audience or create a new one.</small>
            </label>
            <button className="vh-admin-action-button" type="button">
              <Users size={16} aria-hidden="true" />
              <span>Create New Audience</span>
            </button>
          </section>

          <section className="vh-admin-form-card">
            <div className="vh-admin-form-card__header">
              <h2>Additional Settings</h2>
              <p>Configure advanced campaign settings.</p>
            </div>
            <ToggleControl checked={trackConversions} label="Track Conversions" copy="Track conversions from this campaign" onChange={setTrackConversions} />
            <ToggleControl checked={abTestEnabled} label="A/B Test Campaign" copy="Create A/B test for this campaign" onChange={setAbTestEnabled} />
          </section>
        </aside>
      </div>
    </form>
  );
}
