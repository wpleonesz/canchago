ALTER TABLE "user_profiles"
ADD COLUMN "phone" VARCHAR(16),
ADD COLUMN "avatar_data" BYTEA,
ADD COLUMN "avatar_mime_type" VARCHAR(30),
ADD COLUMN "avatar_updated_at" TIMESTAMPTZ,
ADD COLUMN "facebook_url" VARCHAR(500),
ADD COLUMN "instagram_url" VARCHAR(500),
ADD COLUMN "linkedin_url" VARCHAR(500),
ADD COLUMN "x_url" VARCHAR(500),
ADD COLUMN "github_url" VARCHAR(500),
ADD COLUMN "tiktok_url" VARCHAR(500),
ADD COLUMN "website_url" VARCHAR(500);
