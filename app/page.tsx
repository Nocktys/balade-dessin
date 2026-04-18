"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";

const MapView = dynamic(() => import("@/components/map/MapView"), {
  ssr: false,
});

type RouteGeoJson = any;

function generateRandomPoint(
  lat: number,
  lng: number,
  minDistanceKm = 0.2,
  maxDistanceKm = 0.4,
): [number, number] {
  const earthRadiusKm = 6371;
  const distanceKm =
    Math.random() * (maxDistanceKm - minDistanceKm) + minDistanceKm;
  const angle = Math.random() * 2 * Math.PI;

  const deltaLat = (distanceKm / earthRadiusKm) * (180 / Math.PI);
  const deltaLng =
    ((distanceKm / earthRadiusKm) * (180 / Math.PI)) /
    Math.cos((lat * Math.PI) / 180);

  const newLat = lat + deltaLat * Math.cos(angle);
  const newLng = lng + deltaLng * Math.sin(angle);

  return [newLat, newLng];
}

function getPausePointFromRoute(routeGeoJson: any): [number, number] | null {
  const coordinates = routeGeoJson?.features?.[0]?.geometry?.coordinates;

  if (!coordinates || !Array.isArray(coordinates) || coordinates.length < 3) {
    return null;
  }

  const middleIndex = Math.floor(coordinates.length * 0.5);
  const selectedPoint = coordinates[middleIndex];

  if (!selectedPoint || selectedPoint.length < 2) {
    return null;
  }

  const [lng, lat] = selectedPoint;

  return [lat, lng];
}
function getRouteLengthFromDuration(duration: 20 | 30 | 40): number {
  if (duration === 20) return 1800;
  if (duration === 30) return 2600;
  return 3500;
}
function getRouteDistanceKm(routeGeoJson: any): string | null {
  const distanceMeters =
    routeGeoJson?.features?.[0]?.properties?.summary?.distance;

  if (typeof distanceMeters !== "number") return null;

  return `${(distanceMeters / 1000).toFixed(1)} km`;
}

function getRouteDurationMinutes(routeGeoJson: any): string | null {
  const durationSeconds =
    routeGeoJson?.features?.[0]?.properties?.summary?.duration;

  if (typeof durationSeconds !== "number") return null;

  return `${Math.round(durationSeconds / 60)} min`;
}
function getWalkTitle(duration: 20 | 30 | 40): string {
  if (duration === 20) return "Marche douce";
  if (duration === 30) return "Un entre deux";
  return "Balade immersive";
}
function formatDrawingTime(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}
function getDistanceInMeters(
  pointA: [number, number],
  pointB: [number, number]
): number {
  const [lat1, lng1] = pointA;
  const [lat2, lng2] = pointB;

  const toRad = (value: number) => (value * Math.PI) / 180;
  const earthRadius = 6371000;

  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return earthRadius * c;
}
export default function Home() {
  const [userPosition, setUserPosition] = useState<[number, number] | null>(
    null,
  );
  const [pausePoint, setPausePoint] = useState<[number, number] | null>(null);
  const [routeGeoJson, setRouteGeoJson] = useState<RouteGeoJson | null>(null);
  const [isLoadingRoute, setIsLoadingRoute] = useState(false);
  const [walkDuration, setWalkDuration] = useState<20 | 30 | 40>(30);
  const [showArrivalOverlay, setShowArrivalOverlay] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawingSeconds, setDrawingSeconds] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [showDrawingComplete, setShowDrawingComplete] = useState(false);
  const [hasTriggeredArrival, setHasTriggeredArrival] = useState(false);
  const [hasLocationFix, setHasLocationFix] = useState(false);
  useEffect(() => {
    if (!isTimerRunning) return;

    const interval = window.setInterval(() => {
      setDrawingSeconds((prev) => prev + 1);
    }, 1000);

    return () => {
      window.clearInterval(interval);
    };
  }, [isTimerRunning]);
  useEffect(() => {
  if (!userPosition || !pausePoint || hasTriggeredArrival || isDrawing) return;

  const distance = getDistanceInMeters(userPosition, pausePoint);

  if (distance <= 10) {
    setShowArrivalOverlay(true);
    setHasTriggeredArrival(true);
  }
}, [userPosition, pausePoint, hasTriggeredArrival, isDrawing]);
  async function fetchRoute(start: [number, number], length: number) {
    const response = await fetch("/api/route", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        start,
        seed: Math.floor(Math.random() * 1000000),
        length,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error("Erreur API route");
    }

    return data;
  }

  function getDurationFromRoute(routeGeoJson: any): number {
    const seconds = routeGeoJson?.features?.[0]?.properties?.summary?.duration;

    return typeof seconds === "number" ? seconds / 60 : 0;
  }
  const handleGenerateWalk = async () => {
    if (!userPosition) {
      alert("Ta position n'est pas encore disponible.");
      return;
    }

    setIsLoadingRoute(true);
    setRouteGeoJson(null);
    setPausePoint(null);
    setHasTriggeredArrival(false);
    setShowArrivalOverlay(false);

    try {
      let targetDuration = walkDuration;
      let length = getRouteLengthFromDuration(walkDuration);

      let bestRoute = null;
      let bestDiff = Infinity;

      for (let i = 0; i < 3; i++) {
        const route = await fetchRoute(userPosition, length);
        const duration = getDurationFromRoute(route);

        const diff = Math.abs(duration - targetDuration);

        if (diff < bestDiff) {
          bestDiff = diff;
          bestRoute = route;
        }

        // ajuste la longueur pour le prochain essai
        if (duration > targetDuration) {
          length *= 0.7;
        } else {
          length *= 1.2;
        }
      }

      if (!bestRoute) {
        alert("Impossible de générer une balade correcte.");
        return;
      }

      setRouteGeoJson(bestRoute);

      const routePausePoint = getPausePointFromRoute(bestRoute);
      setPausePoint(routePausePoint);
    } catch (error) {
      console.error(error);
      alert("Erreur réseau pendant la génération de la balade.");
    } finally {
      setIsLoadingRoute(false);
    }
  };
  const routeDistance = getRouteDistanceKm(routeGeoJson);
  const routeDuration = getRouteDurationMinutes(routeGeoJson);
  const distanceToPausePoint =
  userPosition && pausePoint
    ? Math.round(getDistanceInMeters(userPosition, pausePoint))
    : null;
  return (
    <main className="min-h-screen bg-neutral-950 text-white">
     <section className="mx-auto flex h-[100dvh] w-full max-w-md flex-col overflow-hidden px-4 py-4">
        <header className="mb-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-white/35">
                Le temps d'une Balade
              </p>
              <h1 className="mt-2 text-[30px] font-semibold tracking-[-0.03em] text-white">
                Marche. Observe. Dessine.
              </h1>
            </div>

            <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] text-white/55">
              v1
            </div>
          </div>

          <p className="mt-3 max-w-[300px] text-sm leading-6 text-white/60">
            Génère une boucle à pied avec un moment d’arrêt pour regarder autour
            de toi et dessiner.
          </p>
        </header>

        <div className="relative z-0 mb-4 h-[380px] overflow-hidden rounded-[32px] border border-white/10 bg-white/5 shadow-[0_8px_30px_rgba(0,0,0,0.35)]">
          <MapView
  pausePoint={pausePoint}
  routeGeoJson={routeGeoJson}
  onUserPositionChange={(position) => {
    setUserPosition(position);
    setHasLocationFix(true);
  }}
