export type StorefrontBagItem = {
  itemKey: string;
  productId: string;
  quantity: number;
  size: string;
};

const WISHLIST_STORAGE_KEY = "vionehernal_storefront_wishlist";
const BAG_STORAGE_KEY = "vionehernal_storefront_bag";
const STOREFRONT_STATE_EVENT = "vionehernal-storefront-state";

function canUseStorage() {
  return typeof window !== "undefined";
}

function dispatchStorefrontStateEvent() {
  if (!canUseStorage()) {
    return;
  }

  window.dispatchEvent(new Event(STOREFRONT_STATE_EVENT));
}

function readJson<T>(storageKey: string, fallback: T) {
  if (!canUseStorage()) {
    return fallback;
  }

  try {
    const raw = window.localStorage.getItem(storageKey);

    if (!raw) {
      return fallback;
    }

    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function normalizeQuantity(quantity: number) {
  return Math.max(1, Math.floor(Number.isFinite(quantity) ? quantity : 1));
}

export function getStorefrontBagItemKey(productId: string, size: string) {
  return `${productId}::${size}`;
}

export function readWishlistProductIds() {
  const parsed = readJson<unknown>(WISHLIST_STORAGE_KEY, []);

  return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === "string") : [];
}

export function writeWishlistProductIds(productIds: string[]) {
  if (!canUseStorage()) {
    return;
  }

  window.localStorage.setItem(WISHLIST_STORAGE_KEY, JSON.stringify([...new Set(productIds)]));
  dispatchStorefrontStateEvent();
}

export function toggleWishlistProduct(productId: string) {
  const currentIds = readWishlistProductIds();
  const alreadySaved = currentIds.includes(productId);
  const nextIds = alreadySaved ? currentIds.filter((id) => id !== productId) : [...currentIds, productId];

  writeWishlistProductIds(nextIds);

  return !alreadySaved;
}

export function readBagItems() {
  const parsed = readJson<unknown>(BAG_STORAGE_KEY, []);

  if (!Array.isArray(parsed)) {
    return [] as StorefrontBagItem[];
  }

  return parsed
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }

      const candidate = item as Partial<StorefrontBagItem>;
      const productId = typeof candidate.productId === "string" ? candidate.productId : "";
      const size = typeof candidate.size === "string" ? candidate.size : "One Size";
      const quantity = normalizeQuantity(Number(candidate.quantity ?? 1));

      if (!productId) {
        return null;
      }

      return {
        itemKey: getStorefrontBagItemKey(productId, size),
        productId,
        quantity,
        size,
      } satisfies StorefrontBagItem;
    })
    .filter((item): item is StorefrontBagItem => Boolean(item));
}

export function writeBagItems(items: StorefrontBagItem[]) {
  if (!canUseStorage()) {
    return;
  }

  window.localStorage.setItem(
    BAG_STORAGE_KEY,
    JSON.stringify(
      items.map((item) => ({
        itemKey: item.itemKey,
        productId: item.productId,
        quantity: normalizeQuantity(item.quantity),
        size: item.size,
      })),
    ),
  );
  dispatchStorefrontStateEvent();
}

export function addBagItem(params: { productId: string; quantity: number; size: string }) {
  const quantity = normalizeQuantity(params.quantity);
  const itemKey = getStorefrontBagItemKey(params.productId, params.size);
  const currentItems = readBagItems();
  const existingItem = currentItems.find((item) => item.itemKey === itemKey);
  const nextItems = existingItem
    ? currentItems.map((item) =>
        item.itemKey === itemKey ? { ...item, quantity: normalizeQuantity(item.quantity + quantity) } : item,
      )
    : [...currentItems, { itemKey, productId: params.productId, quantity, size: params.size }];

  writeBagItems(nextItems);

  return nextItems;
}

export function updateBagItemQuantity(itemKey: string, quantity: number) {
  const nextItems = readBagItems().map((item) =>
    item.itemKey === itemKey ? { ...item, quantity: normalizeQuantity(quantity) } : item,
  );

  writeBagItems(nextItems);

  return nextItems;
}

export function removeBagItem(itemKey: string) {
  const nextItems = readBagItems().filter((item) => item.itemKey !== itemKey);

  writeBagItems(nextItems);

  return nextItems;
}

export function getWishlistCount() {
  return readWishlistProductIds().length;
}

export function getBagCount() {
  return readBagItems().reduce((count, item) => count + item.quantity, 0);
}

export function subscribeToStorefrontState(callback: () => void) {
  if (!canUseStorage()) {
    return () => undefined;
  }

  const handleStorageUpdate = () => callback();

  window.addEventListener(STOREFRONT_STATE_EVENT, handleStorageUpdate);
  window.addEventListener("storage", handleStorageUpdate);

  return () => {
    window.removeEventListener(STOREFRONT_STATE_EVENT, handleStorageUpdate);
    window.removeEventListener("storage", handleStorageUpdate);
  };
}
