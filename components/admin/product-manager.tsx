"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { startTransition, useState, type ChangeEvent } from "react";

import {
  CATALOG_MENS_DEPARTMENT,
  CATALOG_UNISEX_DEPARTMENT,
  CATALOG_WOMENS_DEPARTMENT,
  getCatalogPriceLabel,
  getCatalogProductPageHref,
  type CatalogProduct,
} from "@/lib/catalog";
import { getErrorMessage, getResponseErrorMessage, readJsonSafely } from "@/lib/http";
import { CATALOG_REFRESH_STORAGE_KEY } from "@/lib/storefront/catalog-refresh";

type Props = {
  initialProducts: CatalogProduct[];
  collectionOptions?: string[];
};

type ProductFormState = {
  id: string;
  name: string;
  brand: string;
  pricePhp: string;
  description: string;
  department: string;
  categoryLabel: string;
  mainImageUrl: string;
  hoverImageUrl: string;
  galleryImageUrls: string[];
  sizeInventoryRows: Array<{ size: string; stock: string }>;
  status: "draft" | "published";
  showInNewArrivals: boolean;
  showInFeatured: boolean;
};

const PRODUCT_DEPARTMENT_OPTIONS = [CATALOG_WOMENS_DEPARTMENT, CATALOG_MENS_DEPARTMENT, CATALOG_UNISEX_DEPARTMENT];
const PRODUCT_CATEGORY_OPTIONS = ["Ready to Wear", "Tops", "Shoes", "Bags", "Accessories"];
const PRODUCT_DEPLOYMENT_OPTIONS = [
  { label: "Women", value: CATALOG_WOMENS_DEPARTMENT },
  { label: "Men", value: CATALOG_MENS_DEPARTMENT },
  { label: "Both", value: CATALOG_UNISEX_DEPARTMENT },
];

function uniqueOptions(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean))).sort((first, second) => first.localeCompare(second));
}

function formatPhpInputFromCents(value: number) {
  return (value / 100).toFixed(2);
}

function parsePhpInputToCents(value: string) {
  const normalizedValue = value.trim().replace(/,/g, "");
  const parsedValue = Number(normalizedValue);

  if (!Number.isFinite(parsedValue)) {
    return 0;
  }

  return Math.max(0, Math.round(parsedValue * 100));
}

function createDraftUploadKey() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `draft-${crypto.randomUUID()}`;
  }

  return `draft-${Date.now()}`;
}

function createEmptyFormState(): ProductFormState {
  return {
    id: "",
    name: "",
    brand: "VIONE HERNAL",
    pricePhp: "",
    description: "",
    department: "Womens",
    categoryLabel: "",
    mainImageUrl: "",
    hoverImageUrl: "",
    galleryImageUrls: [],
    sizeInventoryRows: [{ size: "One Size", stock: "0" }],
    status: "draft",
    showInNewArrivals: false,
    showInFeatured: false,
  };
}

function createFormStateFromProduct(product: CatalogProduct): ProductFormState {
  return {
    id: product.id,
    name: product.name,
    brand: product.brand,
    pricePhp: formatPhpInputFromCents(product.pricePhpCents),
    description: product.description,
    department: product.department,
    categoryLabel: product.categoryLabel,
    mainImageUrl: product.image,
    hoverImageUrl: product.hoverImage,
    galleryImageUrls: product.galleryImages,
    sizeInventoryRows: product.sizes.map((size) => ({
      size,
      stock: String(product.sizeInventory[size] ?? 0),
    })),
    status: product.status,
    showInNewArrivals: product.showInNewArrivals,
    showInFeatured: product.showInFeatured,
  };
}

function getProductDeploymentLabel(department: string) {
  return PRODUCT_DEPLOYMENT_OPTIONS.find((option) => option.value === department)?.label || department;
}

