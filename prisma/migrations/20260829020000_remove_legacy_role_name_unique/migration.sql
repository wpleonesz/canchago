-- The normalized partial index introduced by feature 018 is the tenant role identity.
-- Keeping the legacy exact-name constraint would prevent reusing a name after soft delete.
DROP INDEX "roles_organization_id_name_key";
