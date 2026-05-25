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
}: Props) {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{
    pointerId: number;
    startClientX: number;
    startClientY: number;
    startWorldX: number;
    startWorldY: number;
  } | null>(null);
  const validMarkers = useMemo(() => markers.filter((marker) => isValidCoordinate(marker.lat, marker.lng)), [markers]);
  const activeMarker = activeMarkerId ? validMarkers.find((marker) => marker.id === activeMarkerId) || null : validMarkers[0] || null;
  const hasPreviewLocation = Boolean(previewLocation && isValidCoordinate(previewLocation.lat, previewLocation.lng));
  const [size, setSize] = useState({ width: 640, height: 380 });
  const [zoom, setZoom] = useState(clamp(preferredZoom, MIN_ZOOM, MAX_ZOOM));
  const [center, setCenter] = useState(() => resolveInitialCenter(validMarkers, previewLocation || initialCenter));
  const [pendingMark, setPendingMark] = useState<{ lat: number; lng: number; x: number; y: number } | null>(null);
  const [marking, setMarking] = useState(false);

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
    };
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    const dragState = dragRef.current;

    if (!dragState || dragState.pointerId !== event.pointerId) {
      return;
    }

    const deltaX = event.clientX - dragState.startClientX;
    const deltaY = event.clientY - dragState.startClientY;
    const nextWorldX = dragState.startWorldX - deltaX;
    const nextWorldY = dragState.startWorldY - deltaY;

    setCenter({
      lat: worldYToLat(nextWorldY, zoom),
      lng: worldXToLng(nextWorldX, zoom),
    });
  }

  function handlePointerUp(event: PointerEvent<HTMLDivElement>) {
    if (dragRef.current?.pointerId === event.pointerId) {
      dragRef.current = null;
    }
  }

  function handleContextMenu(event: ReactMouseEvent<HTMLDivElement>) {
    if (!onLocationMarked) {
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
      {validMarkers.length > 0 || hasPreviewLocation ? (
        <>
          <div className="vh-map__tiles" aria-hidden="true">
            {tiles.map((tile) => (
              <img
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
                {markerStyle === "logo-pin" && marker.logoUrl ? <img src={marker.logoUrl} alt="" /> : <i />}
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
          {validMarkers.length === 0 || (hasPreviewLocation && activeMarkerId && !activeMarker) ? (
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
