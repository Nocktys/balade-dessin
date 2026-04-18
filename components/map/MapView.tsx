"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import L, { LatLngBounds, Map as LeafletMap } from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  GeoJSON,
  MapContainer,
  Marker,
  Popup,
  TileLayer,
  useMap,
} from "react-leaflet";

type MapViewProps = {
  pausePoint?: [number, number] | null;
  routeGeoJson?: any;
  onUserPositionChange?: (position: [number, number]) => void;
};

delete (
  L.Icon.Default.prototype as L.Icon.Default & {
    _getIconUrl?: string;
  }
)._getIconUrl;

L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png",
});
const pauseIcon = new L.DivIcon({
  html: `
    <div style="
      background: white;
      border-radius: 9999px;
      padding: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      font-size: 16px;
    ">
      🎨
    </div>
  `,
  className: "",
  iconSize: [40, 40],
  iconAnchor: [20, 20],
});
const userIcon = new L.DivIcon({
  html: `
    <div class="user-marker">
      <div class="user-marker-pulse"></div>
      <div class="user-marker-dot"></div>
    </div>
  `,
  className: "",
  iconSize: [20, 20],
  iconAnchor: [10, 10],
});

function RecenterMap({
  position,
  onMapReady,
}: {
  position: [number, number];
  onMapReady: (map: LeafletMap) => void;
}) {
  const map = useMap();
  const hasCenteredInitially = useRef(false);

  useEffect(() => {
    onMapReady(map);
  }, [map, onMapReady]);

  useEffect(() => {
    if (!map || hasCenteredInitially.current) return;

    map.setView(position, 15);
    hasCenteredInitially.current = true;
  }, [position, map]);

  return null;
}

function FitBoundsOnPausePoint({
  userPosition,
  pausePoint,
}: {
  userPosition: [number, number] | null;
  pausePoint: [number, number] | null;
}) {
  const map = useMap();
  const hasFittedOnce = useRef(false);

  const bounds = useMemo(() => {
    if (!userPosition || !pausePoint) return null;
    return new LatLngBounds([userPosition, pausePoint]);
  }, [userPosition, pausePoint]);

  useEffect(() => {
    if (!bounds || hasFittedOnce.current) return;

    map.fitBounds(bounds, {
      padding: [40, 40],
    });

    hasFittedOnce.current = true;
  }, [bounds, map]);

  return null;
}

export default function MapView({
  pausePoint = null,
  routeGeoJson = null,
  onUserPositionChange,
}: MapViewProps) {
  
  
  const [position, setPosition] = useState<[number, number] | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [isMounted, setIsMounted] = useState(false);
  const mapRef = useRef<LeafletMap | null>(null);

  useEffect(() => {
    setIsMounted(true);

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    
    if (!navigator.geolocation) {
      setErrorMessage(
        "La géolocalisation n'est pas supportée sur cet appareil.",
      );
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const coords: [number, number] = [
          pos.coords.latitude,
          pos.coords.longitude,
        ];

        setPosition(coords);
        onUserPositionChange?.(coords);
        setErrorMessage("");
      },
      () => {
        setErrorMessage("Impossible de récupérer ta position.");
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      },
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, [onUserPositionChange]);

  const handleRecenter = () => {
    if (!position || !mapRef.current) return;
    mapRef.current.flyTo(position, 16, { duration: 1.2 });
  };

  if (!isMounted) {
    return (
      <div className="flex h-full w-full items-center justify-center text-sm text-white/50">
        Chargement de la carte...
      </div>
    );
  }

  return (
    <div className="relative h-full w-full overflow-hidden rounded-[28px] bg-black ring-1 ring-white/10">
      <MapContainer
        center={[48.8566, 2.3522]}
        zoom={13}
        scrollWheelZoom={true}
        className="h-full w-full"
      >
        <TileLayer
          attribution="&copy; OpenStreetMap contributors"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {position && (
          <>
            <Marker position={position} icon={userIcon}>
              <Popup>Tu es ici</Popup>
            </Marker>

            <RecenterMap
              position={position}
              onMapReady={(map) => {
                mapRef.current = map;
              }}
            />
          </>
        )}

        {pausePoint && (
          <Marker position={pausePoint} icon={pauseIcon}>
            <Popup
              closeButton={true}
              className="custom-popup"
              offset={[0, -10]}
            >
              <div className="relative min-w-[250px] rounded-[24px] bg-neutral-900/95 p-4 text-white shadow-[0_8px_30px_rgba(0,0,0,0.6)] backdrop-blur-xl">
                <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-white/40">
                  Pause créative
                </p>

                <h3 className="mt-2 text-[20px] font-semibold tracking-[-0.02em] text-white">
                  Moment dessin
                </h3>

                <p className="mt-2 text-[14px] leading-6 text-white/70">
                  Arrête-toi ici quelques minutes. Observe ce qui t’entoure,
                  choisis un détail, puis dessine simplement ce que tu vois.
                </p>

                <div className="mt-4 h-px w-full bg-white/10" />

                <p className="mt-3 text-[12px] leading-5 text-white/50">
                  Commence par les formes générales, puis ajoute les détails.
                </p>
              </div>
            </Popup>
          </Marker>
        )}

        {routeGeoJson && (
          <GeoJSON
            data={routeGeoJson}
            style={{
              color: "#00FFAA",
              weight: 4,
            }}
          />
        )}

        <FitBoundsOnPausePoint
          userPosition={position}
          pausePoint={pausePoint}
        />
      </MapContainer>

      <div className="absolute bottom-3 right-3 z-[1000] flex flex-col items-end gap-2">
        <button
          type="button"
          onClick={handleRecenter}
          className="rounded-2xl bg-white px-4 py-2 text-sm font-medium text-black shadow-lg"
        >
          Me recentrer
        </button>

      </div>

      {errorMessage ? (
        <div className="absolute bottom-3 left-3 right-20 rounded-2xl bg-black/70 px-3 py-2 text-sm text-white">
          {errorMessage}
        </div>
      ) : null}
    </div>
  );
}