/>
        </div>

        <div className="relative z-10 mt-auto space-y-3">
          <div className="rounded-[32px] bg-white/[0.03] p-5 ring-1 ring-white/8 backdrop-blur-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-medium uppercase tracking-[0.24em] text-white/35">
                  Balade du jour
                </p>

                <h2 className="mt-2 max-w-[190px] text-[28px] font-semibold leading-[1.05] tracking-[-0.04em] text-white">
                  {getWalkTitle(walkDuration)}
                </h2>

                <p className="mt-3 max-w-[220px] text-sm leading-6 text-white/50">
                  Une boucle à pied avec une pause pour observer et dessiner.
                </p>
              </div>

              <div className="rounded-full bg-white/[0.04] p-1 ring-1 ring-white/8">
                <div className="flex gap-1">
                  {[20, 30, 40].map((duration) => {
                    const isActive = walkDuration === duration;

                    return (
                      <button
                        key={duration}
                        type="button"
                        onClick={() =>
                          setWalkDuration(duration as 20 | 30 | 40)
                        }
                        className={`min-w-[52px] rounded-full px-3 py-2 text-[11px] font-medium leading-none transition ${
                          isActive
                            ? "bg-white text-black shadow-sm"
                            : "text-white/45 hover:text-white/70"
                        }`}
                      >
                        <span className="block text-center">{duration}</span>
                        <span className="mt-1 block text-center text-[10px] opacity-70">
                          min
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

{(routeDistance || routeDuration || distanceToPausePoint !== null) && (
  <div className="mt-4 flex flex-wrap gap-2">
    {routeDistance && (
      <div className="rounded-full bg-white/[0.04] px-3 py-1.5 text-[11px] text-white/65 ring-1 ring-white/8">
        {routeDistance}
      </div>
    )}

    {routeDuration && (
      <div className="rounded-full bg-white/[0.04] px-3 py-1.5 text-[11px] text-white/65 ring-1 ring-white/8">
        {routeDuration}
      </div>
    )}

    {distanceToPausePoint !== null && (
      <div className="rounded-full bg-white/[0.04] px-3 py-1.5 text-[11px] text-white/65 ring-1 ring-white/8">
        Point dessin à {distanceToPausePoint} m
      </div>
    )}
  </div>
)}

            {isLoadingRoute && (
              <p className="mt-4 text-sm text-white/55">
                Génération de la balade...
              </p>
            )}

            {!isLoadingRoute && routeGeoJson && (
              <p className="mt-4 text-sm text-white/55">La balade est prête.</p>
            )}
          </div>

          <button
            type="button"
            onClick={handleGenerateWalk}
            disabled={!hasLocationFix || isLoadingRoute}
           className={`w-full rounded-[24px] px-4 py-4 text-base font-semibold tracking-[-0.01em] transition ${
  !hasLocationFix || isLoadingRoute
    ? "bg-white/10 text-white/40"
    : "bg-white text-black"
}`}
          >
            {!hasLocationFix
  ? "Recherche de ta position..."
  : isLoadingRoute
  ? "Génération..."
  : "Générer une balade"}
          </button>

        </div>
      </section>
      {isDrawing && (
        <div className="fixed inset-x-0 bottom-0 z-[1800] px-4 pb-4">
          <div className="mx-auto w-full max-w-md rounded-[28px] border border-white/10 bg-neutral-950/95 p-5 text-white shadow-2xl backdrop-blur-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-white/35">
                  Session dessin
                </p>

                <h3 className="mt-2 text-[24px] font-semibold tracking-[-0.03em] text-white">
                  Dessin en cours
                </h3>

                <p className="mt-2 text-sm leading-6 text-white/60">
                  Prends ton temps. Observe, simplifie les formes, puis ajoute
                  les détails.
                </p>
              </div>

              <div className="rounded-full bg-white/[0.05] px-4 py-2 text-sm font-medium text-white ring-1 ring-white/10">
                {formatDrawingTime(drawingSeconds)}
              </div>
            </div>

            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={() => setIsTimerRunning((prev) => !prev)}
                className="flex-1 rounded-[20px] bg-white/[0.05] px-4 py-3 text-sm font-medium text-white ring-1 ring-white/10"
              >
                {isTimerRunning ? "Mettre en pause" : "Reprendre"}
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsDrawing(false);
                  setIsTimerRunning(false);
                  setShowDrawingComplete(true);
                }}
                className="flex-1 rounded-[20px] bg-white px-4 py-3 text-sm font-semibold text-black"
              >
                Terminer
              </button>
            </div>
          </div>
        </div>
      )}
      {showDrawingComplete && (
        <div className="fixed inset-0 z-[1900] flex items-end bg-black/70 backdrop-blur-md">
          <div className="w-full rounded-t-[32px] border-t border-white/10 bg-neutral-950 px-6 pb-8 pt-6 text-white shadow-2xl">
            <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-white/15" />

            <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-white/35">
              Session terminée
            </p>

            <h2 className="mt-3 text-[32px] font-semibold leading-[1.02] tracking-[-0.05em] text-white">
              Beau moment.
            </h2>

            <p className="mt-4 max-w-[320px] text-[15px] leading-7 text-white/65">
              Tu as pris le temps d’observer et de dessiner. C’est déjà
              beaucoup.
            </p>

            <div className="mt-6 rounded-[24px] bg-white/[0.04] p-4 ring-1 ring-white/8">
              <p className="text-sm text-white/75">Temps de dessin</p>
              <p className="mt-2 text-[28px] font-semibold tracking-[-0.03em] text-white">
                {formatDrawingTime(drawingSeconds)}
              </p>
            </div>

            <div className="mt-6 flex flex-col gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowDrawingComplete(false);
                  setDrawingSeconds(0);
                }}
                className="w-full rounded-[24px] bg-white px-4 py-4 text-base font-semibold tracking-[-0.01em] text-black"
              >
                Retour à la balade
              </button>
            </div>
          </div>
        </div>
      )}
      {showArrivalOverlay && (
        <div className="fixed inset-0 z-[2000] flex items-end bg-black/70 backdrop-blur-md">
          <div className="w-full rounded-t-[32px] border-t border-white/10 bg-neutral-950 px-6 pb-8 pt-6 text-white shadow-2xl">
            <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-white/15" />

            <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-white/35">
              Point dessin
            </p>

            <h2 className="mt-3 text-[32px] font-semibold leading-[1.02] tracking-[-0.05em] text-white">
              Tu es arrivé.
            </h2>

            <p className="mt-4 max-w-[320px] text-[15px] leading-7 text-white/65">
              Prends quelques minutes pour regarder autour de toi. Choisis une
              scène, un détail ou une forme, puis commence à dessiner ce que tu
              vois.
            </p>

            <div className="mt-6 rounded-[24px] bg-white/[0.04] p-4 ring-1 ring-white/8">
              <p className="text-sm text-white/75">Conseil du moment</p>
              <p className="mt-2 text-sm leading-6 text-white/55">
                Commence par les grandes lignes, puis laisse les détails
                apparaître progressivement.
              </p>
            </div>

            <div className="mt-6 flex flex-col gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowArrivalOverlay(false);
                  setIsDrawing(true);
                  setDrawingSeconds(0);
                  setIsTimerRunning(true);
                }}
                className="w-full rounded-[24px] bg-white px-4 py-4 text-base font-semibold tracking-[-0.01em] text-black"
              >
                Commencer à dessiner
              </button>

              <button
                type="button"
                onClick={() => setShowArrivalOverlay(false)}
                className="w-full rounded-[24px] bg-white/[0.04] px-4 py-4 text-sm font-medium text-white/75 ring-1 ring-white/8"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
