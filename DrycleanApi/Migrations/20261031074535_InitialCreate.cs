using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace DrycleanApi.Migrations
{
    /// <inheritdoc />
    public partial class InitialCreate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateSequence(
                name: "order_num_seq",
                startValue: 10001L);

            migrationBuilder.CreateTable(
                name: "customers",
                columns: table => new
                {
                    id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityAlwaysColumn),
                    name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    mobile = table.Column<string>(type: "character varying(15)", maxLength: 15, nullable: false),
                    address = table.Column<string>(type: "text", nullable: false, defaultValue: ""),
                    email = table.Column<string>(type: "text", nullable: false, defaultValue: ""),
                    reg_date = table.Column<DateOnly>(type: "date", nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_customers", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "products",
                columns: table => new
                {
                    id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityAlwaysColumn),
                    name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    category = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    price = table.Column<decimal>(type: "numeric(10,2)", nullable: false),
                    emoji = table.Column<string>(type: "text", nullable: false, defaultValue: ""),
                    active = table.Column<bool>(type: "boolean", nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_products", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "settings",
                columns: table => new
                {
                    key = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    value = table.Column<string>(type: "text", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_settings", x => x.key);
                });

            migrationBuilder.CreateTable(
                name: "orders",
                columns: table => new
                {
                    id = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    cust_id = table.Column<int>(type: "integer", nullable: true),
                    cust_name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    mobile = table.Column<string>(type: "character varying(15)", maxLength: 15, nullable: false),
                    entry_date = table.Column<DateOnly>(type: "date", nullable: false),
                    delivery_date = table.Column<DateOnly>(type: "date", nullable: false),
                    total = table.Column<decimal>(type: "numeric(10,2)", nullable: false),
                    advance = table.Column<decimal>(type: "numeric(10,2)", nullable: false),
                    balance = table.Column<decimal>(type: "numeric(10,2)", nullable: false),
                    pay_mode = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    status = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CustomerId = table.Column<int>(type: "integer", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_orders", x => x.id);
                    table.ForeignKey(
                        name: "FK_orders_customers_CustomerId",
                        column: x => x.CustomerId,
                        principalTable: "customers",
                        principalColumn: "id");
                });

            migrationBuilder.CreateTable(
                name: "order_history",
                columns: table => new
                {
                    id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityAlwaysColumn),
                    order_id = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    status = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_by = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false, defaultValue: "Admin"),
                    note = table.Column<string>(type: "text", nullable: false, defaultValue: "")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_order_history", x => x.id);
                    table.ForeignKey(
                        name: "FK_order_history_orders_order_id",
                        column: x => x.order_id,
                        principalTable: "orders",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "order_items",
                columns: table => new
                {
                    id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityAlwaysColumn),
                    order_id = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    product_name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    category = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    qty = table.Column<int>(type: "integer", nullable: false),
                    rate = table.Column<decimal>(type: "numeric(10,2)", nullable: false),
                    amount = table.Column<decimal>(type: "numeric(10,2)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_order_items", x => x.id);
                    table.ForeignKey(
                        name: "FK_order_items_orders_order_id",
                        column: x => x.order_id,
                        principalTable: "orders",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.InsertData(
                table: "products",
                columns: new[] { "id", "active", "category", "created_at", "emoji", "name", "price" },
                values: new object[,]
                {
                    { 1, true, "Dry Clean", new DateTime(2026, 10, 31, 7, 44, 29, 416, DateTimeKind.Utc).AddTicks(3518), "👔", "Shirt", 100m },
                    { 2, true, "Dry Clean", new DateTime(2026, 10, 31, 7, 44, 29, 416, DateTimeKind.Utc).AddTicks(3523), "👖", "Pant", 100m },
                    { 3, true, "Dry Clean", new DateTime(2026, 10, 31, 7, 44, 29, 416, DateTimeKind.Utc).AddTicks(3525), "🧥", "Coat", 300m },
                    { 4, true, "Dry Clean", new DateTime(2026, 10, 31, 7, 44, 29, 416, DateTimeKind.Utc).AddTicks(3527), "👘", "Saree", 200m },
                    { 5, true, "Dry Clean", new DateTime(2026, 10, 31, 7, 44, 29, 416, DateTimeKind.Utc).AddTicks(3529), "🛏️", "Blanket", 250m },
                    { 6, true, "Dry Clean", new DateTime(2026, 10, 31, 7, 44, 29, 416, DateTimeKind.Utc).AddTicks(3530), "👗", "Kurta", 80m },
                    { 7, true, "Rafu", new DateTime(2026, 10, 31, 7, 44, 29, 416, DateTimeKind.Utc).AddTicks(3532), "🪡", "Shirt Repair", 50m },
                    { 8, true, "Rafu", new DateTime(2026, 10, 31, 7, 44, 29, 416, DateTimeKind.Utc).AddTicks(3534), "🪡", "Pant Repair", 60m },
                    { 9, true, "Rafu", new DateTime(2026, 10, 31, 7, 44, 29, 416, DateTimeKind.Utc).AddTicks(3535), "🔘", "Button Change", 20m },
                    { 10, true, "Rafu", new DateTime(2026, 10, 31, 7, 44, 29, 416, DateTimeKind.Utc).AddTicks(3537), "🔗", "Zip Change", 40m },
                    { 11, true, "Charak", new DateTime(2026, 10, 31, 7, 44, 29, 416, DateTimeKind.Utc).AddTicks(3538), "✂️", "Shirt Stitching", 150m },
                    { 12, true, "Charak", new DateTime(2026, 10, 31, 7, 44, 29, 416, DateTimeKind.Utc).AddTicks(3540), "✂️", "Pant Alteration", 100m },
                    { 13, true, "Charak", new DateTime(2026, 10, 31, 7, 44, 29, 416, DateTimeKind.Utc).AddTicks(3541), "📏", "Length Change", 80m }
                });

            migrationBuilder.InsertData(
                table: "settings",
                columns: new[] { "key", "value" },
                values: new object[,]
                {
                    { "barcode", "false" },
                    { "shop_address", "Shop No. 5, Main Market" },
                    { "shop_city", "Bhilwara, Rajasthan" },
                    { "shop_name", "DryClean Pro" },
                    { "shop_phone", "9876543210" },
                    { "sms", "false" },
                    { "whatsapp", "false" }
                });

            migrationBuilder.CreateIndex(
                name: "IX_order_history_order_id",
                table: "order_history",
                column: "order_id");

            migrationBuilder.CreateIndex(
                name: "IX_order_items_order_id",
                table: "order_items",
                column: "order_id");

            migrationBuilder.CreateIndex(
                name: "IX_orders_CustomerId",
                table: "orders",
                column: "CustomerId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "order_history");

            migrationBuilder.DropTable(
                name: "order_items");

            migrationBuilder.DropTable(
                name: "products");

            migrationBuilder.DropTable(
                name: "settings");

            migrationBuilder.DropTable(
                name: "orders");

            migrationBuilder.DropTable(
                name: "customers");

            migrationBuilder.DropSequence(
                name: "order_num_seq");
        }
    }
}
