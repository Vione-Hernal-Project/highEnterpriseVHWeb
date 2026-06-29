"use client";

import { Crosshair, Plus, Save, Trash2 } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState, type ReactNode } from "react";

import type { AdminBranchLocation, AdminGeneralSettings } from "@/lib/admin/settings";
import { getErrorMessage, getResponseErrorMessage, readJsonSafely } from "@/lib/http";
import { cn } from "@/lib/utils";
import { isPreciseGeocodeResult, useGeocodedAddress, type GeocodeResult } from "@/components/map/use-geocoded-address";
import { VhInteractiveMap, type VhMapMarker } from "@/components/map/vh-interactive-map";
import { AddressAutocomplete, type AddressSuggestion } from "@/components/map/address-autocomplete";

const DEFAULT_LOGO = "/assets/images/vh-logo-v2.jpg";
const PRIMARY_BRANCH_ID = "primary-store";

type Props = {
  initialSettings: AdminGeneralSettings;
};

type MapBranch = AdminBranchLocation & {
  lat: number | null;
  lng: number | null;
  addressLine: string;
};

function Field({
  label,
  value,
  onChange,
  type = "text",
  as = "input",
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  as?: "input" | "textarea" | "select";
  children?: ReactNode;
}) {
  return (
    <label className="vh-admin-form-field">
      <span>{label}</span>
      {as === "textarea" ? (
        <textarea value={value} onChange={(event) => onChange(event.target.value)} />
      ) : as === "select" ? (
        <select value={value} onChange={(event) => onChange(event.target.value)}>
          {children}
        </select>
      ) : (
        <input type={type} value={value} onChange={(event) => onChange(event.target.value)} />
      )}
    </label>
  );
}

export function AdminLocationSettingsSaveButton() {
  return (
    <button className="vh-admin-action-button vh-admin-action-button--primary" type="submit" form="vh-admin-location-settings-form">
      <Save size={16} strokeWidth={1.9} aria-hidden="true" />
      <span>Save Changes</span>
    </button>
  );
}

function numberFromCoordinate(value: string) {
  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : null;
}

function formatCoordinate(value: number) {
  return value.toFixed(6).replace(/\.?0+$/, "");
}

function composeAddress(branch: AdminBranchLocation) {
  return [branch.address, branch.city, branch.stateProvince, branch.postalCode, branch.country].filter(Boolean).join(", ");
}

function getPrimaryBranch(settings: AdminGeneralSettings): AdminBranchLocation {
  return {
    id: PRIMARY_BRANCH_ID,
    name: settings.storeName || "Vione Hernal",
    address: settings.storeAddress,
    country: settings.country,
    stateProvince: settings.stateProvince,
    city: settings.city,
    postalCode: settings.postalCode,
    latitude: settings.latitude,
    longitude: settings.longitude,
  };
}

function getAllBranches(settings: AdminGeneralSettings) {
  return [getPrimaryBranch(settings), ...settings.branches];
}

function getActiveBranch(settings: AdminGeneralSettings, branchId: string) {
  return getAllBranches(settings).find((branch) => branch.id === branchId) || getPrimaryBranch(settings);
}

