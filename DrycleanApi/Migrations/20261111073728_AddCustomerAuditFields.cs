using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace DrycleanApi.Migrations
{
    /// <inheritdoc />
    public partial class AddCustomerAuditFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "CreatedBy",
                table: "customers",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "CreatedByIp",
                table: "customers",
                type: "text",
                nullable: false,
                defaultValue: "");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "CreatedBy",
                table: "customers");

            migrationBuilder.DropColumn(
                name: "CreatedByIp",
                table: "customers");
        }
    }
}