function buildSizeInventoryFromFormRows(rows: ProductFormState["sizeInventoryRows"]) {
  return rows.reduce<Record<string, number>>((inventory, row) => {
    const size = row.size.trim();
    const stock = Number(row.stock.trim() || "0");

    if (size) {
      inventory[size] = Math.max(0, Math.floor(Number.isFinite(stock) ? stock : 0));
    }

    return inventory;
  }, {});
}

function createCatalogProductFromForm(form: ProductFormState, currentProduct: CatalogProduct | null): CatalogProduct {
  const sizeInventory = buildSizeInventoryFromFormRows(form.sizeInventoryRows);
  const sizes = Object.keys(sizeInventory);
  const now = new Date().toISOString();

  return {
    id: form.id.trim(),
    name: form.name.trim(),
    brand: form.brand.trim(),
    description: form.description.trim(),
    pricePhpCents: parsePhpInputToCents(form.pricePhp),
    image: form.mainImageUrl.trim(),
    hoverImage: form.hoverImageUrl.trim() || form.mainImageUrl.trim(),
    categoryLabel: form.categoryLabel.trim(),
    department: form.department.trim(),
    sizes: sizes.length ? sizes : ["One Size"],
    sizeInventory: sizes.length ? sizeInventory : { "One Size": 0 },
    galleryImages: form.galleryImageUrls.map((url) => url.trim()).filter(Boolean),
    status: form.status,
    showInFeatured: form.showInFeatured,
    showInNewArrivals: form.showInNewArrivals,
    publishedAt: form.status === "published" ? currentProduct?.publishedAt || now : null,
    createdAt: currentProduct?.createdAt || now,
    updatedAt: now,
  };
}

function notifyCatalogProductsUpdated() {
  if (typeof window === "undefined") {
    return;
  }

  const timestamp = String(Date.now());

  try {
    window.localStorage.setItem(CATALOG_REFRESH_STORAGE_KEY, timestamp);
  } catch {
    // The custom event still updates the current tab if storage is unavailable.
  }

  if ("BroadcastChannel" in window) {
    const channel = new BroadcastChannel(CATALOG_REFRESH_STORAGE_KEY);
    channel.postMessage(timestamp);
    channel.close();
  }

  window.dispatchEvent(new Event(CATALOG_REFRESH_STORAGE_KEY));
}

function buildProductPayload(form: ProductFormState) {
  return {
    id: form.id.trim(),
    name: form.name.trim(),
    brand: form.brand.trim(),
    pricePhpCents: parsePhpInputToCents(form.pricePhp),
    description: form.description.trim(),
    department: form.department.trim(),
    categoryLabel: form.categoryLabel.trim(),
    mainImageUrl: form.mainImageUrl.trim(),
    hoverImageUrl: form.hoverImageUrl.trim() || null,
    galleryImageUrls: form.galleryImageUrls.map((url) => url.trim()).filter(Boolean),
    sizeInventoryRows: form.sizeInventoryRows.map((row) => ({
      size: row.size.trim(),
      stock: row.stock.trim() || "0",
    })),
    status: form.status,
    showInNewArrivals: form.showInNewArrivals,
    showInFeatured: form.showInFeatured,
  };
}

