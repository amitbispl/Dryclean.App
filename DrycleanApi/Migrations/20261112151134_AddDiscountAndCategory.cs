using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace DrycleanApi.Migrations
{
    /// <inheritdoc />
    public partial class AddDiscountAndCategory : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.RenameColumn(
                name: "CreatedByIp",
                table: "customers",
                newName: "created_by_ip");

            migrationBuilder.RenameColumn(
                name: "CreatedBy",
                table: "customers",
                newName: "created_by");

            migrationBuilder.AddColumn<decimal>(
                name: "discount",
                table: "orders",
                type: "numeric(10,2)",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AlterColumn<string>(
                name: "created_by_ip",
                table: "customers",
                type: "character varying(50)",
                maxLength: 50,
                nullable: false,
                defaultValue: "",
                oldClrType: typeof(string),
                oldType: "text");

            migrationBuilder.AlterColumn<string>(
                name: "created_by",
                table: "customers",
                type: "character varying(100)",
                maxLength: 100,
                nullable: false,
                defaultValue: "",
                oldClrType: typeof(string),
                oldType: "text");

            migrationBuilder.CreateTable(
                name: "service_categories",
                columns: table => new
                {
                    id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityAlwaysColumn),
                    company_id = table.Column<int>(type: "integer", nullable: true),
                    name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    active = table.Column<bool>(type: "boolean", nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_service_categories", x => x.id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_customers_company_id_mobile",
                table: "customers",
                columns: new[] { "company_id", "mobile" },
                unique: true,
                filter: "company_id IS NOT NULL");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "service_categories");

            migrationBuilder.DropIndex(
                name: "IX_customers_company_id_mobile",
                table: "customers");

            migrationBuilder.DropColumn(
                name: "discount",
                table: "orders");

            migrationBuilder.RenameColumn(
                name: "created_by_ip",
                table: "customers",
                newName: "CreatedByIp");

            migrationBuilder.RenameColumn(
                name: "created_by",
                table: "customers",
                newName: "CreatedBy");

            migrationBuilder.AlterColumn<string>(
                name: "CreatedByIp",
                table: "customers",
                type: "text",
                nullable: false,
                oldClrType: typeof(string),
                oldType: "character varying(50)",
                oldMaxLength: 50,
                oldDefaultValue: "");

            migrationBuilder.AlterColumn<string>(
                name: "CreatedBy",
                table: "customers",
                type: "text",
                nullable: false,
                oldClrType: typeof(string),
                oldType: "character varying(100)",
                oldMaxLength: 100,
                oldDefaultValue: "");
        }
    }
}

