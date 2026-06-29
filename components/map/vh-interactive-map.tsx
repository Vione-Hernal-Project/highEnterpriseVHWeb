"use client";

import { MapPin } from "lucide-react";
import { PointerEvent, useCallback, useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";

import { cn } from "@/lib/utils";

const TILE_SIZE = 256;
const MIN_ZOOM = 3;
const MAX_ZOOM = 18;
const DEFAULT_CENTER = { lat: 14.5547, lng: 121.0244 };

export type VhMapMarker = {
  id: string;
  label: string;
  description?: string;
  lat: number;
  lng: number;
  logoUrl?: string;
};

type Props = {
  markers: VhMapMarker[];
  activeMarkerId?: string;
  ariaLabel: string;
  className?: string;
  emptyTitle: string;
  emptyCopy: string;
  initialCenter?: { lat: number; lng: number };
  markerStyle?: "pin" | "logo-pin";
  onLocationMarked?: (location: { lat: number; lng: number }) => void | Promise<void>;
  onMarkerSelect?: (markerId: string) => void;
  previewLocation?: { lat: number; lng: number };
  zoom?: number;
  /** Enables the draggable delivery/branch pin. */
  centerPinMode?: boolean;
  /** The pin's geographic anchor. It stays on this spot while the map is panned. */
  pinLocation?: { lat: number; lng: number } | null;
  /** Fired when the pin is moved (dragged or tap-to-place) with the new location. */
  onCenterCommit?: (location: { lat: number; lng: number }) => void | Promise<void>;
  /** Controlled jump target — when this changes the map snaps to it (suggestion pick / GPS). */
  recenterTo?: { lat: number; lng: number } | null;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function isValidCoordinate(lat: number, lng: number) {
  return Number.isFinite(lat) && Number.isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

function lngToWorldX(lng: number, zoom: number) {
  const scale = TILE_SIZE * 2 ** zoom;

  return ((lng + 180) / 360) * scale;
}

function latToWorldY(lat: number, zoom: number) {
  const safeLat = clamp(lat, -85.05112878, 85.05112878);
  const sinLat = Math.sin((safeLat * Math.PI) / 180);
  const scale = TILE_SIZE * 2 ** zoom;

  return (0.5 - Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI)) * scale;
}

function worldXToLng(x: number, zoom: number) {
  const scale = TILE_SIZE * 2 ** zoom;

  return (x / scale) * 360 - 180;
}

function worldYToLat(y: number, zoom: number) {
  const scale = TILE_SIZE * 2 ** zoom;
  const value = Math.PI - (2 * Math.PI * y) / scale;

  return (180 / Math.PI) * Math.atan(0.5 * (Math.exp(value) - Math.exp(-value)));
}

function getTileUrl(zoom: number, tileX: number, tileY: number) {
  const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN?.trim();

  if (mapboxToken) {
    return `https://api.mapbox.com/styles/v1/mapbox/streets-v12/tiles/256/${zoom}/${tileX}/${tileY}@2x?access_token=${mapboxToken}`;
  }

  const subdomains = ["a", "b", "c", "d"];
  const subdomain = subdomains[Math.abs(tileX + tileY) % subdomains.length];

  return `https://${subdomain}.basemaps.cartocdn.com/light_all/${zoom}/${tileX}/${tileY}.png`;
}

function getAttributionLabel() {
  return process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN?.trim() ? "© Mapbox © OpenStreetMap" : "© OpenStreetMap © CARTO";
}

function resolveInitialCenter(markers: VhMapMarker[], initialCenter?: { lat: number; lng: number }) {
  if (initialCenter && isValidCoordinate(initialCenter.lat, initialCenter.lng)) {
    return initialCenter;
  }

  const firstMarker = markers.find((marker) => isValidCoordinate(marker.lat, marker.lng));

  return firstMarker ? { lat: firstMarker.lat, lng: firstMarker.lng } : DEFAULT_CENTER;
}

export function VhInteractiveMap({
  markers,
  activeMarkerId,
  ariaLabel,
  className,
  emptyTitle,
  emptyCopy,
  initialCenter,
  markerStyle = "pin",
  onLocationMarked,
  onMarkerSelect,
  previewLocation,
  zoom: preferredZoom = 14,
  centerPinMode = false,
  pinLocation,
  onCenterCommit,
  recenterTo,
}: Props) {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const pinScreenRef = useRef({ x: 0, y: 0 });
  const dragRef = useRef<{
    pointerId: number;
    startClientX: number;
    startClientY: number;
    startWorldX: number;
    startWorldY: number;
    moved: boolean;
  } | null>(null);
  const centerRef = useRef(DEFAULT_CENTER);
  const commitTimerRef = useRef<number | null>(null);
  const pinDragRef = useRef<{ pointerId: number; startClientX: number; startClientY: number; offsetX: number; offsetY: number } | null>(null);
  const validMarkers = useMemo(() => markers.filter((marker) => isValidCoordinate(marker.lat, marker.lng)), [markers]);
  const activeMarker = activeMarkerId ? validMarkers.find((marker) => marker.id === activeMarkerId) || null : validMarkers[0] || null;
  const hasPreviewLocation = Boolean(previewLocation && isValidCoordinate(previewLocation.lat, previewLocation.lng));
  const [size, setSize] = useState({ width: 640, height: 380 });
  const [zoom, setZoom] = useState(clamp(preferredZoom, MIN_ZOOM, MAX_ZOOM));
  const [center, setCenter] = useState(() => resolveInitialCenter(validMarkers, previewLocation || initialCenter));
  const [pendingMark, setPendingMark] = useState<{ lat: number; lng: number; x: number; y: number } | null>(null);
  const [marking, setMarking] = useState(false);
  const [pinDragOffset, setPinDragOffset] = useState<{ x: number; y: number } | null>(null);
  const [isPinHeld, setIsPinHeld] = useState(false);

  centerRef.current = center;

  // Controlled jump (suggestion picked or "use my location"): snap + zoom in for precise pinning.
  useEffect(() => {
    if (recenterTo && isValidCoordinate(recenterTo.lat, recenterTo.lng)) {
      setCenter({ lat: recenterTo.lat, lng: recenterTo.lng });
      setZoom((current) => Math.max(current, 16));
    }
  }, [recenterTo?.lat, recenterTo?.lng]);

  useEffect(() => {
    return () => {
      if (commitTimerRef.current !== null) {
        window.clearTimeout(commitTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const element = mapRef.current;

    if (!element) {
      return;
    }

    const updateSize = () => {
      setSize({
        width: Math.max(Math.round(element.clientWidth), 320),
        height: Math.max(Math.round(element.clientHeight), 280),
      });
    };

    updateSize();

    const observer = new ResizeObserver(updateSize);
    observer.observe(element);

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    // In center-pin mode the map center is controlled only by `recenterTo`
    // (explicit jumps); never auto-snap, or the user can't position the pin.
    if (centerPinMode) {
      return;
    }

    if (activeMarker) {
      setCenter({ lat: activeMarker.lat, lng: activeMarker.lng });
      return;
    }

    if (previewLocation && isValidCoordinate(previewLocation.lat, previewLocation.lng)) {
      setCenter(previewLocation);
      return;
    }

    if (initialCenter && isValidCoordinate(initialCenter.lat, initialCenter.lng)) {
      setCenter(initialCenter);
    }
  }, [
    centerPinMode,
    activeMarker?.id,
    activeMarker?.lat,
    activeMarker?.lng,
    initialCenter?.lat,
    initialCenter?.lng,
    activeMarker,
    initialCenter,
    previewLocation?.lat,
    previewLocation?.lng,
    previewLocation,
  ]);

  const coordinatesFromClientPoint = useCallback((clientX: number, clientY: number, targetZoom = zoom) => {
    const element = mapRef.current;
    const rect = element?.getBoundingClientRect();
    const pointerX = rect ? clientX - rect.left : size.width / 2;
    const pointerY = rect ? clientY - rect.top : size.height / 2;
    const centerX = lngToWorldX(center.lng, targetZoom);
    const centerY = latToWorldY(center.lat, targetZoom);
    const topLeftX = centerX - size.width / 2;
    const topLeftY = centerY - size.height / 2;
    const worldX = topLeftX + pointerX;
    const worldY = topLeftY + pointerY;

    return {
      lat: worldYToLat(worldY, targetZoom),
      lng: worldXToLng(worldX, targetZoom),
      pointerX,
      pointerY,
    };
  }, [center.lat, center.lng, size.height, size.width, zoom]);

  const zoomAtClientPoint = useCallback((clientX: number, clientY: number, deltaY: number) => {
    const direction = deltaY < 0 ? 1 : -1;
    const nextZoom = clamp(zoom + direction, MIN_ZOOM, MAX_ZOOM);

    if (nextZoom === zoom) {
      return;
    }

    const currentPoint = coordinatesFromClientPoint(clientX, clientY, zoom);
    const pointWorldX = lngToWorldX(currentPoint.lng, nextZoom);
    const pointWorldY = latToWorldY(currentPoint.lat, nextZoom);
    const nextCenterX = pointWorldX - (currentPoint.pointerX - size.width / 2);
    const nextCenterY = pointWorldY - (currentPoint.pointerY - size.height / 2);

    setZoom(nextZoom);
    setCenter({
      lat: worldYToLat(nextCenterY, nextZoom),
      lng: worldXToLng(nextCenterX, nextZoom),
    });
  }, [coordinatesFromClientPoint, size.height, size.width, zoom]);

  useEffect(() => {
    const element = mapRef.current;

    if (!element) {
      return;
    }

    const handleNativeWheel = (event: globalThis.WheelEvent) => {
      event.preventDefault();
      event.stopPropagation();
      zoomAtClientPoint(event.clientX, event.clientY, event.deltaY);
    };

    element.addEventListener("wheel", handleNativeWheel, { passive: false });

    return () => element.removeEventListener("wheel", handleNativeWheel);
  }, [zoomAtClientPoint]);

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) {
      return;
    }

    if (!mapRef.current) {
      return;
    }

    event.currentTarget.setPointerCapture(event.pointerId);
    setPendingMark(null);
    dragRef.current = {
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startWorldX: lngToWorldX(center.lng, zoom),
      startWorldY: latToWorldY(center.lat, zoom),
      moved: false,
    };
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    const dragState = dragRef.current;

    if (!dragState || dragState.pointerId !== event.pointerId) {
      return;
    }

    const deltaX = event.clientX - dragState.startClientX;
    const deltaY = event.clientY - dragState.startClientY;

    if (Math.abs(deltaX) > 2 || Math.abs(deltaY) > 2) {
      dragState.moved = true;
    }

    const nextWorldX = dragState.startWorldX - deltaX;
    const nextWorldY = dragState.startWorldY - deltaY;

    setCenter({
      lat: worldYToLat(nextWorldY, zoom),
      lng: worldXToLng(nextWorldX, zoom),
    });
  }

  function handlePointerUp(event: PointerEvent<HTMLDivElement>) {
    const dragState = dragRef.current;

    if (dragState?.pointerId !== event.pointerId) {
      return;
    }

    const moved = dragState.moved;
    dragRef.current = null;

    if (!centerPinMode || !onCenterCommit) {
      return;
    }

    // Panning the map does NOT move the pin — the pin stays anchored to its
    // location (it scrolls with the map). Only a tap places the pin there.
    if (moved) {
      return;
    }

    if (commitTimerRef.current !== null) {
      window.clearTimeout(commitTimerRef.current);
    }

    const tapped = coordinatesFromClientPoint(event.clientX, event.clientY, zoom);
    const location = { lat: tapped.lat, lng: tapped.lng };

    commitTimerRef.current = window.setTimeout(() => {
      void onCenterCommit(location);
    }, 120);
  }

  // Dragging the pin itself: it follows the finger/cursor; on release we recenter
  // the map onto where the tip was dropped (so the pin moves in the drag direction).
  function handlePinPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) {
      return;
    }

    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    pinDragRef.current = { pointerId: event.pointerId, startClientX: event.clientX, startClientY: event.clientY, offsetX: 0, offsetY: 0 };
    setPinDragOffset({ x: 0, y: 0 });
    setIsPinHeld(true);
  }

  function handlePinPointerMove(event: PointerEvent<HTMLDivElement>) {
    const dragState = pinDragRef.current;

    if (!dragState || dragState.pointerId !== event.pointerId) {
      return;
    }

    event.stopPropagation();
    dragState.offsetX = event.clientX - dragState.startClientX;
    dragState.offsetY = event.clientY - dragState.startClientY;
    setPinDragOffset({ x: dragState.offsetX, y: dragState.offsetY });
  }

  function handlePinPointerUp(event: PointerEvent<HTMLDivElement>) {
    const dragState = pinDragRef.current;

    if (!dragState || dragState.pointerId !== event.pointerId) {
      return;
    }

    event.stopPropagation();
    pinDragRef.current = null;
    setPinDragOffset(null);
    setIsPinHeld(false);

    const rect = mapRef.current?.getBoundingClientRect();

    if (!rect) {
      return;
    }

    // The pin tip rests at its anchored screen position; add the drag offset to
    // find where it was dropped. Do NOT recenter the map — the pin simply stays
    // where the user dropped it.
    const tipClientX = rect.left + pinScreenRef.current.x + dragState.offsetX;
    const tipClientY = rect.top + pinScreenRef.current.y + dragState.offsetY;
    const dropped = coordinatesFromClientPoint(tipClientX, tipClientY, zoom);
    const location = { lat: dropped.lat, lng: dropped.lng };

    if (onCenterCommit) {
      if (commitTimerRef.current !== null) {
        window.clearTimeout(commitTimerRef.current);
      }

      commitTimerRef.current = window.setTimeout(() => {
        void onCenterCommit(location);
      }, 150);
    }
  }

  function handleContextMenu(event: ReactMouseEvent<HTMLDivElement>) {
    // Center-pin mode uses drag-to-position, not right-click marking.
    if (centerPinMode || !onLocationMarked) {
      return;
    }

    event.preventDefault();
    const location = coordinatesFromClientPoint(event.clientX, event.clientY, zoom);

    setPendingMark({ lat: location.lat, lng: location.lng, x: location.pointerX, y: location.pointerY });
  }

  async function confirmPendingMark() {
    if (!pendingMark || !onLocationMarked) {
      return;
    }

    setMarking(true);

    try {
      await onLocationMarked({ lat: pendingMark.lat, lng: pendingMark.lng });
      setCenter({ lat: pendingMark.lat, lng: pendingMark.lng });
      setPendingMark(null);
    } finally {
      setMarking(false);
    }
  }

  const tileCount = 2 ** zoom;
  const centerX = lngToWorldX(center.lng, zoom);
  const centerY = latToWorldY(center.lat, zoom);
  const topLeftX = centerX - size.width / 2;
  const topLeftY = centerY - size.height / 2;

  // The draggable pin is anchored to its location (falls back to the map center
  // before any location is set), so panning the map leaves the pin on its spot.
  const pinAnchor = pinLocation && isValidCoordinate(pinLocation.lat, pinLocation.lng) ? pinLocation : center;
  const pinScreenX = lngToWorldX(pinAnchor.lng, zoom) - topLeftX;
  const pinScreenY = latToWorldY(pinAnchor.lat, zoom) - topLeftY;
  pinScreenRef.current = { x: pinScreenX, y: pinScreenY };
  const minTileX = Math.floor(topLeftX / TILE_SIZE);
  const maxTileX = Math.floor((topLeftX + size.width) / TILE_SIZE);
  const minTileY = Math.floor(topLeftY / TILE_SIZE);
  const maxTileY = Math.floor((topLeftY + size.height) / TILE_SIZE);
  const tiles = [];

  for (let x = minTileX; x <= maxTileX; x += 1) {
    for (let y = minTileY; y <= maxTileY; y += 1) {
      if (y < 0 || y >= tileCount) {
        continue;
      }

      const wrappedX = ((x % tileCount) + tileCount) % tileCount;
      tiles.push({
        key: `${zoom}-${x}-${y}`,
        url: getTileUrl(zoom, wrappedX, y),
        left: x * TILE_SIZE - topLeftX,
        top: y * TILE_SIZE - topLeftY,
      });
    }
  }

  return (
    <div
      ref={mapRef}
      className={cn("vh-map", className)}
      aria-label={ariaLabel}
      role="application"
      onContextMenu={handleContextMenu}
      onPointerCancel={handlePointerUp}
      onPointerDown={handlePointerDown}
      onPointerLeave={handlePointerUp}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      {validMarkers.length > 0 || hasPreviewLocation || centerPinMode ? (
        <>
          <div className="vh-map__tiles" aria-hidden="true">
            {tiles.map((tile) => (
              <img loading="lazy" decoding="async"
                key={tile.key}
                className="vh-map__tile"
                src={tile.url}
                alt=""
                draggable={false}
                style={{ left: tile.left, top: tile.top }}
              />
            ))}
          </div>
          {validMarkers.map((marker) => {
            const markerX = lngToWorldX(marker.lng, zoom) - topLeftX;
            const markerY = latToWorldY(marker.lat, zoom) - topLeftY;
            const isActive = marker.id === activeMarkerId;

            return (
              <button
                key={marker.id}
                type="button"
                className={cn("vh-map__marker", `vh-map__marker--${markerStyle}`, isActive && "vh-map__marker--active")}
                style={{ left: markerX, top: markerY }}
                aria-label={`View ${marker.label} on map`}
                onClick={() => onMarkerSelect?.(marker.id)}
                onPointerDown={(event) => event.stopPropagation()}
              >
                {markerStyle === "logo-pin" && marker.logoUrl ? <img loading="lazy" decoding="async" src={marker.logoUrl} alt="" /> : <i />}
              </button>
            );
          })}
          {pendingMark ? (
            <div
              className="vh-map__mark-menu"
              style={{ left: pendingMark.x, top: pendingMark.y }}
              onPointerDown={(event) => event.stopPropagation()}
            >
              <button type="button" onClick={confirmPendingMark} disabled={marking}>
                {marking ? "Marking..." : "Mark location"}
              </button>
            </div>
          ) : null}
          {centerPinMode ? (
            <div
              className={cn("vh-map__center-pin", isPinHeld && "vh-map__center-pin--held")}
              style={{
                left: pinScreenX + (pinDragOffset?.x ?? 0),
                top: pinScreenY + (pinDragOffset?.y ?? 0),
              }}
              onPointerDown={handlePinPointerDown}
              onPointerMove={handlePinPointerMove}
              onPointerUp={handlePinPointerUp}
              onPointerCancel={handlePinPointerUp}
            >
              <span className="vh-map__center-pin-body">
                <svg className="vh-map__center-pin-svg" viewBox="0 0 28 36" width="30" height="38" aria-hidden="true">
                  <path
                    d="M14 1.6 C7 1.6 1.8 6.9 1.8 13.7 C1.8 22.9 14 34.4 14 34.4 C14 34.4 26.2 22.9 26.2 13.7 C26.2 6.9 21 1.6 14 1.6 Z"
                    fill="#171513"
                    stroke="#c8a96a"
                    strokeWidth="1.2"
                  />
                  <circle cx="14" cy="13.5" r="5" fill="none" stroke="#c8a96a" strokeWidth="1.1" />
                  <circle cx="14" cy="13.5" r="2.1" fill="#c8a96a" />
                </svg>
              </span>
            </div>
          ) : null}
          {!centerPinMode && (validMarkers.length === 0 || (hasPreviewLocation && activeMarkerId && !activeMarker)) ? (
            <div className="vh-map__empty vh-map__empty--overlay">
              <MapPin size={22} strokeWidth={1.8} aria-hidden="true" />
              <strong>{emptyTitle}</strong>
              <span>{emptyCopy}</span>
            </div>
          ) : null}
          <span className="vh-map__attribution">{getAttributionLabel()}</span>
        </>
      ) : (
        <div className="vh-map__empty">
          <MapPin size={22} strokeWidth={1.8} aria-hidden="true" />
          <strong>{emptyTitle}</strong>
          <span>{emptyCopy}</span>
        </div>
      )}
    </div>
  );
}