function createBranchId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `branch-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function hasValidCoordinates(branch: AdminBranchLocation) {
  const lat = numberFromCoordinate(branch.latitude);
  const lng = numberFromCoordinate(branch.longitude);

  return lat !== null && lng !== null && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

function normalizeBranches(
  settings: AdminGeneralSettings,
  activeBranchId: string,
  geocodedLocation: { lat: number; lng: number; label: string } | null,
  options: { preferActiveAddressPreview: boolean; hasMappableActiveAddress: boolean; geocodedLocationIsPrecise: boolean },
) {
  const branches = getAllBranches(settings);

  return branches.map((branch) => {
    const addressLine = composeAddress(branch);
    const lat = numberFromCoordinate(branch.latitude);
    const lng = numberFromCoordinate(branch.longitude);
    const isActiveBranch = branch.id === activeBranchId;
    const activeAddressPreviewIsPending = isActiveBranch
      && options.preferActiveAddressPreview
      && (!geocodedLocation || !options.geocodedLocationIsPrecise);
    const shouldUseGeocode = Boolean(
      isActiveBranch
        && options.hasMappableActiveAddress
        && (options.preferActiveAddressPreview || !hasValidCoordinates(branch) || (!branch.latitude.trim() && !branch.longitude.trim()))
        && options.geocodedLocationIsPrecise
        && geocodedLocation,
    );
    const fallbackLocation = shouldUseGeocode ? geocodedLocation : null;

    return {
      ...branch,
      lat: activeAddressPreviewIsPending ? null : fallbackLocation ? fallbackLocation.lat : lat,
      lng: activeAddressPreviewIsPending ? null : fallbackLocation ? fallbackLocation.lng : lng,
      addressLine: addressLine || fallbackLocation?.label || "",
    };
  });
}

function applyBranchPatch(
  settings: AdminGeneralSettings,
  branchId: string,
  patch: Partial<AdminBranchLocation>,
): AdminGeneralSettings {
  if (branchId === PRIMARY_BRANCH_ID) {
    return {
      ...settings,
      storeName: patch.name ?? settings.storeName,
      storeAddress: patch.address ?? settings.storeAddress,
      country: patch.country ?? settings.country,
      stateProvince: patch.stateProvince ?? settings.stateProvince,
      city: patch.city ?? settings.city,
      postalCode: patch.postalCode ?? settings.postalCode,
      latitude: patch.latitude ?? settings.latitude,
      longitude: patch.longitude ?? settings.longitude,
    };
  }

  return {
    ...settings,
    branches: settings.branches.map((branch) => (branch.id === branchId ? { ...branch, ...patch, id: branch.id } : branch)),
  };
}

function mapMarkersFromBranches(branches: MapBranch[], logoUrl: string): VhMapMarker[] {
  return branches
    .filter((branch) => branch.lat !== null && branch.lng !== null)
    .map((branch) => ({
      id: branch.id,
      label: branch.name || "Vione Hernal branch",
      description: branch.addressLine,
      lat: branch.lat || 0,
      lng: branch.lng || 0,
      logoUrl: logoUrl || DEFAULT_LOGO,
    }));
}

export function AdminLocationSettings({ initialSettings }: Props) {
  const [settings, setSettings] = useState(initialSettings);
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [error, setError] = useState("");
  const [addressEditVersion, setAddressEditVersion] = useState(0);
  const [coordinateEditVersion, setCoordinateEditVersion] = useState(0);
  const [activeBranchId, setActiveBranchId] = useState(PRIMARY_BRANCH_ID);
  const [mapJumpTarget, setMapJumpTarget] = useState<{ lat: number; lng: number } | null>(null);
  const [geolocating, setGeolocating] = useState(false);
  const activeBranch = useMemo(() => getActiveBranch(settings, activeBranchId), [activeBranchId, settings]);
  const activeAddress = useMemo(
    () => composeAddress(activeBranch),
    [activeBranch.address, activeBranch.city, activeBranch.country, activeBranch.postalCode, activeBranch.stateProvince],
  );
  const hasActiveCoordinates = hasValidCoordinates(activeBranch);
  const activeStreetWordCount = activeBranch.address.trim().split(/\s+/).filter(Boolean).length;
  const activeAddressLooksSpecific = activeStreetWordCount >= 3 || /\d/.test(activeBranch.address);
  const hasMappableActiveAddress = Boolean(
    activeAddressLooksSpecific
      && activeBranch.address.trim()
      && activeBranch.country.trim()
      && (activeBranch.city.trim() || activeBranch.stateProvince.trim() || activeBranch.postalCode.trim()),
  );
  const preferActiveAddressPreview = addressEditVersion > coordinateEditVersion;
  const { result: geocodedLocation, loading: geocoding, status: geocodeStatus } = useGeocodedAddress(activeAddress, {
    debounceMs: 850,
    enabled: hasMappableActiveAddress && (!hasActiveCoordinates || preferActiveAddressPreview),
    structured: {
      street: activeBranch.address,
      city: activeBranch.city,
      province: activeBranch.stateProvince,
      postalCode: activeBranch.postalCode,
      country: activeBranch.country,
    },
  });
  const geocodedLocationIsPrecise = isPreciseGeocodeResult(geocodedLocation);
  const branches = useMemo(
    () =>
      normalizeBranches(settings, activeBranchId, geocodedLocation, {
        geocodedLocationIsPrecise,
        hasMappableActiveAddress,
        preferActiveAddressPreview,
      }),
    [activeBranchId, geocodedLocation, geocodedLocationIsPrecise, hasMappableActiveAddress, preferActiveAddressPreview, settings],
  );
  const activeBranchNeedsExactPin = Boolean(geocodedLocation && preferActiveAddressPreview && hasMappableActiveAddress && !geocodedLocationIsPrecise);
  const mapPreviewLocation = activeBranchNeedsExactPin ? { lat: geocodedLocation!.lat, lng: geocodedLocation!.lng } : undefined;
  const activeBranchLat = numberFromCoordinate(activeBranch.latitude);
  const activeBranchLng = numberFromCoordinate(activeBranch.longitude);
  const activePinLocation =
    activeBranchLat !== null && activeBranchLng !== null
      ? { lat: activeBranchLat, lng: activeBranchLng }
      : geocodedLocation
        ? { lat: geocodedLocation.lat, lng: geocodedLocation.lng }
        : null;
  const mapMarkers = useMemo(() => mapMarkersFromBranches(branches, settings.logoUrl), [branches, settings.logoUrl]);
  const mapEmptyTitle = geocoding
    ? "Locating branch address..."
    : activeBranchNeedsExactPin
      ? "Exact branch pin needed."
    : geocodeStatus === "not-found" || geocodeStatus === "error"
      ? "Branch address not found yet."
      : "No mapped branch coordinates.";
  const mapEmptyCopy = geocoding
    ? "Checking the branch location from the address fields."
    : activeBranchNeedsExactPin
      ? "The address only matched a general area. Right-click the exact branch location and choose Mark location."
    : geocodeStatus === "not-found" || geocodeStatus === "error"
      ? "Add latitude and longitude, or refine the full branch address."
      : "Add latitude and longitude, or enter a complete address to resolve this branch.";
  const mapHelpText = geocoding
    ? "Locating branch address..."
    : activeBranchNeedsExactPin
      ? "Approximate area found. Drag the map so the pin sits on the exact branch spot."
    : "Search an address or use your location, then drag the map so the pin sits exactly on the branch.";

  useEffect(() => {
    if (!branches.some((branch) => branch.id === activeBranchId)) {
      setActiveBranchId(PRIMARY_BRANCH_ID);
    }
  }, [activeBranchId, branches]);

  useEffect(() => {
    if (!geocodedLocation || !geocodedLocationIsPrecise || !preferActiveAddressPreview || !hasMappableActiveAddress) {
      return;
    }

    setSettings((current) =>
      applyBranchPatch(current, activeBranchId, {
        latitude: formatCoordinate(geocodedLocation.lat),
        longitude: formatCoordinate(geocodedLocation.lng),
      }),
    );
    setCoordinateEditVersion(Date.now());
    setStatus("idle");
  }, [activeBranchId, geocodedLocation, geocodedLocationIsPrecise, hasMappableActiveAddress, preferActiveAddressPreview]);

  // Recenter the map on the active branch's saved coordinates when switching branches.
  useEffect(() => {
    const branch = getActiveBranch(settings, activeBranchId);
    const lat = numberFromCoordinate(branch.latitude);
    const lng = numberFromCoordinate(branch.longitude);

    if (lat !== null && lng !== null) {
      setMapJumpTarget({ lat, lng });
    }
    // Only on branch switch; intentionally not depending on settings.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeBranchId]);

  // While the admin is typing the address, follow the geocoded area; once a pin
  // is placed (coordinates set) we stop, so dragging the pin is never reverted.
  useEffect(() => {
    if (preferActiveAddressPreview && geocodedLocation) {
      setMapJumpTarget({ lat: geocodedLocation.lat, lng: geocodedLocation.lng });
    }
  }, [preferActiveAddressPreview, geocodedLocation?.lat, geocodedLocation?.lng]);

  function applyBranchSuggestion(suggestion: AddressSuggestion) {
    const components = suggestion.components;

    setSettings((current) =>
      applyBranchPatch(current, activeBranchId, {
        address: components.addressLine1 || getActiveBranch(current, activeBranchId).address,
        city: components.city || getActiveBranch(current, activeBranchId).city,
        stateProvince: components.province || getActiveBranch(current, activeBranchId).stateProvince,
        postalCode: components.postalCode || getActiveBranch(current, activeBranchId).postalCode,
        country: components.country || getActiveBranch(current, activeBranchId).country,
        latitude: formatCoordinate(suggestion.lat),
        longitude: formatCoordinate(suggestion.lng),
      }),
    );
    setCoordinateEditVersion(Date.now());
    setMapJumpTarget({ lat: suggestion.lat, lng: suggestion.lng });
    setStatus("idle");
  }

  function useBranchCurrentLocation() {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setError("Location is not available on this device.");
      return;
    }

    setGeolocating(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const location = { lat: position.coords.latitude, lng: position.coords.longitude };
        setMapJumpTarget(location);
        await markSelectedBranchLocation(location);
        setGeolocating(false);
      },
      () => {
        setGeolocating(false);
        setError("Could not get your current location. Allow location access and try again.");
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  function updateActiveBranch(patch: Partial<AdminBranchLocation>, editKind: "address" | "coordinates" = "address") {
    const addressChanged =
      editKind === "address"
      && ["address", "country", "stateProvince", "city", "postalCode"].some((key) => Object.prototype.hasOwnProperty.call(patch, key));
    const nextPatch = addressChanged ? { ...patch, latitude: "", longitude: "" } : patch;

    setSettings((current) => applyBranchPatch(current, activeBranchId, nextPatch));
    if (editKind === "address") {
      setAddressEditVersion(Date.now());
    } else {
      setCoordinateEditVersion(Date.now());
    }
    setStatus("idle");
  }

  function addBranch() {
    const branch: AdminBranchLocation = {
      id: createBranchId(),
      name: "",
      address: "",
      country: settings.country || "Philippines",
      stateProvince: "",
      city: "",
      postalCode: "",
      latitude: "",
      longitude: "",
    };

    setSettings((current) => ({ ...current, branches: [...current.branches, branch] }));
    setActiveBranchId(branch.id);
    setAddressEditVersion(Date.now());
    setStatus("idle");
  }

  function removeActiveBranch() {
    if (activeBranchId === PRIMARY_BRANCH_ID) {
      return;
    }

    setSettings((current) => ({ ...current, branches: current.branches.filter((branch) => branch.id !== activeBranchId) }));
    setActiveBranchId(PRIMARY_BRANCH_ID);
    setStatus("idle");
  }

  async function markSelectedBranchLocation(location: { lat: number; lng: number }) {
    let resolvedLocation: GeocodeResult | null = null;

    try {
      const response = await fetch(`/api/maps/reverse-geocode?lat=${encodeURIComponent(location.lat)}&lng=${encodeURIComponent(location.lng)}`);
      const payload = await readJsonSafely<{ result?: GeocodeResult | null }>(response);
      resolvedLocation = response.ok ? payload?.result || null : null;
    } catch {
      resolvedLocation = null;
    }

    const components = resolvedLocation?.components;

    setSettings((current) =>
      applyBranchPatch(current, activeBranchId, {
        address: components?.addressLine1 || getActiveBranch(current, activeBranchId).address,
        city: components?.city || getActiveBranch(current, activeBranchId).city,
        stateProvince: components?.province || getActiveBranch(current, activeBranchId).stateProvince,
        postalCode: components?.postalCode || getActiveBranch(current, activeBranchId).postalCode,
        country: components?.country || getActiveBranch(current, activeBranchId).country,
        latitude: formatCoordinate(location.lat),
        longitude: formatCoordinate(location.lng),
      }),
    );
    setCoordinateEditVersion(Date.now());
    setStatus("idle");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("saving");
    setError("");

    try {
      const response = await fetch("/api/admin/settings/general", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      const payload = await readJsonSafely<{ error?: string; settings?: AdminGeneralSettings }>(response);

      if (!response.ok) {
        throw new Error(getResponseErrorMessage(payload, "Unable to save location settings."));
      }

      if (payload?.settings) {
        setSettings(payload.settings);
      }

      setStatus("saved");
    } catch (saveError) {
      setStatus("idle");
      setError(getErrorMessage(saveError, "Unable to save location settings."));
    }
  }

  return (
    <form id="vh-admin-location-settings-form" className="vh-admin-location-settings" onSubmit={handleSubmit}>
      {error ? <div className="vh-admin-form-alert vh-admin-form-alert--error">{error}</div> : null}
      {status === "saved" ? <div className="vh-admin-form-alert">Location settings saved.</div> : null}

      <section className="vh-admin-panel vh-admin-location-form-panel">
        <div className="vh-admin-panel__header">
          <div>
            <h2>Branch Address</h2>
            <p>{activeBranch.id === PRIMARY_BRANCH_ID ? "Primary branch information." : "Editing a saved branch location."}</p>
          </div>
          <div className="vh-admin-location-panel-actions">
            {activeBranch.id !== PRIMARY_BRANCH_ID ? (
              <button className="vh-admin-location-ghost-button vh-admin-location-ghost-button--danger" type="button" onClick={removeActiveBranch}>
                <Trash2 size={14} strokeWidth={1.9} aria-hidden="true" />
                Remove
              </button>
            ) : null}
            <button className="vh-admin-location-ghost-button" type="button" onClick={addBranch}>
              <Plus size={14} strokeWidth={2} aria-hidden="true" />
              Add Branch
            </button>
          </div>
        </div>
        <div className="vh-admin-form-grid">
          <Field label="Store / Branch Name" value={activeBranch.name} onChange={(value) => updateActiveBranch({ name: value })} />
          <Field label="Country" value={activeBranch.country} onChange={(value) => updateActiveBranch({ country: value })} as="select">
            <option value="Philippines">Philippines</option>
          </Field>
          <div className="vh-admin-form-field">
            <span>Store Address</span>
            <AddressAutocomplete
              value={activeBranch.address}
              onValueChange={(value) => updateActiveBranch({ address: value })}
              onSelect={applyBranchSuggestion}
              context={{
                city: activeBranch.city,
                province: activeBranch.stateProvince,
                postalCode: activeBranch.postalCode,
                country: activeBranch.country,
              }}
              placeholder="Search building, street, or area"
            />
          </div>
          <Field label="State / Province" value={activeBranch.stateProvince} onChange={(value) => updateActiveBranch({ stateProvince: value })} />
          <Field label="City" value={activeBranch.city} onChange={(value) => updateActiveBranch({ city: value })} />
          <Field label="Postal Code" value={activeBranch.postalCode} onChange={(value) => updateActiveBranch({ postalCode: value })} />
          <Field label="Latitude" value={activeBranch.latitude} onChange={(value) => updateActiveBranch({ latitude: value }, "coordinates")} />
          <Field label="Longitude" value={activeBranch.longitude} onChange={(value) => updateActiveBranch({ longitude: value }, "coordinates")} />
        </div>
      </section>

      <section className="vh-admin-panel vh-admin-location-map-panel">
        <div className="vh-admin-panel__header">
          <div>
            <h2>Branch Map</h2>
            <p>{mapHelpText}</p>
          </div>
        </div>
        <div className="vh-admin-location-search-row">
          <button type="button" className="vh-address-gps-button" onClick={useBranchCurrentLocation} disabled={geolocating}>
            <Crosshair size={15} strokeWidth={1.9} aria-hidden="true" />
            {geolocating ? "Locating..." : "Use current location"}
          </button>
        </div>
        <VhInteractiveMap
          ariaLabel="Vione Hernal branch map"
          className="vh-admin-location-map"
          markers={mapMarkers.filter((marker) => marker.id !== activeBranchId)}
          activeMarkerId={activeBranchId}
          markerStyle="logo-pin"
          emptyTitle={mapEmptyTitle}
          emptyCopy={mapEmptyCopy}
          onLocationMarked={markSelectedBranchLocation}
          onMarkerSelect={setActiveBranchId}
          previewLocation={mapPreviewLocation}
          centerPinMode
          pinLocation={activePinLocation}
          onCenterCommit={markSelectedBranchLocation}
          recenterTo={mapJumpTarget}
          zoom={13}
        />
        <div className="vh-admin-location-branches">
          {branches.map((branch) => {
            const hasCoordinates = branch.lat !== null && branch.lng !== null;

            return (
              <button
                key={branch.id}
                type="button"
                className={cn("vh-admin-location-branch", branch.id === activeBranchId && "vh-admin-location-branch--active")}
                onClick={() => setActiveBranchId(branch.id)}
              >
                <span>
                  <strong>{branch.name || "Unnamed branch"}</strong>
                  <small>{branch.addressLine || "Address not recorded"}</small>
                </span>
                <em>{hasCoordinates ? `${formatCoordinate(branch.lat || 0)}, ${formatCoordinate(branch.lng || 0)}` : "Coordinates needed"}</em>
              </button>
            );
          })}
        </div>
      </section>

      <button className="vh-admin-action-button vh-admin-action-button--primary vh-admin-settings-mobile-save" type="submit" disabled={status === "saving"}>
        <Save size={16} strokeWidth={1.9} aria-hidden="true" />
        <span>{status === "saving" ? "Saving..." : "Save Changes"}</span>
      </button>
    </form>
  );
}
