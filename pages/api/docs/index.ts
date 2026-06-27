import type { NextApiRequest, NextApiResponse } from 'next';

const html = `<!DOCTYPE html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Canchago API Docs</title>
    <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist/swagger-ui.css" />
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
      });
    </script>
  </body>
</html>`;

export default function handler(_req: NextApiRequest, res: NextApiResponse): void {
	res.setHeader('Content-Type', 'text/html');
	res.status(200).send(html);
}
