using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace DrycleanApi.Migrations
{
    /// <inheritdoc />
    public partial class AddUserRolesAndCompanies : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DeleteData(
                table: "products",
                keyColumn: "id",
                keyValue: 1);

            migrationBuilder.DeleteData(
                table: "products",
                keyColumn: "id",
                keyValue: 2);

            migrationBuilder.DeleteData(
                table: "products",
                keyColumn: "id",
                keyValue: 3);

            migrationBuilder.DeleteData(
                table: "products",
                keyColumn: "id",
                keyValue: 4);

            migrationBuilder.DeleteData(
                table: "products",
                keyColumn: "id",
                keyValue: 5);

            migrationBuilder.DeleteData(
                table: "products",
                keyColumn: "id",
                keyValue: 6);

            migrationBuilder.DeleteData(
                table: "products",
                keyColumn: "id",
                keyValue: 7);

            migrationBuilder.DeleteData(
                table: "products",
                keyColumn: "id",
                keyValue: 8);

            migrationBuilder.DeleteData(
                table: "products",
                keyColumn: "id",
                keyValue: 9);

            migrationBuilder.DeleteData(
                table: "products",
                keyColumn: "id",
                keyValue: 10);

            migrationBuilder.DeleteData(
                table: "products",
                keyColumn: "id",
                keyValue: 11);

            migrationBuilder.DeleteData(
                table: "products",
                keyColumn: "id",
                keyValue: 12);

            migrationBuilder.DeleteData(
                table: "products",
                keyColumn: "id",
                keyValue: 13);

            migrationBuilder.DeleteData(
                table: "settings",
                keyColumn: "key",
                keyValue: "barcode");

            migrationBuilder.DeleteData(
                table: "settings",
                keyColumn: "key",
                keyValue: "shop_address");

            migrationBuilder.DeleteData(
                table: "settings",
                keyColumn: "key",
                keyValue: "shop_city");

            migrationBuilder.DeleteData(
                table: "settings",
                keyColumn: "key",
                keyValue: "shop_name");

            migrationBuilder.DeleteData(
                table: "settings",
                keyColumn: "key",
                keyValue: "shop_phone");

            migrationBuilder.DeleteData(
                table: "settings",
                keyColumn: "key",
                keyValue: "sms");

            migrationBuilder.DeleteData(
                table: "settings",
                keyColumn: "key",
                keyValue: "whatsapp");

            migrationBuilder.AddColumn<int>(
                name: "company_id",
                table: "settings",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "company_id",
                table: "products",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "company_id",
                table: "orders",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "company_id",
                table: "customers",
                type: "integer",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "companies",
                columns: table => new
                {
                    id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityAlwaysColumn),
                    name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    address = table.Column<string>(type: "text", nullable: false, defaultValue: ""),
                    city = table.Column<string>(type: "text", nullable: false, defaultValue: ""),
                    phone = table.Column<string>(type: "text", nullable: false, defaultValue: ""),
                    email = table.Column<string>(type: "text", nullable: false, defaultValue: ""),
                    active = table.Column<bool>(type: "boolean", nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_companies", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "app_users",
                columns: table => new
                {
                    id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityAlwaysColumn),
                    company_id = table.Column<int>(type: "integer", nullable: true),
                    name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    username = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    password_hash = table.Column<string>(type: "text", nullable: false),
                    role = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    active = table.Column<bool>(type: "boolean", nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_app_users", x => x.id);
                    table.ForeignKey(
                        name: "FK_app_users_companies_company_id",
                        column: x => x.company_id,
                        principalTable: "companies",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateIndex(
                name: "IX_app_users_company_id",
                table: "app_users",
                column: "company_id");

            migrationBuilder.CreateIndex(
                name: "IX_app_users_username",
                table: "app_users",
                column: "username",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "app_users");

            migrationBuilder.DropTable(
                name: "companies");

            migrationBuilder.DropColumn(
                name: "company_id",
                table: "settings");

            migrationBuilder.DropColumn(
                name: "company_id",
                table: "products");

            migrationBuilder.DropColumn(
                name: "company_id",
                table: "orders");

            migrationBuilder.DropColumn(
                name: "company_id",
                table: "customers");

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
        }
    }
}
