import type { NextApiRequest, NextApiResponse } from 'next';

const html = `<!DOCTYPE html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Canchago API Docs</title>
    <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist/swagger-ui.css" />
    <style>
      /* Oculta el campo de URL del spec para evitar confusión */
      .swagger-ui .topbar { display: none; }
    </style>
  </head>
  <body>
    <div id="swagger-ui"></div>
    <script src="https://unpkg.com/swagger-ui-dist/swagger-ui-bundle.js"></script>
    <script>
      SwaggerUIBundle({
        url: '/api/docs/spec',
        dom_id: '#swagger-ui',
        presets: [SwaggerUIBundle.presets.apis, SwaggerUIBundle.SwaggerUIStandalonePreset],
        layout: 'BaseLayout',
        docExpansion: 'list',
        defaultModelsExpandDepth: -1,
        /* Envía cookies de sesión automáticamente en cada llamada */
        withCredentials: true,
        /* Mantiene el estado de "Authorize" al recargar */
        persistAuthorization: true,
        /* Muestra la duración de cada respuesta */
        displayRequestDuration: true,
        /* Activa el "Try it out" en todos los endpoints por defecto */
        tryItOutEnabled: true,
      });
    </script>
  </body>
</html>`;

export default function handler(_req: NextApiRequest, res: NextApiResponse): void {
	res.setHeader('Content-Type', 'text/html');
	res.status(200).send(html);
}