export function ProductManager({ initialProducts, collectionOptions = [] }: Props) {
  const router = useRouter();
  const [products, setProducts] = useState(initialProducts);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [form, setForm] = useState<ProductFormState>(createEmptyFormState());
  const [loading, setLoading] = useState(false);
  const [uploadingSlot, setUploadingSlot] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [draftUploadKey, setDraftUploadKey] = useState(createDraftUploadKey);
  const selectedProduct = products.find((product) => product.id === selectedProductId) ?? null;
  const isEditingExisting = Boolean(selectedProductId);
  const uploadTargetId = form.id.trim() || draftUploadKey;
  const previewImage = form.mainImageUrl.trim() || selectedProduct?.image || "";
  const previewHoverImage = form.hoverImageUrl.trim() || form.mainImageUrl.trim() || selectedProduct?.hoverImage || "";
  const previewPriceLabel = getCatalogPriceLabel(parsePhpInputToCents(form.pricePhp));
  const productCollectionOptions = uniqueOptions([
    ...collectionOptions,
    ...products.map((product) => product.categoryLabel),
    ...PRODUCT_CATEGORY_OPTIONS,
  ]);
  const productSections = PRODUCT_DEPLOYMENT_OPTIONS.map((option) => ({
    ...option,
    products: products.filter((product) => product.department === option.value),
  }));

  async function refreshProducts(nextSelectedProductId: string | null) {
    const response = await fetch("/api/admin/products", {
      cache: "no-store",
    });
    const payload = await readJsonSafely<{ error?: string; products?: CatalogProduct[] }>(response);

    if (!response.ok || !payload?.products) {
      throw new Error(getResponseErrorMessage(payload, "Unable to refresh the products."));
    }

    setProducts(payload.products);

    if (nextSelectedProductId) {
      const matchedProduct = payload.products.find((product) => product.id === nextSelectedProductId) ?? null;

      if (matchedProduct) {
        setSelectedProductId(matchedProduct.id);
        setForm(createFormStateFromProduct(matchedProduct));
        return;
      }
    }

    if (!payload.products.length) {
      setSelectedProductId(null);
      setForm(createEmptyFormState());
      setDraftUploadKey(createDraftUploadKey());
      return;
    }

    setSelectedProductId(null);
    setForm(createEmptyFormState());
    setDraftUploadKey(createDraftUploadKey());
  }

  function resetToNewProduct() {
    setSelectedProductId(null);
    setForm(createEmptyFormState());
    setDraftUploadKey(createDraftUploadKey());
    setMessage("");
    setError("");
  }

  function selectExistingProduct(product: CatalogProduct) {
    setSelectedProductId(product.id);
    setForm(createFormStateFromProduct(product));
    setDraftUploadKey(product.id);
    setMessage("");
    setError("");
  }

  function updateSizeInventoryRow(index: number, field: "size" | "stock", value: string) {
    setForm((currentForm) => ({
      ...currentForm,
      sizeInventoryRows: currentForm.sizeInventoryRows.map((row, rowIndex) =>
        rowIndex === index ? { ...row, [field]: value } : row,
      ),
    }));
  }

  function removeSizeInventoryRow(index: number) {
    setForm((currentForm) => ({
      ...currentForm,
      sizeInventoryRows:
        currentForm.sizeInventoryRows.length > 1
          ? currentForm.sizeInventoryRows.filter((_, rowIndex) => rowIndex !== index)
          : currentForm.sizeInventoryRows,
    }));
  }

  async function uploadImages(slot: "main" | "hover" | "gallery", event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";

    if (!files.length) {
      return;
    }

    setUploadingSlot(slot);
    setError("");
    setMessage("");

    try {
      const uploadedUrls: string[] = [];

      for (const [index, file] of files.entries()) {
        const formData = new FormData();
        formData.set("file", file);
        formData.set("productId", uploadTargetId);
        formData.set("slot", slot === "gallery" ? `gallery-${index + 1}` : slot);

        const response = await fetch("/api/admin/products/upload", {
          method: "POST",
          body: formData,
        });
        const payload = await readJsonSafely<{ error?: string; url?: string }>(response);

        if (!response.ok || !payload?.url) {
          throw new Error(getResponseErrorMessage(payload, "Unable to upload the selected image."));
        }

        uploadedUrls.push(payload.url);
      }

      setForm((currentForm) => {
        if (slot === "main") {
          return {
            ...currentForm,
            mainImageUrl: uploadedUrls[0] || currentForm.mainImageUrl,
          };
        }

        if (slot === "hover") {
          return {
            ...currentForm,
            hoverImageUrl: uploadedUrls[0] || currentForm.hoverImageUrl,
          };
        }

        return {
          ...currentForm,
          galleryImageUrls: [...currentForm.galleryImageUrls, ...uploadedUrls].slice(0, 10),
        };
      });

      setMessage(slot === "gallery" ? "Gallery image uploaded." : "Image uploaded.");
    } catch (uploadError) {
      setError(getErrorMessage(uploadError, "Unable to upload the selected image."));
    } finally {
      setUploadingSlot("");
    }
  }

  async function handleSave() {
    setLoading(true);
    setMessage("");
    setError("");

    try {
      const response = await fetch("/api/admin/products", {
        method: isEditingExisting ? "PATCH" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(buildProductPayload(form)),
      });
      const payload = await readJsonSafely<{ error?: string }>(response);

      if (!response.ok) {
        throw new Error(getResponseErrorMessage(payload, "Unable to save the product."));
      }

      const savedProduct = createCatalogProductFromForm(form, selectedProduct);

      setProducts((currentProducts) => {
        const existingProductIndex = currentProducts.findIndex((product) => product.id === savedProduct.id);

        if (existingProductIndex < 0) {
          return [savedProduct, ...currentProducts];
        }

        return currentProducts.map((product, productIndex) => (productIndex === existingProductIndex ? savedProduct : product));
      });
      setSelectedProductId(savedProduct.id);
      setForm(createFormStateFromProduct(savedProduct));
      setDraftUploadKey(savedProduct.id);
      setMessage(isEditingExisting ? "Product updated." : "Product created.");
      notifyCatalogProductsUpdated();
      void refreshProducts(savedProduct.id).catch(() => undefined);
      startTransition(() => {
        router.refresh();
      });
    } catch (saveError) {
      setError(getErrorMessage(saveError, "Unable to save the product."));
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteProduct() {
    if (!selectedProductId) {
      return;
    }

    const confirmed = window.confirm(`Remove product ${selectedProductId}? This will remove it from the storefront.`);

    if (!confirmed) {
      return;
    }

    setLoading(true);
    setMessage("");
    setError("");

    try {
      const response = await fetch("/api/admin/products", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ productId: selectedProductId }),
      });
      const payload = await readJsonSafely<{ error?: string }>(response);

      if (!response.ok) {
        throw new Error(getResponseErrorMessage(payload, "Unable to remove the product."));
      }

      await refreshProducts(null);
      setMessage("Product removed.");
      startTransition(() => {
        router.refresh();
      });
    } catch (deleteError) {
      setError(getErrorMessage(deleteError, "Unable to remove the product."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="vh-product-manager-layout" style={{ marginTop: "2rem" }}>
      <section className="vh-data-card">
        <div className="vh-field__row" style={{ marginBottom: "1rem" }}>
          <div>
            <p className="vh-mvp-eyebrow">Product Form</p>
            <h2 className="h3 u-margin-b--none">{isEditingExisting ? "Edit Product" : "Create Product"}</h2>
          </div>
          <div className="vh-actions" style={{ marginTop: 0 }}>
            {isEditingExisting ? (
              <button
                type="button"
                className="vh-button vh-button--ghost"
                onClick={() => void handleDeleteProduct()}
                disabled={loading || Boolean(uploadingSlot)}
              >
                Remove Product
              </button>
            ) : null}
            <button type="button" className="vh-button vh-button--ghost" onClick={resetToNewProduct} disabled={loading || Boolean(uploadingSlot)}>
              New Product
            </button>
          </div>
        </div>

        <div className="vh-field">
          <p className="vh-field__label">Product Info</p>
        </div>

        <div className="vh-field">
          <label htmlFor="product-sku">Product Code / SKU</label>
          <input
            id="product-sku"
            className="vh-input"
            value={form.id}
            onChange={(event) => setForm((currentForm) => ({ ...currentForm, id: event.target.value }))}
            disabled={loading || Boolean(uploadingSlot) || isEditingExisting}
          />
        </div>

        <div className="vh-field">
          <label htmlFor="product-name">Product Name</label>
          <input
            id="product-name"
            className="vh-input"
            value={form.name}
            onChange={(event) => setForm((currentForm) => ({ ...currentForm, name: event.target.value }))}
            disabled={loading || Boolean(uploadingSlot)}
          />
        </div>

        <div className="vh-checkout-field-grid">
          <div className="vh-field">
            <label htmlFor="product-brand">Brand</label>
            <input
              id="product-brand"
              className="vh-input"
              value={form.brand}
              onChange={(event) => setForm((currentForm) => ({ ...currentForm, brand: event.target.value }))}
              disabled={loading || Boolean(uploadingSlot)}
            />
          </div>

          <div className="vh-field">
            <label htmlFor="product-price">Price (PHP)</label>
            <input
              id="product-price"
              className="vh-input"
              type="number"
              min="0"
              step="0.01"
              value={form.pricePhp}
              onChange={(event) => setForm((currentForm) => ({ ...currentForm, pricePhp: event.target.value }))}
              disabled={loading || Boolean(uploadingSlot)}
            />
          </div>
        </div>

        <div className="vh-checkout-field-grid">
          <div className="vh-field">
            <label htmlFor="product-department">Department</label>
            <select
              id="product-department"
              className="vh-input"
              value={form.department}
              onChange={(event) => setForm((currentForm) => ({ ...currentForm, department: event.target.value }))}
              disabled={loading || Boolean(uploadingSlot)}
            >
              {PRODUCT_DEPARTMENT_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {getProductDeploymentLabel(option)}
                </option>
              ))}
            </select>
          </div>

          <div className="vh-field">
            <label htmlFor="product-category">Collection</label>
            <select
              id="product-category"
              className="vh-input"
              value={form.categoryLabel}
              onChange={(event) => setForm((currentForm) => ({ ...currentForm, categoryLabel: event.target.value }))}
              disabled={loading || Boolean(uploadingSlot)}
            >
              <option value="" disabled>
                Choose collection
              </option>
              {productCollectionOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="vh-field">
          <label htmlFor="product-description">Description</label>
          <textarea
            id="product-description"
            className="vh-textarea"
            value={form.description}
            onChange={(event) => setForm((currentForm) => ({ ...currentForm, description: event.target.value }))}
            disabled={loading || Boolean(uploadingSlot)}
          />
        </div>

        <div className="vh-field" style={{ marginTop: "1.5rem" }}>
          <p className="vh-field__label">Media</p>
          <p className="u-margin-b--none" style={{ color: "#6c6c6c", fontSize: "0.82rem", lineHeight: 1.6 }}>
            Images upload directly to storage and attach themselves to the product form automatically for preview and publishing.
          </p>
        </div>

        <div className="vh-field">
          <div className="vh-field__row">
            <label htmlFor="product-main-image-upload">Main Image</label>
            <span className="vh-product-media-status">
              {form.mainImageUrl ? "Uploaded" : "Required"}
            </span>
          </div>
          <input
            id="product-main-image-upload"
            type="file"
            accept="image/*"
            onChange={(event) => void uploadImages("main", event)}
            disabled={loading || Boolean(uploadingSlot)}
          />
          {previewImage ? (
            <div className="vh-product-media-preview-row">
              <img className="vh-product-media-preview" src={previewImage} alt={form.name || "Main product preview"} />
              <div style={{ display: "grid", gap: "0.65rem" }}>
                <div className="vh-product-media-note">Main image saved and ready to publish.</div>
                <button
                  type="button"
                  className="vh-button vh-button--ghost"
                  onClick={() => setForm((currentForm) => ({ ...currentForm, mainImageUrl: "" }))}
                  disabled={loading || Boolean(uploadingSlot)}
                >
                  Remove Main Image
                </button>
              </div>
            </div>
          ) : (
            <div className="vh-product-media-note">Upload the main product image here.</div>
          )}
        </div>

        <div className="vh-field">
          <div className="vh-field__row">
            <label htmlFor="product-hover-image-upload">Hover Image</label>
            <span className="vh-product-media-status">{form.hoverImageUrl ? "Uploaded" : "Optional"}</span>
          </div>
          <input
            id="product-hover-image-upload"
            type="file"
            accept="image/*"
            onChange={(event) => void uploadImages("hover", event)}
            disabled={loading || Boolean(uploadingSlot)}
          />
          {form.hoverImageUrl ? (
            <div className="vh-product-media-preview-row">
              <img className="vh-product-media-preview" src={previewHoverImage} alt="" />
              <div style={{ display: "grid", gap: "0.65rem" }}>
                <div className="vh-product-media-note">Hover image saved and ready to publish.</div>
                <button
                  type="button"
                  className="vh-button vh-button--ghost"
                  onClick={() => setForm((currentForm) => ({ ...currentForm, hoverImageUrl: "" }))}
                  disabled={loading || Boolean(uploadingSlot)}
                >
                  Remove Hover Image
                </button>
              </div>
            </div>
          ) : (
            <div className="vh-product-media-note">Optional alternate image for product-card hover.</div>
          )}
        </div>

        <div className="vh-field">
          <div className="vh-field__row">
            <label htmlFor="product-gallery-upload">Gallery Images</label>
            <span className="vh-product-media-status">{form.galleryImageUrls.length}/10</span>
          </div>
          <input
            id="product-gallery-upload"
            type="file"
            accept="image/*"
            multiple
            onChange={(event) => void uploadImages("gallery", event)}
            disabled={loading || Boolean(uploadingSlot) || form.galleryImageUrls.length >= 10}
          />
          {form.galleryImageUrls.length ? (
            <div className="vh-product-gallery-grid">
              {form.galleryImageUrls.map((galleryImageUrl, index) => (
                <div key={`${galleryImageUrl}-${index}`} className="vh-product-gallery-item">
                  <img className="vh-product-gallery-thumb" src={galleryImageUrl} alt="" />
                  <button
                    type="button"
                    className="vh-button vh-button--ghost"
                    onClick={() =>
                      setForm((currentForm) => ({
                        ...currentForm,
                        galleryImageUrls: currentForm.galleryImageUrls.filter((_, galleryIndex) => galleryIndex !== index),
                      }))
                    }
                    disabled={loading || Boolean(uploadingSlot)}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="vh-product-media-note">Optional additional gallery images.</div>
          )}
        </div>

        <div className="vh-field" style={{ marginTop: "1.5rem" }}>
          <p className="vh-field__label">Sizes And Stock</p>
        </div>

        <div style={{ display: "grid", gap: "0.75rem" }}>
          {form.sizeInventoryRows.map((row, index) => (
            <div key={`${index}-${row.size}`} className="vh-checkout-field-grid">
              <div className="vh-field" style={{ marginBottom: 0 }}>
                <label htmlFor={`size-label-${index}`}>Size</label>
                <input
                  id={`size-label-${index}`}
                  className="vh-input"
                  value={row.size}
                  onChange={(event) => updateSizeInventoryRow(index, "size", event.target.value)}
                  disabled={loading || Boolean(uploadingSlot)}
                />
              </div>

              <div className="vh-field" style={{ marginBottom: 0 }}>
                <div className="vh-field__row">
                  <label htmlFor={`size-stock-${index}`}>Stock</label>
                  <button
                    type="button"
                    className="vh-password-toggle"
                    onClick={() => removeSizeInventoryRow(index)}
                    disabled={loading || Boolean(uploadingSlot) || form.sizeInventoryRows.length === 1}
                  >
                    Remove
                  </button>
                </div>
                <input
                  id={`size-stock-${index}`}
                  className="vh-input"
                  type="number"
                  min="0"
                  step="1"
                  value={row.stock}
                  onChange={(event) => updateSizeInventoryRow(index, "stock", event.target.value)}
                  disabled={loading || Boolean(uploadingSlot)}
                />
              </div>
            </div>
          ))}
        </div>

        <div className="vh-actions">
          <button
            type="button"
            className="vh-button vh-button--ghost"
            onClick={() =>
              setForm((currentForm) => ({
                ...currentForm,
                sizeInventoryRows: [...currentForm.sizeInventoryRows, { size: "", stock: "0" }],
              }))
            }
            disabled={loading || Boolean(uploadingSlot)}
          >
            Add Size
          </button>
        </div>

        <div className="vh-field" style={{ marginTop: "1.5rem" }}>
          <p className="vh-field__label">Visibility</p>
        </div>

        <div className="vh-field">
          <label htmlFor="product-status">Status</label>
          <select
            id="product-status"
            className="vh-input"
            value={form.status}
            onChange={(event) =>
              setForm((currentForm) => ({
                ...currentForm,
                status: event.target.value === "published" ? "published" : "draft",
              }))
            }
            disabled={loading || Boolean(uploadingSlot)}
          >
            <option value="draft">Draft</option>
            <option value="published">Published</option>
          </select>
        </div>

        <label className="vh-field" style={{ gridTemplateColumns: "auto 1fr", alignItems: "center", gap: "0.75rem" }}>
          <input
            type="checkbox"
            checked={form.showInNewArrivals}
            onChange={(event) => setForm((currentForm) => ({ ...currentForm, showInNewArrivals: event.target.checked }))}
            disabled={loading || Boolean(uploadingSlot)}
          />
          <span>Show in New Arrivals</span>
        </label>

        <label className="vh-field" style={{ gridTemplateColumns: "auto 1fr", alignItems: "center", gap: "0.75rem" }}>
          <input
            type="checkbox"
            checked={form.showInFeatured}
            onChange={(event) => setForm((currentForm) => ({ ...currentForm, showInFeatured: event.target.checked }))}
            disabled={loading || Boolean(uploadingSlot)}
          />
          <span>Show in Featured Items</span>
        </label>

        <div className="vh-field">
          <label htmlFor="product-deployment">Deploy To</label>
          <select
            id="product-deployment"
            className="vh-input"
            value={form.department}
            onChange={(event) => setForm((currentForm) => ({ ...currentForm, department: event.target.value }))}
            disabled={loading || Boolean(uploadingSlot)}
          >
            {PRODUCT_DEPLOYMENT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {uploadingSlot ? <div className="vh-status">Uploading {uploadingSlot} image...</div> : null}
        {error ? <div className="vh-status vh-status--error">{error}</div> : null}
        {message ? <div className="vh-status vh-status--success">{message}</div> : null}

        <div className="vh-actions">
          <button type="button" className="vh-button" onClick={() => void handleSave()} disabled={loading || Boolean(uploadingSlot)}>
            {loading ? "Saving..." : form.status === "published" ? "Save And Publish" : "Save Draft"}
          </button>
        </div>
      </section>

      <div className="vh-product-manager-sidebar">
        <section className="vh-data-card">
          <p className="vh-mvp-eyebrow">Live Preview</p>
          <div className="vh-editorial-summary">
            <div className="vh-editorial-summary__media">
              {previewImage ? (
                <img src={previewImage} alt={form.name || "Product preview"} />
              ) : (
                <div
                  style={{
                    aspectRatio: "3 / 4",
                    background: "#f6f3ef",
                    display: "grid",
                    placeItems: "center",
                    color: "#6c6c6c",
                    padding: "1rem",
                    textAlign: "center",
                  }}
                >
                  Main image preview
                </div>
              )}
            </div>
            <div className="vh-editorial-summary__copy">
              <p className="vh-product-option__brand">{form.brand || "Brand"}</p>
              <h2 className="vh-editorial-summary__title">{form.name || "Product name"}</h2>
              <p className="vh-editorial-summary__description">{form.description || "Product description preview."}</p>
              <p className="vh-editorial-summary__price">{previewPriceLabel}</p>
              <p className="u-margin-b--none" style={{ color: "#6c6c6c" }}>
                {getProductDeploymentLabel(form.department) || "Department"} · {form.categoryLabel || "Collection"} · {form.status}
              </p>
              <p className="u-margin-b--none" style={{ color: "#6c6c6c" }}>
                Featured: {form.showInFeatured ? "Yes" : "No"} · New Arrivals: {form.showInNewArrivals ? "Yes" : "No"}
              </p>
              {form.id.trim() ? (
                <div className="vh-actions">
                  <Link className="vh-button vh-button--ghost" href={getCatalogProductPageHref(form.id.trim())} target="_blank">
                    Open Product Route
                  </Link>
                </div>
              ) : null}
            </div>
          </div>

          {previewHoverImage && previewHoverImage !== previewImage ? (
            <div style={{ marginTop: "1rem" }}>
              <p className="vh-field__label" style={{ marginBottom: "0.75rem" }}>
                Hover Preview
              </p>
              <img src={previewHoverImage} alt="" style={{ width: "160px", height: "214px", objectFit: "cover", background: "#f6f3ef" }} />
            </div>
          ) : null}
        </section>

        <section className="vh-data-card">
          <div className="vh-field__row" style={{ marginBottom: "1rem" }}>
            <div>
              <p className="vh-mvp-eyebrow">Existing Products</p>
              <h2 className="h3 u-margin-b--none">Select To Edit</h2>
            </div>
            <div className="vh-product-picker-header-actions">
              <Link className="vh-product-picker-catalog-link" href="/admin/products/catalog">
                View Catalog
              </Link>
              <span style={{ color: "#6c6c6c", fontSize: "0.8rem" }}>{products.length} total</span>
            </div>
          </div>

          <div className="vh-product-picker vh-product-picker--scroll">
            {products.length ? (
              productSections.map((section) => (
                <div key={section.value} className="vh-product-picker__section" style={{ display: "grid", gap: "0.75rem" }}>
                  <div className="vh-field__row" style={{ marginBottom: "0.65rem" }}>
                    <p className="vh-field__label" style={{ marginBottom: 0 }}>{section.label}</p>
                    <span style={{ color: "#6c6c6c", fontSize: "0.78rem" }}>{section.products.length} total</span>
                  </div>
                  {section.products.length ? (
                    section.products.map((product) => (
                      <button
                        key={product.id}
                        type="button"
                        className={`vh-product-option ${selectedProductId === product.id ? "vh-product-option--selected" : ""}`}
                        onClick={() => selectExistingProduct(product)}
                        disabled={loading || Boolean(uploadingSlot)}
                      >
                        <span
                          aria-hidden="true"
                          style={{
                            width: "16px",
                            height: "16px",
                            borderRadius: "999px",
                            border: "1px solid #111114",
                            background: selectedProductId === product.id ? "#111114" : "#fff",
                            display: "inline-block",
                          }}
                        />
                        <img className="vh-product-option__image" src={product.image} alt={product.name} />
                        <span className="vh-product-option__copy">
                          <span className="vh-product-option__brand">{product.brand}</span>
                          <span className="vh-product-option__name">{product.name}</span>
                          <span className="vh-product-option__price">{getCatalogPriceLabel(product.pricePhpCents)}</span>
                          <span style={{ color: "#6c6c6c", fontSize: "0.78rem" }}>
                            {product.id} · {product.status}
                            {product.showInFeatured ? " · Featured" : ""}
                            {product.showInNewArrivals ? " · New" : ""}
                          </span>
                        </span>
                      </button>
                    ))
                  ) : (
                    <div className="vh-empty">No {section.label.toLowerCase()} products created yet.</div>
                  )}
                </div>
              ))
            ) : (
              <div className="vh-empty">No products created yet.</div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
