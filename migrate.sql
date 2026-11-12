BEGIN;

ALTER TABLE customers RENAME COLUMN "CreatedByIp" TO created_by_ip;
ALTER TABLE customers RENAME COLUMN "CreatedBy" TO created_by;

ALTER TABLE orders ADD COLUMN discount numeric(10,2) NOT NULL DEFAULT 0;

ALTER TABLE customers ALTER COLUMN created_by_ip TYPE character varying(50);
ALTER TABLE customers ALTER COLUMN created_by_ip SET DEFAULT '';
ALTER TABLE customers ALTER COLUMN created_by TYPE character varying(100);
ALTER TABLE customers ALTER COLUMN created_by SET DEFAULT '';

CREATE TABLE service_categories (
    id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    company_id integer NULL,
    name character varying(100) NOT NULL,
    active boolean NOT NULL,
    created_at timestamp with time zone NOT NULL
);

ALTER TABLE customers ALTER COLUMN mobile DROP NOT NULL;

UPDATE customers SET mobile = NULL
WHERE company_id IS NOT NULL AND mobile IS NOT NULL
  AND id NOT IN (
    SELECT MIN(id) FROM customers
    WHERE company_id IS NOT NULL AND mobile IS NOT NULL
    GROUP BY company_id, mobile
  );

CREATE UNIQUE INDEX "IX_customers_company_id_mobile"
    ON customers (company_id, mobile)
    WHERE company_id IS NOT NULL;

INSERT INTO "__EFMigrationsHistory" ("MigrationId", "ProductVersion")
VALUES ('20261112151134_AddDiscountAndCategory', '8.0.0');

COMMIT;
