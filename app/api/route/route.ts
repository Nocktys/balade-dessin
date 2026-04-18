export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { start, seed, length } = body as {
      start?: [number, number];
      seed?: number;
      length?: number;
    };

    if (!start) {
      return Response.json(
        { error: "Le point de départ est requis." },
        { status: 400 },
      );
    }

    const apiKey = process.env.ORS_API_KEY;

    if (!apiKey) {
      return Response.json(
        { error: "Clé OpenRouteService manquante dans .env.local" },
        { status: 500 },
      );
    }

    const orsResponse = await fetch(
      "https://api.openrouteservice.org/v2/directions/foot-walking/geojson",
      {
        method: "POST",
        headers: {
          Authorization: apiKey,
          "Content-Type": "application/json",
          Accept:
            "application/json, application/geo+json, application/gpx+xml, img/png; charset=utf-8",
        },
        body: JSON.stringify({
          coordinates: [[start[1], start[0]]], // ORS attend [lng, lat]
          options: {
            round_trip: {
              length: length ?? 3000,
              points: 3,
              seed: seed ?? Math.floor(Math.random() * 1000000),
            },
          },
        }),
      },
    );

    if (!orsResponse.ok) {
      const errorText = await orsResponse.text();

      return Response.json(
        {
          error: "Erreur OpenRouteService",
          details: errorText,
        },
        { status: orsResponse.status },
      );
    }

    const data = await orsResponse.json();

    return Response.json(data);
  } catch (error) {
    console.error(error);

    return Response.json({ error: "Erreur serveur interne." }, { status: 500 });
  }
}
