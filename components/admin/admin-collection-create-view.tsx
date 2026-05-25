"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import {
  CalendarDays,
  ChevronRight,
  Clock3,
  ImageIcon,
  Link2,
  Save,
  Search,
  UploadCloud,
} from "lucide-react";

import { getErrorMessage, getResponseErrorMessage, readJsonSafely } from "@/lib/http";

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function combineDateTime(date: string, time: string) {
  if (!date) {
    return null;
  }

  const value = new Date(`${date}T${time || "00:00"}`);

  if (Number.isNaN(value.getTime())) {
    return null;
  }

  return value.toISOString();
}

export function AdminCollectionCreateView() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [imagePreview, setImagePreview] = useState("");
  const [status, setStatus] = useState(true);
  const [collectionType, setCollectionType] = useState<"manual" | "automatic">("manual");
  const [displayOrder, setDisplayOrder] = useState("0");
  const [featured, setFeatured] = useState(false);
  const [featuredFromDate, setFeaturedFromDate] = useState("");
  const [featuredFromTime, setFeaturedFromTime] = useState("");
  const [featuredUntilDate, setFeaturedUntilDate] = useState("");
  const [featuredUntilTime, setFeaturedUntilTime] = useState("");
  const [metaTitle, setMetaTitle] = useState("");
  const [metaDescription, setMetaDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const previewTitle = metaTitle.trim() || name.trim() || "Collection title";
  const previewDescription = metaDescription.trim() || description.trim() || "Collection description will appear here once written.";
  const previewUrl = useMemo(() => `/collections/${slug || "collection-slug"}`, [slug]);

  function updateName(nextName: string) {
    setName(nextName);

    if (!slug || slug === slugify(name)) {
      setSlug(slugify(nextName));
    }
  }

  async function updateImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    const uploadSlug = slug || slugify(name);

    if (!uploadSlug) {
      setError("Enter a collection name or slug before uploading an image.");
      return;
    }

    setUploading(true);
    setError("");
    setMessage("");
    setImagePreview(URL.createObjectURL(file));

    try {
      const formData = new FormData();
      formData.set("file", file);
      formData.set("slug", uploadSlug);

      const response = await fetch("/api/admin/collections/upload", {
        method: "POST",
        body: formData,
      });
      const payload = await readJsonSafely<{ error?: string; url?: string }>(response);

      if (!response.ok || !payload?.url) {
        throw new Error(getResponseErrorMessage(payload, "Unable to upload the selected image."));
      }

      setImageUrl(payload.url);
      setImagePreview(payload.url);
      setMessage("Collection image uploaded.");
    } catch (uploadError) {
      setError(getErrorMessage(uploadError, "Unable to upload the selected image."));
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch("/api/admin/collections", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          slug,
          description,
          imageUrl: imageUrl || null,
          status: status ? "active" : "draft",
          collectionType,
          displayOrder,
          isFeatured: featured,
          featuredFrom: combineDateTime(featuredFromDate, featuredFromTime),
          featuredUntil: combineDateTime(featuredUntilDate, featuredUntilTime),
          metaTitle,
          metaDescription,
        }),
      });
      const payload = await readJsonSafely<{ error?: string }>(response);

      if (!response.ok) {
        throw new Error(getResponseErrorMessage(payload, "Unable to save the collection."));
      }

      setMessage("Collection created.");
      router.push("/admin/collections");
      router.refresh();
    } catch (saveError) {
      setError(getErrorMessage(saveError, "Unable to save the collection."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="vh-admin-create-collection" onSubmit={handleSubmit}>
      <header className="vh-admin-create-collection__header">
        <div>
          <h1>Add Collection</h1>
          <nav className="vh-admin-breadcrumb" aria-label="Breadcrumb">
            <Link href="/admin">Dashboard</Link>
            <ChevronRight size={14} strokeWidth={1.8} aria-hidden="true" />
            <Link href="/admin/collections">Collections</Link>
            <ChevronRight size={14} strokeWidth={1.8} aria-hidden="true" />
            <span>Add Collection</span>
          </nav>
        </div>
        <div className="vh-admin-create-collection__actions">
          <Link className="vh-admin-action-button" href="/admin/collections">Cancel</Link>
          <button className="vh-admin-action-button vh-admin-action-button--primary" type="submit" disabled={loading || uploading}>
            <Save size={16} strokeWidth={1.9} aria-hidden="true" />
            <span>{loading ? "Saving..." : "Save Collection"}</span>
          </button>
        </div>
      </header>

      {message ? <div className="vh-admin-alert"><p>{message}</p></div> : null}
      {error ? <div className="vh-admin-alert vh-admin-alert--error"><p>{error}</p></div> : null}

      <div className="vh-admin-create-collection__layout">
        <main className="vh-admin-create-collection__main">
          <section className="vh-admin-form-card">
            <div className="vh-admin-form-card__header">
              <h2>Collection Information</h2>
              <p>Add the basic information for your collection.</p>
            </div>

            <label className="vh-admin-form-field">
              <span>Collection Name <b>*</b></span>
              <input value={name} onChange={(event) => updateName(event.target.value)} placeholder="Enter collection name" required />
              <small>Choose a unique and descriptive name for your collection.</small>
            </label>

            <label className="vh-admin-form-field">
              <span>Slug <b>*</b></span>
              <input value={slug} onChange={(event) => setSlug(slugify(event.target.value))} placeholder="Enter collection slug" required />
              <small>URL friendly version, for example: new-arrivals.</small>
            </label>

            <label className="vh-admin-form-field">
              <span>Description</span>
              <div className="vh-admin-rich-editor">
                <div className="vh-admin-rich-editor__toolbar" aria-hidden="true">
                  <button type="button">Paragraph</button>
                  <button type="button">B</button>
                  <button type="button">I</button>
                  <button type="button">U</button>
                  <button type="button">S</button>
                  <button type="button">•</button>
                  <button type="button">1.</button>
                  <button type="button">≡</button>
                  <button type="button"><Link2 size={15} aria-hidden="true" /></button>
                  <button type="button"><ImageIcon size={15} aria-hidden="true" /></button>
                </div>
                <textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Write a short description about this collection..." />
              </div>
              <small>Describe what this collection is about and what makes it special.</small>
            </label>

            <div className="vh-admin-form-field">
              <span>Collection Image <b>*</b></span>
              <div className="vh-admin-upload-panel">
                {imagePreview ? <img src={imagePreview} alt="" /> : <UploadCloud size={34} strokeWidth={1.7} aria-hidden="true" />}
                <strong>Upload collection image</strong>
                <small>PNG, JPG or WEBP. Recommended size: 1200x800px.</small>
                <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => void updateImage(event)} />
                <button type="button" className="vh-admin-action-button" onClick={() => fileInputRef.current?.click()} disabled={loading || uploading}>
                  {uploading ? "Uploading..." : "Upload Image"}
                </button>
              </div>
            </div>

            <div className="vh-admin-form-field">
              <span>Status</span>
              <label className="vh-admin-toggle-row">
                <input type="checkbox" checked={status} onChange={(event) => setStatus(event.target.checked)} disabled={loading || uploading} />
                <span />
                <strong>{status ? "Active" : "Draft"}</strong>
              </label>
              <small>Active collections are available for product assignment.</small>
            </div>
          </section>

          <section className="vh-admin-form-card vh-admin-form-card--compact">
            <div className="vh-admin-form-card__header vh-admin-form-card__header--inline">
              <div>
                <h2>Search Engine Listing Preview</h2>
                <p>This is how your collection may appear in search results.</p>
              </div>
              <Search size={18} strokeWidth={1.8} aria-hidden="true" />
            </div>
            <div className="vh-admin-seo-preview">
              <strong>{previewTitle}</strong>
              <span>{previewUrl}</span>
              <p>{previewDescription}</p>
            </div>
          </section>
        </main>

        <aside className="vh-admin-create-collection__sidebar">
          <section className="vh-admin-form-card">
            <div className="vh-admin-form-card__header">
              <h2>Collection Settings</h2>
              <p>Configure visibility and display options.</p>
            </div>

            <fieldset className="vh-admin-radio-stack">
              <legend>Collection Type</legend>
              <label>
                <input type="radio" name="collectionType" checked={collectionType === "manual"} onChange={() => setCollectionType("manual")} />
                <span>
                  <strong>Manual</strong>
                  <small>Add products to this collection manually.</small>
                </span>
              </label>
              <label>
                <input type="radio" name="collectionType" checked={collectionType === "automatic"} onChange={() => setCollectionType("automatic")} />
                <span>
                  <strong>Automatic</strong>
                  <small>Products will be added automatically based on conditions.</small>
                </span>
              </label>
            </fieldset>

            <label className="vh-admin-form-field">
              <span>Display Order</span>
              <input type="number" min="0" value={displayOrder} onChange={(event) => setDisplayOrder(event.target.value)} />
              <small>Lower numbers appear first.</small>
            </label>

            <label className="vh-admin-sidebar-toggle">
              <span>
                <strong>Featured Collection</strong>
                <small>Mark this collection as featured for admin merchandising.</small>
              </span>
              <input type="checkbox" checked={featured} onChange={(event) => setFeatured(event.target.checked)} disabled={loading || uploading} />
              <i />
            </label>
          </section>

          <section className="vh-admin-form-card">
            <div className="vh-admin-form-card__header">
              <h2>Collection Schedule <span>(Optional)</span></h2>
              <p>Set when this collection should be featured.</p>
            </div>
            <div className="vh-admin-date-grid">
              <label className="vh-admin-form-field">
                <span>Featured From</span>
                <span className="vh-admin-input-icon">
                  <CalendarDays size={16} aria-hidden="true" />
                  <input type="date" value={featuredFromDate} onChange={(event) => setFeaturedFromDate(event.target.value)} />
                </span>
              </label>
              <label className="vh-admin-form-field">
                <span>&nbsp;</span>
                <span className="vh-admin-input-icon">
                  <Clock3 size={16} aria-hidden="true" />
                  <input type="time" value={featuredFromTime} onChange={(event) => setFeaturedFromTime(event.target.value)} />
                </span>
              </label>
              <label className="vh-admin-form-field">
                <span>Featured Until</span>
                <span className="vh-admin-input-icon">
                  <CalendarDays size={16} aria-hidden="true" />
                  <input type="date" value={featuredUntilDate} onChange={(event) => setFeaturedUntilDate(event.target.value)} />
                </span>
              </label>
              <label className="vh-admin-form-field">
                <span>&nbsp;</span>
                <span className="vh-admin-input-icon">
                  <Clock3 size={16} aria-hidden="true" />
                  <input type="time" value={featuredUntilTime} onChange={(event) => setFeaturedUntilTime(event.target.value)} />
                </span>
              </label>
            </div>
          </section>

          <section className="vh-admin-form-card">
            <div className="vh-admin-form-card__header">
              <h2>SEO Settings <span>(Optional)</span></h2>
              <p>Improve your collection&apos;s search visibility.</p>
            </div>
            <label className="vh-admin-form-field">
              <span>Meta Title</span>
              <input value={metaTitle} onChange={(event) => setMetaTitle(event.target.value)} placeholder="Enter meta title" />
              <small>Recommended: 50-60 characters.</small>
            </label>
            <label className="vh-admin-form-field">
              <span>Meta Description</span>
              <textarea value={metaDescription} onChange={(event) => setMetaDescription(event.target.value)} placeholder="Enter meta description" />
              <small>Recommended: 150-160 characters.</small>
            </label>
          </section>
        </aside>
      </div>
    </form>
  );
}
