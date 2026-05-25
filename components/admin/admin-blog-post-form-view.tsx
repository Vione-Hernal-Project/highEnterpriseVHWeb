"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState, type ChangeEvent, type FormEvent, type KeyboardEvent } from "react";
import {
  CalendarDays,
  ChevronRight,
  Eye,
  FileText,
  ImageIcon,
  Link2,
  Lock,
  Save,
  Tag,
  UploadCloud,
  X,
} from "lucide-react";

import { getErrorMessage, getResponseErrorMessage, readJsonSafely } from "@/lib/http";

type BlogPostStatus = "published" | "draft" | "archived";
type BlogPostVisibility = "public" | "private" | "password";

export type AdminBlogPostFormOptions = {
  categories: string[];
  tags: string[];
  authors: string[];
};

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function getLocalDateTimeValue() {
  const date = new Date();
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());

  return date.toISOString().slice(0, 16);
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

function addUniqueValue(list: string[], value: string, limit = 20) {
  const nextValue = value.trim();

  if (!nextValue) {
    return list;
  }

  if (list.some((item) => item.toLowerCase() === nextValue.toLowerCase())) {
    return list;
  }

  return [...list, nextValue].slice(0, limit);
}

export function AdminBlogPostFormView({ options }: { options: AdminBlogPostFormOptions }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [featuredImageUrl, setFeaturedImageUrl] = useState("");
  const [imagePreview, setImagePreview] = useState("");
  const [content, setContent] = useState("");
  const [status, setStatus] = useState<BlogPostStatus>("published");
  const [visibility, setVisibility] = useState<BlogPostVisibility>("public");
  const [categories, setCategories] = useState<string[]>([]);
  const [categoryInput, setCategoryInput] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [publishDate, setPublishDate] = useState(getLocalDateTimeValue);
  const [authorName, setAuthorName] = useState(options.authors[0] || "Admin");
  const [metaTitle, setMetaTitle] = useState("");
  const [metaDescription, setMetaDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const previewTitle = metaTitle.trim() || title.trim() || "Post title";
  const previewDescription = metaDescription.trim() || excerpt.trim() || "Post description will appear here once written.";
  const previewUrl = useMemo(() => `/editorial/${slug || "your-post-slug"}`, [slug]);
  const categoryOptions = useMemo(
    () => options.categories.filter((option) => !categories.some((category) => category.toLowerCase() === option.toLowerCase())),
    [categories, options.categories],
  );
  const tagSuggestions = useMemo(
    () => options.tags.filter((option) => !tags.some((tagValue) => tagValue.toLowerCase() === option.toLowerCase())).slice(0, 8),
    [options.tags, tags],
  );

  function updateTitle(nextTitle: string) {
    setTitle(nextTitle);

    if (!slug || slug === slugify(title)) {
      setSlug(slugify(nextTitle));
    }
  }

  function addCategory(value: string) {
    setCategories((currentCategories) => addUniqueValue(currentCategories, value));
    setCategoryInput("");
  }

  function addTag(value: string) {
    setTags((currentTags) => addUniqueValue(currentTags, value));
    setTagInput("");
  }

  function handleCategoryKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter") {
      return;
    }

    event.preventDefault();
    addCategory(categoryInput);
  }

  function handleTagKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter") {
      return;
    }

    event.preventDefault();
    addTag(tagInput);
  }

  async function updateImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    const uploadSlug = slug || slugify(title);

    if (!uploadSlug) {
      setError("Enter a post title or slug before uploading a featured image.");
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

      const response = await fetch("/api/admin/blog/upload", {
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
      const response = await fetch("/api/admin/blog", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title,
          slug,
          excerpt,
          featuredImageUrl: featuredImageUrl || null,
          content,
          status,
          visibility,
          categories,
          tags,
          authorName,
          publishAt: toIsoDateTime(publishDate),
          metaTitle,
          metaDescription,
        }),
      });
      const payload = await readJsonSafely<{ error?: string }>(response);

      if (!response.ok) {
        throw new Error(getResponseErrorMessage(payload, "Unable to save the post."));
      }

      setMessage(status === "published" ? "Post published." : "Post saved.");
      router.push("/admin/blog");
      router.refresh();
    } catch (saveError) {
      setError(getErrorMessage(saveError, "Unable to save the post."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="vh-admin-create-collection vh-admin-create-blog-post" onSubmit={handleSubmit}>
      <header className="vh-admin-create-collection__header">
        <div>
          <h1>Add New Post</h1>
          <nav className="vh-admin-breadcrumb" aria-label="Breadcrumb">
            <Link href="/admin">Dashboard</Link>
            <ChevronRight size={14} strokeWidth={1.8} aria-hidden="true" />
            <Link href="/admin/blog">Blog</Link>
            <ChevronRight size={14} strokeWidth={1.8} aria-hidden="true" />
            <span>Add New Post</span>
          </nav>
        </div>
        <div className="vh-admin-create-collection__actions">
          <Link className="vh-admin-action-button" href="/admin/blog">Cancel</Link>
          <button className="vh-admin-action-button vh-admin-action-button--primary" type="submit" disabled={loading || uploading}>
            <Save size={16} strokeWidth={1.9} aria-hidden="true" />
            <span>{loading ? "Saving..." : status === "published" ? "Publish Post" : "Save Post"}</span>
          </button>
        </div>
      </header>

      {message ? <div className="vh-admin-alert"><p>{message}</p></div> : null}
      {error ? <div className="vh-admin-alert vh-admin-alert--error"><p>{error}</p></div> : null}

      <div className="vh-admin-create-collection__layout">
        <main className="vh-admin-create-collection__main">
          <section className="vh-admin-form-card">
            <div className="vh-admin-form-card__header">
              <h2>Post Information</h2>
              <p>Create engaging content to share with your audience.</p>
            </div>

            <div className="vh-admin-form-grid">
              <label className="vh-admin-form-field">
                <span>Post Title <b>*</b></span>
                <input value={title} onChange={(event) => updateTitle(event.target.value)} placeholder="Enter an engaging title for your post" required />
              </label>

              <label className="vh-admin-form-field">
                <span>Slug <b>*</b></span>
                <input value={slug} onChange={(event) => setSlug(slugify(event.target.value))} placeholder="Enter post slug" required />
                <small>URL preview: {previewUrl}</small>
              </label>
            </div>

            <label className="vh-admin-form-field">
              <span>Excerpt <em>(Optional)</em></span>
              <textarea value={excerpt} onChange={(event) => setExcerpt(event.target.value)} placeholder="Write a short summary of your post..." />
              <small>A brief description that appears in blog listings and previews.</small>
            </label>

            <div className="vh-admin-form-field">
              <span>Featured Image</span>
              <div className="vh-admin-upload-panel vh-admin-blog-upload-panel">
                {imagePreview ? <img src={imagePreview} alt="" /> : <UploadCloud size={34} strokeWidth={1.7} aria-hidden="true" />}
                <strong>Upload featured image</strong>
                <small>PNG, JPG or WEBP. Recommended size: 1200x630px.</small>
                <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => void updateImage(event)} />
                <button type="button" className="vh-admin-action-button" onClick={() => fileInputRef.current?.click()} disabled={loading || uploading}>
                  {uploading ? "Uploading..." : "Choose Image"}
                </button>
              </div>
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
                <textarea value={content} onChange={(event) => setContent(event.target.value)} placeholder="Write your blog post content here..." required />
              </div>
              <small>Share valuable insights, tips, stories and more with your audience.</small>
            </label>
          </section>

          <section className="vh-admin-form-card">
            <div className="vh-admin-form-card__header">
              <h2>SEO Settings</h2>
              <p>Optimize your post for search engines.</p>
            </div>
            <div className="vh-admin-form-grid">
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
              <h2>Post Status</h2>
              <p>Choose the current status of your post.</p>
            </div>

            <label className="vh-admin-form-field">
              <span>Status <b>*</b></span>
              <select value={status} onChange={(event) => setStatus(event.target.value as BlogPostStatus)}>
                <option value="published">Published</option>
                <option value="draft">Draft</option>
                <option value="archived">Archived</option>
              </select>
              <small>{status === "published" ? "Published posts are visible when public." : "Unpublished posts stay out of the public editorial feed."}</small>
            </label>

            <fieldset className="vh-admin-radio-stack">
              <legend>Visibility</legend>
              <label>
                <input type="radio" name="visibility" checked={visibility === "public"} onChange={() => setVisibility("public")} />
                <span>
                  <strong><Eye size={15} aria-hidden="true" /> Public</strong>
                  <small>Visible to everyone.</small>
                </span>
              </label>
              <label>
                <input type="radio" name="visibility" checked={visibility === "private"} onChange={() => setVisibility("private")} />
                <span>
                  <strong><Lock size={15} aria-hidden="true" /> Private</strong>
                  <small>Only admins can view this post.</small>
                </span>
              </label>
              <label>
                <input type="radio" name="visibility" checked={visibility === "password"} onChange={() => setVisibility("password")} />
                <span>
                  <strong><Lock size={15} aria-hidden="true" /> Password Protected</strong>
                  <small>Saved as protected content until password handling is connected.</small>
                </span>
              </label>
            </fieldset>
          </section>

          <section className="vh-admin-form-card">
            <div className="vh-admin-form-card__header">
              <h2>Post Categories</h2>
              <p>Organize your post with relevant categories.</p>
            </div>
            <label className="vh-admin-form-field">
              <span>Categories</span>
              <select value="" onChange={(event) => addCategory(event.target.value)}>
                <option value="">Select categories</option>
                {categoryOptions.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </label>
            <div className="vh-admin-tag-editor">
              {categories.length ? (
                <div className="vh-admin-tag-list">
                  {categories.map((category) => (
                    <button key={category} type="button" onClick={() => setCategories((currentCategories) => currentCategories.filter((item) => item !== category))}>
                      <span>{category}</span>
                      <X size={13} aria-hidden="true" />
                    </button>
                  ))}
                </div>
              ) : null}
              <input
                value={categoryInput}
                onChange={(event) => setCategoryInput(event.target.value)}
                onBlur={() => addCategory(categoryInput)}
                onKeyDown={handleCategoryKeyDown}
                placeholder="Add category..."
              />
            </div>
            <small className="vh-admin-form-help">Press Enter to add a category.</small>
          </section>

          <section className="vh-admin-form-card">
            <div className="vh-admin-form-card__header">
              <h2>Post Tags</h2>
              <p>Add tags to help users find your post.</p>
            </div>
            <label className="vh-admin-form-field">
              <span>Tags</span>
              <div className="vh-admin-tag-editor">
                {tags.length ? (
                  <div className="vh-admin-tag-list">
                    {tags.map((tagValue) => (
                      <button key={tagValue} type="button" onClick={() => setTags((currentTags) => currentTags.filter((item) => item !== tagValue))}>
                        <span>{tagValue}</span>
                        <X size={13} aria-hidden="true" />
                      </button>
                    ))}
                  </div>
                ) : null}
                <input value={tagInput} onChange={(event) => setTagInput(event.target.value)} onKeyDown={handleTagKeyDown} placeholder="Add tags..." />
              </div>
              <small>Press Enter to add tags.</small>
            </label>
            {tagSuggestions.length ? (
              <div className="vh-admin-blog-suggestions" aria-label="Tag suggestions">
                <Tag size={14} aria-hidden="true" />
                {tagSuggestions.map((tagValue) => (
                  <button key={tagValue} type="button" onClick={() => addTag(tagValue)}>{tagValue}</button>
                ))}
              </div>
            ) : null}
          </section>

          <section className="vh-admin-form-card">
            <div className="vh-admin-form-card__header">
              <h2>Publishing Options</h2>
              <p>Schedule or set publishing preferences.</p>
            </div>
            <label className="vh-admin-form-field">
              <span>Publish Date</span>
              <span className="vh-admin-input-icon">
                <CalendarDays size={16} aria-hidden="true" />
                <input type="datetime-local" value={publishDate} onChange={(event) => setPublishDate(event.target.value)} />
              </span>
            </label>
            <label className="vh-admin-form-field">
              <span>Author</span>
              <select value={authorName} onChange={(event) => setAuthorName(event.target.value)}>
                {options.authors.map((author) => <option key={author} value={author}>{author}</option>)}
              </select>
            </label>
          </section>
        </aside>
      </div>
    </form>
  );
}
