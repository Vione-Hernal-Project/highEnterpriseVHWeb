"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { ChevronRight, Eye, FileText, ImageIcon, Link2, Lock, Save, UploadCloud } from "lucide-react";

import { getErrorMessage, getResponseErrorMessage, readJsonSafely } from "@/lib/http";

type PageStatus = "published" | "draft" | "archived";
type PageVisibility = "public" | "private" | "password";

type PageParentOption = {
  id: string;
  title: string;
  href: string;
};

export type AdminPageFormInitialPage = {
  id: string;
  title: string;
  slug: string;
  pageType: string;
  parentPageId: string | null;
  metaDescription: string;
  content: string;
  featuredImageUrl: string | null;
  status: PageStatus;
  visibility: PageVisibility;
  template: string;
  showInNavigation: boolean;
  displayOrder: number;
  metaTitle: string;
  metaKeywords: string;
};

const PAGE_TYPES = ["Custom Page", "Landing Page", "Policy Page", "Legal Page", "Support Page", "Editorial Page"];
const PAGE_TEMPLATES = ["Default Template", "Editorial Template", "Landing Template", "Policy Template", "Minimal Template"];

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function AdminPageCreateView({ parentOptions, page }: { parentOptions: PageParentOption[]; page?: AdminPageFormInitialPage }) {
  const router = useRouter();
  const isEditing = Boolean(page);
  const [title, setTitle] = useState(page?.title || "");
  const [slug, setSlug] = useState(page?.slug || "");
  const [pageType, setPageType] = useState(page?.pageType || PAGE_TYPES[0]);
  const [parentPageId, setParentPageId] = useState(page?.parentPageId || "");
  const [metaDescription, setMetaDescription] = useState(page?.metaDescription || "");
  const [content, setContent] = useState(page?.content || "");
  const [featuredImageUrl, setFeaturedImageUrl] = useState(page?.featuredImageUrl || "");
  const [imagePreview, setImagePreview] = useState(page?.featuredImageUrl || "");
  const [status, setStatus] = useState<PageStatus>(page?.status || "published");
  const [visibility, setVisibility] = useState<PageVisibility>(page?.visibility || "public");
  const [template, setTemplate] = useState(page?.template || PAGE_TEMPLATES[0]);
  const [showInNavigation, setShowInNavigation] = useState(page?.showInNavigation ?? true);
  const [displayOrder, setDisplayOrder] = useState(String(page?.displayOrder ?? 0));
  const [metaTitle, setMetaTitle] = useState(page?.metaTitle || "");
  const [metaKeywords, setMetaKeywords] = useState(page?.metaKeywords || "");
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const previewUrl = useMemo(() => `/${slug || "page-slug"}`, [slug]);

  function updateTitle(nextTitle: string) {
    setTitle(nextTitle);

    if (!slug || slug === slugify(title)) {
      setSlug(slugify(nextTitle));
    }
  }

  async function updateImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    const uploadSlug = slug || slugify(title);

    if (!uploadSlug) {
      setError("Enter a page title or slug before uploading a featured image.");
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

      const response = await fetch("/api/admin/pages/upload", {
        method: "POST",
        body: formData,
      });
      const payload = await readJsonSafely<{ error?: string; url?: string }>(response);

      if (!response.ok || !payload?.url) {
        throw new Error(getResponseErrorMessage(payload, "Unable to upload the selected image."));
      }

      setFeaturedImageUrl(payload.url);
      setImagePreview(payload.url);
      setMessage("Featured image uploaded.");
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
      const response = await fetch("/api/admin/pages", {
        method: isEditing ? "PATCH" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: page?.id,
          title,
          slug,
          pageType,
          parentPageId: parentPageId || null,
          metaDescription,
          content,
          featuredImageUrl: featuredImageUrl || null,
          status,
          visibility,
          template,
          showInNavigation,
          displayOrder,
          metaTitle,
          metaKeywords,
        }),
      });
      const payload = await readJsonSafely<{ error?: string }>(response);

      if (!response.ok) {
        throw new Error(getResponseErrorMessage(payload, "Unable to save the page."));
      }

      setMessage("Page saved.");
      router.push("/admin/pages");
      router.refresh();
    } catch (saveError) {
      setError(getErrorMessage(saveError, "Unable to save the page."));
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    if (!page || !window.confirm("Delete this page? This cannot be undone.")) {
      return;
    }

    setLoading(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch("/api/admin/pages", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ id: page.id }),
      });
      const payload = await readJsonSafely<{ error?: string }>(response);

      if (!response.ok) {
        throw new Error(getResponseErrorMessage(payload, "Unable to delete the page."));
      }

      router.push("/admin/pages");
      router.refresh();
    } catch (deleteError) {
      setError(getErrorMessage(deleteError, "Unable to delete the page."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="vh-admin-create-collection vh-admin-create-page" onSubmit={handleSubmit}>
      <header className="vh-admin-create-collection__header">
        <div>
          <h1>{isEditing ? "Edit Page" : "Add New Page"}</h1>
          <nav className="vh-admin-breadcrumb" aria-label="Breadcrumb">
            <Link href="/admin">Dashboard</Link>
            <ChevronRight size={14} strokeWidth={1.8} aria-hidden="true" />
            <Link href="/admin/pages">Pages</Link>
            <ChevronRight size={14} strokeWidth={1.8} aria-hidden="true" />
            <span>{isEditing ? "Edit Page" : "Add New Page"}</span>
          </nav>
        </div>
        <div className="vh-admin-create-collection__actions">
          {isEditing ? (
            <button className="vh-admin-action-button" type="button" onClick={() => void handleDelete()} disabled={loading || uploading}>
              Delete
            </button>
          ) : null}
          <Link className="vh-admin-action-button" href="/admin/pages">Cancel</Link>
          <button className="vh-admin-action-button vh-admin-action-button--primary" type="submit" disabled={loading || uploading}>
            <Save size={16} strokeWidth={1.9} aria-hidden="true" />
            <span>{loading ? "Saving..." : "Save Page"}</span>
          </button>
        </div>
      </header>

      {message ? <div className="vh-admin-alert"><p>{message}</p></div> : null}
      {error ? <div className="vh-admin-alert vh-admin-alert--error"><p>{error}</p></div> : null}

      <div className="vh-admin-create-collection__layout">
        <main className="vh-admin-create-collection__main">
          <section className="vh-admin-form-card">
            <div className="vh-admin-form-card__header">
              <h2>Page Information</h2>
              <p>Create and customize your website page.</p>
            </div>
            <div className="vh-admin-form-grid">
              <label className="vh-admin-form-field">
                <span>Page Title <b>*</b></span>
                <input value={title} onChange={(event) => updateTitle(event.target.value)} placeholder="Enter page title" required />
                <small>This is the title that will appear in the browser tab.</small>
              </label>
              <label className="vh-admin-form-field">
                <span>Slug <b>*</b></span>
                <span className="vh-admin-input-icon">
                  <Link2 size={16} aria-hidden="true" />
                  <input value={slug} onChange={(event) => setSlug(slugify(event.target.value))} placeholder="Enter page slug" required />
                </span>
                <small>URL preview: {previewUrl}</small>
              </label>
              <label className="vh-admin-form-field">
                <span>Page Type</span>
                <select value={pageType} onChange={(event) => setPageType(event.target.value)}>
                  {PAGE_TYPES.map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
                <small>Choose the type of page you want to create.</small>
              </label>
              <label className="vh-admin-form-field">
                <span>Parent Page <em>(Optional)</em></span>
                <select value={parentPageId} onChange={(event) => setParentPageId(event.target.value)}>
                  <option value="">Select parent page</option>
                  {parentOptions.map((option) => <option key={option.id} value={option.id}>{option.title}</option>)}
                </select>
                <small>Leave blank for top-level pages.</small>
              </label>
            </div>
            <label className="vh-admin-form-field">
              <span>Meta Description <em>(Optional)</em></span>
              <textarea value={metaDescription} onChange={(event) => setMetaDescription(event.target.value)} placeholder="Enter meta description" />
              <small>This description may appear in search engine results.</small>
            </label>
          </section>

          <section className="vh-admin-form-card">
            <div className="vh-admin-form-card__header">
              <h2>Page Content</h2>
              <p>Build and format your page content.</p>
            </div>
            <label className="vh-admin-form-field">
              <span>Content <b>*</b></span>
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
                <textarea value={content} onChange={(event) => setContent(event.target.value)} placeholder="Write your page content here..." required />
              </div>
              <small>Use the editor to add text, images, links, and more to your page.</small>
            </label>
          </section>

          <section className="vh-admin-form-card">
            <div className="vh-admin-form-card__header">
              <h2>Featured Image <span>(Optional)</span></h2>
              <p>Upload a featured image for this page.</p>
            </div>
            <div className="vh-admin-upload-panel vh-admin-page-upload-panel">
              {imagePreview ? <img loading="lazy" decoding="async" src={imagePreview} alt="" /> : <UploadCloud size={34} strokeWidth={1.7} aria-hidden="true" />}
              <strong>Upload featured image</strong>
              <small>PNG, JPG or WEBP. Recommended size: 1200x630px.</small>
              <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => void updateImage(event)} />
              <button type="button" className="vh-admin-action-button" onClick={() => fileInputRef.current?.click()} disabled={loading || uploading}>
                {uploading ? "Uploading..." : "Choose Image"}
              </button>
            </div>
          </section>
        </main>

        <aside className="vh-admin-create-collection__sidebar">
          <section className="vh-admin-form-card">
            <div className="vh-admin-form-card__header">
              <h2>Page Status</h2>
              <p>Control the visibility and status of this page.</p>
            </div>
            <label className="vh-admin-form-field">
              <span>Status <b>*</b></span>
              <select value={status} onChange={(event) => setStatus(event.target.value as PageStatus)}>
                <option value="published">Published</option>
                <option value="draft">Draft</option>
                <option value="archived">Archived</option>
              </select>
              <small>{status === "published" ? "Published pages are visible to the public." : "This page will stay out of public navigation."}</small>
            </label>
            <fieldset className="vh-admin-radio-stack">
              <legend>Visibility</legend>
              <label>
                <input type="radio" name="pageVisibility" checked={visibility === "public"} onChange={() => setVisibility("public")} />
                <span><strong><Eye size={15} aria-hidden="true" /> Public</strong><small>Visible to everyone.</small></span>
              </label>
              <label>
                <input type="radio" name="pageVisibility" checked={visibility === "private"} onChange={() => setVisibility("private")} />
                <span><strong><Lock size={15} aria-hidden="true" /> Private</strong><small>Only admins can view this page.</small></span>
              </label>
              <label>
                <input type="radio" name="pageVisibility" checked={visibility === "password"} onChange={() => setVisibility("password")} />
                <span><strong><Lock size={15} aria-hidden="true" /> Password Protected</strong><small>Only users with password can view.</small></span>
              </label>
            </fieldset>
          </section>

          <section className="vh-admin-form-card">
            <div className="vh-admin-form-card__header">
              <h2>Page Settings</h2>
              <p>Additional settings for this page.</p>
            </div>
            <label className="vh-admin-form-field">
              <span>Template</span>
              <select value={template} onChange={(event) => setTemplate(event.target.value)}>
                {PAGE_TEMPLATES.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
              <small>Choose a template for this page layout.</small>
            </label>
            <label className="vh-admin-sidebar-toggle">
              <span>
                <strong>Show in Navigation</strong>
                <small>Display this page in the main navigation menu.</small>
              </span>
              <input type="checkbox" checked={showInNavigation} onChange={(event) => setShowInNavigation(event.target.checked)} />
              <i />
            </label>
            <label className="vh-admin-form-field">
              <span>Display Order</span>
              <input type="number" min="0" value={displayOrder} onChange={(event) => setDisplayOrder(event.target.value)} />
              <small>Pages with lower numbers appear first.</small>
            </label>
          </section>

          <section className="vh-admin-form-card">
            <div className="vh-admin-form-card__header">
              <h2>SEO Settings</h2>
              <p>Optimize your page for search engines.</p>
            </div>
            <label className="vh-admin-form-field">
              <span>Meta Title <em>(Optional)</em></span>
              <input value={metaTitle} onChange={(event) => setMetaTitle(event.target.value)} placeholder="Enter meta title" />
              <small>Recommended: 50-60 characters.</small>
            </label>
            <label className="vh-admin-form-field">
              <span>Meta Keywords <em>(Optional)</em></span>
              <input value={metaKeywords} onChange={(event) => setMetaKeywords(event.target.value)} placeholder="Enter keywords separated by commas" />
              <small>Example: fashion, style, clothing.</small>
            </label>
          </section>
        </aside>
      </div>
    </form>
  );
}
