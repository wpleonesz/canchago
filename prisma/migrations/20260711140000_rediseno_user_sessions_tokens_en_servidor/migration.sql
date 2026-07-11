-- Rediseño de user_sessions: los tokens OAuth pasan de la cookie al servidor.
--
-- Motivo: la cookie de sesión llevaba dentro el access token, el refresh token y el
-- ID token de Keycloak. Sellada, superaba los 5.300 bytes, y los navegadores descartan
-- en silencio cualquier cookie de más de 4.096. El login funcionaba con curl y fallaba
-- en Chrome.
--
-- La tabla estaba vacía (0 filas), así que se rediseña sin migración de datos.

ALTER TABLE "user_sessions" DROP COLUMN "refresh_token_hash";

-- Token set completo, sellado con @hapi/iron: un volcado de la base no expone los tokens.
ALTER TABLE "user_sessions" ADD COLUMN "sealed_tokens" TEXT NOT NULL;

-- Permite invalidar una sesión en el servidor: sin esto, el logout no revocaba nada.
ALTER TABLE "user_sessions" ADD COLUMN "revoked_at" TIMESTAMPTZ;

ALTER TABLE "user_sessions" ADD COLUMN "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "user_sessions" ADD COLUMN "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX "user_sessions_expires_at_idx" ON "user_sessions"("expires_at");
