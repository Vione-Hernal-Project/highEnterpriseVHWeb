"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { CalendarDays, ChevronRight, Eye, ImageIcon, Link2, Lock, Save, UploadCloud } from "lucide-react";

import { getErrorMessage, getResponseErrorMessage, readJsonSafely } from "@/lib/http";

type BannerStatus = "active" | "inactive" | "draft";
type BannerVisibility = "public" | "logged_in" | "password";
type LinkTarget = "same_window" | "new_tab";

const BANNER_TYPES = ["Homepage Hero", "Announcement", "Promotion", "Editorial Feature", "Collection Banner"];
const DISPLAY_LOCATIONS = ["All Locations", "Homepage", "Shop", "Product Pages", "Editorial"];
const DEVICES = ["All Devices", "Desktop Only", "Mobile Only"];
const BUTTON_STYLES = ["Primary", "Secondary", "Text Link", "Outline"];

export type AdminBannerFormInitialBanner = {
  id: string;
  title: string;
  bannerType: string;
  linkUrl: string | null;
  linkTarget: LinkTarget;
  priority: number;
  displayOrder: number;
  imageUrl: string | null;
  mobileImageUrl: string | null;
  heading: string;
  subheading: string;
  description: string;
  buttonText: string;
  buttonStyle: string;
  status: BannerStatus;
  visibility: BannerVisibility;
  displayOn: string;
  device: string;
  startsAt: string | null;
  endsAt: string | null;
  showHomepageOnly: boolean;
};

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function toIsoDateTime(value: string) {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString();
}

function toLocalDateTimeValue(value: string | null | undefined) {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());

  return date.toISOString().slice(0, 16);
}

