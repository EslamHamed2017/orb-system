-- T025 expand-only product lifecycle status. Existing products remain active and traceable.
CREATE TYPE "ProductStatus" AS ENUM ('ACTIVE', 'INACTIVE');
ALTER TABLE "CoffeeSpecification"
  ADD COLUMN "status" "ProductStatus" NOT NULL DEFAULT 'ACTIVE';
