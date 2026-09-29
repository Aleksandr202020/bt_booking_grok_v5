-- BT Booking v5 — run this once in Neon SQL Editor
-- https://console.neon.tech → your project → SQL Editor

CREATE TYPE "UserRole" AS ENUM ('CLIENT', 'ADMIN');
CREATE TYPE "BookingStatus" AS ENUM ('CONFIRMED', 'CANCELLED', 'COMPLETED');

CREATE TABLE IF NOT EXISTS "users" (
  "id" TEXT PRIMARY KEY,
  "name" TEXT NOT NULL,
  "phone" TEXT NOT NULL UNIQUE,
  "email" TEXT UNIQUE,
  "password" TEXT NOT NULL,
  "role" "UserRole" NOT NULL DEFAULT 'CLIENT',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "brands" (
  "id" TEXT PRIMARY KEY,
  "name" TEXT NOT NULL UNIQUE,
  "nameLv" TEXT,
  "nameRu" TEXT,
  "nameEn" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "categories" (
  "id" TEXT PRIMARY KEY,
  "slug" TEXT NOT NULL UNIQUE,
  "nameLv" TEXT NOT NULL,
  "nameRu" TEXT NOT NULL,
  "nameEn" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "models" (
  "id" TEXT PRIMARY KEY,
  "brandId" TEXT NOT NULL REFERENCES "brands"("id"),
  "categoryId" TEXT NOT NULL REFERENCES "categories"("id"),
  "name" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE ("brandId", "name")
);

CREATE TABLE IF NOT EXISTS "cars" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL REFERENCES "users"("id"),
  "modelId" TEXT NOT NULL REFERENCES "models"("id"),
  "plate" TEXT,
  "archived" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "services" (
  "id" TEXT PRIMARY KEY,
  "slug" TEXT NOT NULL UNIQUE,
  "nameLv" TEXT NOT NULL,
  "nameRu" TEXT NOT NULL,
  "nameEn" TEXT NOT NULL,
  "description" TEXT,
  "isExtra" BOOLEAN NOT NULL DEFAULT false,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "service_prices" (
  "id" TEXT PRIMARY KEY,
  "serviceId" TEXT NOT NULL REFERENCES "services"("id"),
  "categoryId" TEXT NOT NULL REFERENCES "categories"("id"),
  "priceCents" INTEGER NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE ("serviceId", "categoryId")
);

CREATE TABLE IF NOT EXISTS "slot_holds" (
  "id" TEXT PRIMARY KEY,
  "date" DATE NOT NULL,
  "startTime" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "userId" TEXT REFERENCES "users"("id"),
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE ("date", "startTime")
);
CREATE INDEX IF NOT EXISTS "slot_holds_expiresAt_idx" ON "slot_holds"("expiresAt");

CREATE TABLE IF NOT EXISTS "blocked_slots" (
  "id" TEXT PRIMARY KEY,
  "date" DATE NOT NULL,
  "startTime" TEXT NOT NULL,
  "reason" TEXT,
  "createdBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE ("date", "startTime")
);

CREATE TABLE IF NOT EXISTS "closed_days" (
  "id" TEXT PRIMARY KEY,
  "date" DATE NOT NULL UNIQUE,
  "name" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "bookings" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL REFERENCES "users"("id"),
  "carId" TEXT NOT NULL REFERENCES "cars"("id"),
  "date" DATE NOT NULL,
  "startTime" TEXT NOT NULL,
  "endTime" TEXT NOT NULL,
  "status" "BookingStatus" NOT NULL DEFAULT 'CONFIRMED',
  "carBrandName" TEXT NOT NULL,
  "carModelName" TEXT NOT NULL,
  "carCategoryName" TEXT NOT NULL,
  "carCategorySlug" TEXT NOT NULL,
  "totalPriceCents" INTEGER NOT NULL,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE ("date", "startTime")
);
CREATE INDEX IF NOT EXISTS "bookings_userId_date_idx" ON "bookings"("userId", "date");
CREATE INDEX IF NOT EXISTS "bookings_status_date_idx" ON "bookings"("status", "date");

CREATE TABLE IF NOT EXISTS "booking_services" (
  "id" TEXT PRIMARY KEY,
  "bookingId" TEXT NOT NULL REFERENCES "bookings"("id") ON DELETE CASCADE,
  "serviceId" TEXT REFERENCES "services"("id") ON DELETE SET NULL,
  "serviceNameLv" TEXT NOT NULL,
  "serviceNameRu" TEXT NOT NULL,
  "serviceNameEn" TEXT NOT NULL,
  "isExtra" BOOLEAN NOT NULL,
  "priceCents" INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS "audit_logs" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT REFERENCES "users"("id"),
  "action" TEXT NOT NULL,
  "entityType" TEXT,
  "entityId" TEXT,
  "meta" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "audit_logs_entity_idx" ON "audit_logs"("entityType", "entityId");
CREATE INDEX IF NOT EXISTS "audit_logs_createdAt_idx" ON "audit_logs"("createdAt");