export function AdminBannerCreateView({ banner }: { banner?: AdminBannerFormInitialBanner }) {
  const router = useRouter();
  const isEditing = Boolean(banner);
  const [title, setTitle] = useState(banner?.title || "");
  const [bannerType, setBannerType] = useState(banner?.bannerType || BANNER_TYPES[0]);
  const [linkUrl, setLinkUrl] = useState(banner?.linkUrl || "");
  const [linkTarget, setLinkTarget] = useState<LinkTarget>(banner?.linkTarget || "same_window");
  const [priority, setPriority] = useState(String(banner?.priority ?? 1));
  const [displayOrder, setDisplayOrder] = useState(String(banner?.displayOrder ?? 0));
  const [imageUrl, setImageUrl] = useState(banner?.imageUrl || "");
  const [imagePreview, setImagePreview] = useState(banner?.imageUrl || "");
  const [mobileImageUrl, setMobileImageUrl] = useState(banner?.mobileImageUrl || "");
  const [mobileImagePreview, setMobileImagePreview] = useState(banner?.mobileImageUrl || "");
  const [heading, setHeading] = useState(banner?.heading || "");
  const [subheading, setSubheading] = useState(banner?.subheading || "");
  const [description, setDescription] = useState(banner?.description || "");
  const [buttonText, setButtonText] = useState(banner?.buttonText || "");
  const [buttonStyle, setButtonStyle] = useState(banner?.buttonStyle || BUTTON_STYLES[0]);
  const [status, setStatus] = useState<BannerStatus>(banner?.status || "active");
  const [visibility, setVisibility] = useState<BannerVisibility>(banner?.visibility || "public");
  const [displayOn, setDisplayOn] = useState(banner?.displayOn || DISPLAY_LOCATIONS[0]);
  const [device, setDevice] = useState(banner?.device || DEVICES[0]);
  const [startsAt, setStartsAt] = useState(() => toLocalDateTimeValue(banner?.startsAt));
  const [endsAt, setEndsAt] = useState(() => toLocalDateTimeValue(banner?.endsAt));
  const [showHomepageOnly, setShowHomepageOnly] = useState(banner?.showHomepageOnly ?? false);
  const [loading, setLoading] = useState(false);
  const [uploadingSlot, setUploadingSlot] = useState<"desktop" | "mobile" | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const desktopInputRef = useRef<HTMLInputElement | null>(null);
  const mobileInputRef = useRef<HTMLInputElement | null>(null);

  async function updateImage(slot: "desktop" | "mobile", event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    const uploadTitle = slugify(title);

    if (!uploadTitle) {
      setError("Enter a banner title before uploading images.");
      return;
    }

    setUploadingSlot(slot);
    setError("");
    setMessage("");

    const localPreview = URL.createObjectURL(file);

    if (slot === "desktop") {
      setImagePreview(localPreview);
    } else {
      setMobileImagePreview(localPreview);
    }

    try {
      const formData = new FormData();
      formData.set("file", file);
      formData.set("title", uploadTitle);
      formData.set("slot", slot);

      const response = await fetch("/api/admin/banners/upload", {
        method: "POST",
        body: formData,
      });
      const payload = await readJsonSafely<{ error?: string; url?: string }>(response);

      if (!response.ok || !payload?.url) {
        throw new Error(getResponseErrorMessage(payload, "Unable to upload the selected image."));
      }

      if (slot === "desktop") {
        setImageUrl(payload.url);
        setImagePreview(payload.url);
      } else {
        setMobileImageUrl(payload.url);
        setMobileImagePreview(payload.url);
      }

      setMessage(slot === "desktop" ? "Banner image uploaded." : "Mobile image uploaded.");
    } catch (uploadError) {
      setError(getErrorMessage(uploadError, "Unable to upload the selected image."));
    } finally {
      setUploadingSlot(null);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch("/api/admin/banners", {
        method: isEditing ? "PATCH" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: banner?.id,
          title,
          bannerType,
          linkUrl: linkUrl || null,
          linkTarget,
          priority,
          displayOrder,
          imageUrl: imageUrl || null,
          mobileImageUrl: mobileImageUrl || null,
          heading,
          subheading,
          description,
          buttonText,
          buttonStyle,
          status,
          visibility,
          displayOn,
          device,
          startsAt: toIsoDateTime(startsAt),
          endsAt: toIsoDateTime(endsAt),
          showHomepageOnly,
        }),
      });
      const payload = await readJsonSafely<{ error?: string }>(response);

      if (!response.ok) {
        throw new Error(getResponseErrorMessage(payload, "Unable to save the banner."));
      }

      setMessage("Banner saved.");
      router.push("/admin/banners");
      router.refresh();
    } catch (saveError) {
      setError(getErrorMessage(saveError, "Unable to save the banner."));
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    if (!banner || !window.confirm("Delete this banner? This cannot be undone.")) {
      return;
    }

    setLoading(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch("/api/admin/banners", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ id: banner.id }),
      });
      const payload = await readJsonSafely<{ error?: string }>(response);

      if (!response.ok) {
        throw new Error(getResponseErrorMessage(payload, "Unable to delete the banner."));
      }

      router.push("/admin/banners");
      router.refresh();
    } catch (deleteError) {
      setError(getErrorMessage(deleteError, "Unable to delete the banner."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="vh-admin-create-collection vh-admin-create-banner" onSubmit={handleSubmit}>
      <header className="vh-admin-create-collection__header">
        <div>
          <h1>{isEditing ? "Edit Banner" : "Add New Banner"}</h1>
          <nav className="vh-admin-breadcrumb" aria-label="Breadcrumb">
            <Link href="/admin">Dashboard</Link>
            <ChevronRight size={14} strokeWidth={1.8} aria-hidden="true" />
            <Link href="/admin/banners">Banners</Link>
            <ChevronRight size={14} strokeWidth={1.8} aria-hidden="true" />
            <span>{isEditing ? "Edit Banner" : "Add New Banner"}</span>
          </nav>
        </div>
        <div className="vh-admin-create-collection__actions">
          {isEditing ? (
            <button className="vh-admin-action-button" type="button" onClick={() => void handleDelete()} disabled={loading || Boolean(uploadingSlot)}>
              Delete
            </button>
          ) : null}
          <Link className="vh-admin-action-button" href="/admin/banners">Cancel</Link>
          <button className="vh-admin-action-button vh-admin-action-button--primary" type="submit" disabled={loading || Boolean(uploadingSlot)}>
            <Save size={16} strokeWidth={1.9} aria-hidden="true" />
            <span>{loading ? "Saving..." : "Save Banner"}</span>
          </button>
        </div>
      </header>

      {message ? <div className="vh-admin-alert"><p>{message}</p></div> : null}
      {error ? <div className="vh-admin-alert vh-admin-alert--error"><p>{error}</p></div> : null}

      <div className="vh-admin-create-collection__layout">
        <main className="vh-admin-create-collection__main">
          <section className="vh-admin-form-card">
            <div className="vh-admin-form-card__header">
              <h2>Banner Information</h2>
              <p>Create a new banner to showcase promotions and important messages.</p>
            </div>
            <div className="vh-admin-form-grid">
              <label className="vh-admin-form-field">
                <span>Title <b>*</b></span>
                <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Enter banner title" required />
                <small>Internal title for easy identification.</small>
              </label>
              <label className="vh-admin-form-field">
                <span>Banner Type</span>
                <select value={bannerType} onChange={(event) => setBannerType(event.target.value)}>
                  {BANNER_TYPES.map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
                <small>Choose where this banner will appear.</small>
              </label>
              <label className="vh-admin-form-field">
                <span>Link <em>(Optional)</em></span>
                <span className="vh-admin-input-icon">
                  <Link2 size={16} aria-hidden="true" />
                  <input value={linkUrl} onChange={(event) => setLinkUrl(event.target.value)} placeholder="Enter URL or internal path" />
                </span>
                <small>Add a link to make the banner clickable.</small>
              </label>
              <label className="vh-admin-form-field">
                <span>Open Link In</span>
                <select value={linkTarget} onChange={(event) => setLinkTarget(event.target.value as LinkTarget)}>
                  <option value="same_window">Same Window</option>
                  <option value="new_tab">New Tab</option>
                </select>
                <small>Choose how the link opens.</small>
              </label>
              <label className="vh-admin-form-field">
                <span>Priority</span>
                <input type="number" min="1" value={priority} onChange={(event) => setPriority(event.target.value)} />
                <small>Lower numbers have higher priority.</small>
              </label>
              <label className="vh-admin-form-field">
                <span>Display Order</span>
                <input type="number" min="0" value={displayOrder} onChange={(event) => setDisplayOrder(event.target.value)} />
                <small>Order in which banners appear.</small>
              </label>
            </div>
            <div className="vh-admin-form-field">
              <span>Banner Image <b>*</b></span>
              <div className="vh-admin-upload-panel vh-admin-wide-upload-panel">
                {imagePreview ? <img src={imagePreview} alt="" /> : <UploadCloud size={34} strokeWidth={1.7} aria-hidden="true" />}
                <strong>Upload banner image</strong>
                <small>PNG, JPG or WEBP. Recommended size: 1920x600px.</small>
                <input ref={desktopInputRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => void updateImage("desktop", event)} />
                <button type="button" className="vh-admin-action-button" onClick={() => desktopInputRef.current?.click()} disabled={loading || Boolean(uploadingSlot)}>
                  {uploadingSlot === "desktop" ? "Uploading..." : "Choose Image"}
                </button>
              </div>
            </div>
            <div className="vh-admin-form-field">
              <span>Mobile Image <em>(Optional)</em></span>
              <div className="vh-admin-upload-panel vh-admin-wide-upload-panel">
                {mobileImagePreview ? <img src={mobileImagePreview} alt="" /> : <UploadCloud size={34} strokeWidth={1.7} aria-hidden="true" />}
                <strong>Upload mobile image</strong>
                <small>PNG, JPG or WEBP. Recommended size: 768x1024px.</small>
                <input ref={mobileInputRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => void updateImage("mobile", event)} />
                <button type="button" className="vh-admin-action-button" onClick={() => mobileInputRef.current?.click()} disabled={loading || Boolean(uploadingSlot)}>
                  {uploadingSlot === "mobile" ? "Uploading..." : "Choose Image"}
                </button>
              </div>
              <small>Optional image for mobile devices.</small>
            </div>
          </section>

          <section className="vh-admin-form-card">
            <div className="vh-admin-form-card__header">
              <h2>Banner Content</h2>
              <p>Add text content and styling for your banner.</p>
            </div>
            <div className="vh-admin-form-grid">
              <label className="vh-admin-form-field">
                <span>Heading <em>(Optional)</em></span>
                <input value={heading} onChange={(event) => setHeading(event.target.value)} placeholder="Enter heading text" />
              </label>
              <label className="vh-admin-form-field">
                <span>Subheading <em>(Optional)</em></span>
                <input value={subheading} onChange={(event) => setSubheading(event.target.value)} placeholder="Enter subheading text" />
              </label>
            </div>
            <div className="vh-admin-form-grid vh-admin-banner-content-grid">
              <label className="vh-admin-form-field">
                <span>Description <em>(Optional)</em></span>
                <div className="vh-admin-rich-editor">
                  <div className="vh-admin-rich-editor__toolbar" aria-hidden="true">
                    <button type="button">Paragraph</button>
                    <button type="button">B</button>
                    <button type="button">I</button>
                    <button type="button">U</button>
                    <button type="button">•</button>
                    <button type="button">1.</button>
                    <button type="button">≡</button>
                    <button type="button"><Link2 size={15} aria-hidden="true" /></button>
                  </div>
                  <textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Enter banner description..." />
                </div>
                <small>This text will appear on the banner if supported.</small>
              </label>
              <div className="vh-admin-form-card--subgrid">
                <label className="vh-admin-form-field">
                  <span>Button Text <em>(Optional)</em></span>
                  <input value={buttonText} onChange={(event) => setButtonText(event.target.value)} placeholder="Enter button text" />
                </label>
                <label className="vh-admin-form-field">
                  <span>Button Style</span>
                  <select value={buttonStyle} onChange={(event) => setButtonStyle(event.target.value)}>
                    {BUTTON_STYLES.map((option) => <option key={option} value={option}>{option}</option>)}
                  </select>
                  <small>Choose the button style.</small>
                </label>
              </div>
            </div>
          </section>
        </main>

        <aside className="vh-admin-create-collection__sidebar">
          <section className="vh-admin-form-card">
            <div className="vh-admin-form-card__header">
              <h2>Banner Status</h2>
              <p>Control the visibility and status of this banner.</p>
            </div>
            <label className="vh-admin-form-field">
              <span>Status <b>*</b></span>
              <select value={status} onChange={(event) => setStatus(event.target.value as BannerStatus)}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="draft">Draft</option>
              </select>
              <small>Only active banners will be displayed.</small>
            </label>
            <fieldset className="vh-admin-radio-stack">
              <legend>Visibility</legend>
              <label>
                <input type="radio" name="bannerVisibility" checked={visibility === "public"} onChange={() => setVisibility("public")} />
                <span><strong><Eye size={15} aria-hidden="true" /> Public</strong><small>Visible to everyone.</small></span>
              </label>
              <label>
                <input type="radio" name="bannerVisibility" checked={visibility === "logged_in"} onChange={() => setVisibility("logged_in")} />
                <span><strong><Lock size={15} aria-hidden="true" /> Logged In Users Only</strong><small>Visible only to logged in users.</small></span>
              </label>
              <label>
                <input type="radio" name="bannerVisibility" checked={visibility === "password"} onChange={() => setVisibility("password")} />
                <span><strong><Lock size={15} aria-hidden="true" /> Password Protected</strong><small>Only users with password can view.</small></span>
              </label>
            </fieldset>
          </section>

          <section className="vh-admin-form-card">
            <div className="vh-admin-form-card__header">
              <h2>Display Settings</h2>
              <p>Configure where and how the banner appears.</p>
            </div>
            <label className="vh-admin-form-field">
              <span>Display On</span>
              <select value={displayOn} onChange={(event) => setDisplayOn(event.target.value)}>
                {DISPLAY_LOCATIONS.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
              <small>Choose where this banner will be shown.</small>
            </label>
            <label className="vh-admin-form-field">
              <span>Device</span>
              <select value={device} onChange={(event) => setDevice(event.target.value)}>
                {DEVICES.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
              <small>Select device visibility for this banner.</small>
            </label>
            <label className="vh-admin-form-field">
              <span>Start Date <em>(Optional)</em></span>
              <span className="vh-admin-input-icon">
                <CalendarDays size={16} aria-hidden="true" />
                <input type="datetime-local" value={startsAt} onChange={(event) => setStartsAt(event.target.value)} />
              </span>
              <small>Banner will be visible from this date.</small>
            </label>
            <label className="vh-admin-form-field">
              <span>End Date <em>(Optional)</em></span>
              <span className="vh-admin-input-icon">
                <CalendarDays size={16} aria-hidden="true" />
                <input type="datetime-local" value={endsAt} onChange={(event) => setEndsAt(event.target.value)} />
              </span>
              <small>Banner will be hidden after this date.</small>
            </label>
          </section>

          <section className="vh-admin-form-card">
            <div className="vh-admin-form-card__header">
              <h2>Additional Options</h2>
              <p>Extra settings for advanced customization.</p>
            </div>
            <label className="vh-admin-sidebar-toggle">
              <span>
                <strong>Show on Homepage Only</strong>
                <small>Display this banner only on homepage.</small>
              </span>
              <input type="checkbox" checked={showHomepageOnly} onChange={(event) => setShowHomepageOnly(event.target.checked)} />
              <i />
            </label>
          </section>
        </aside>
      </div>
    </form>
  );
}
