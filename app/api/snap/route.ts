export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { point } = body as {
      point?: [number, number];
    };

    if (!point) {
      return Response.json(
        { error: "Le point à snapper est requis." },
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
      "https://api.openrouteservice.org/v2/snap/foot-walking",
      {
        method: "POST",
        headers: {
          Authorization: apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          locations: [[point[1], point[0]]], // ORS attend [lng, lat]
          radius: 350,
        }),
      },
    );

    if (!orsResponse.ok) {
      const errorText = await orsResponse.text();

      return Response.json(
        {
          error: "Erreur OpenRouteService Snap",
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
