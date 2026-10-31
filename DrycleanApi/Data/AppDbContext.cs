using Microsoft.EntityFrameworkCore;
using DrycleanApi.Models;

namespace DrycleanApi.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    public DbSet<Customer> Customers => Set<Customer>();
    public DbSet<Product> Products => Set<Product>();
    public DbSet<Order> Orders => Set<Order>();
    public DbSet<OrderItem> OrderItems => Set<OrderItem>();
    public DbSet<OrderHistory> OrderHistories => Set<OrderHistory>();
    public DbSet<Setting> Settings => Set<Setting>();

    protected override void OnModelCreating(ModelBuilder mb)
    {
        mb.Entity<Customer>(e => {
            e.ToTable("customers");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasColumnName("id").UseIdentityAlwaysColumn();
            e.Property(x => x.Name).HasColumnName("name").HasMaxLength(100);
            e.Property(x => x.Mobile).HasColumnName("mobile").HasMaxLength(15);
            e.Property(x => x.Address).HasColumnName("address").HasDefaultValue("");
            e.Property(x => x.Email).HasColumnName("email").HasDefaultValue("");
            e.Property(x => x.RegDate).HasColumnName("reg_date");
            e.Property(x => x.CreatedAt).HasColumnName("created_at");
        });

        mb.Entity<Product>(e => {
            e.ToTable("products");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasColumnName("id").UseIdentityAlwaysColumn();
            e.Property(x => x.Name).HasColumnName("name").HasMaxLength(100);
            e.Property(x => x.Category).HasColumnName("category").HasMaxLength(20);
            e.Property(x => x.Price).HasColumnName("price").HasColumnType("numeric(10,2)");
            e.Property(x => x.Emoji).HasColumnName("emoji").HasDefaultValue("");
            e.Property(x => x.Active).HasColumnName("active");
            e.Property(x => x.CreatedAt).HasColumnName("created_at");
        });

        mb.Entity<Order>(e => {
            e.ToTable("orders");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasColumnName("id").HasMaxLength(20);
            e.Property(x => x.CustId).HasColumnName("cust_id");
            e.Property(x => x.CustName).HasColumnName("cust_name").HasMaxLength(100);
            e.Property(x => x.Mobile).HasColumnName("mobile").HasMaxLength(15);
            e.Property(x => x.EntryDate).HasColumnName("entry_date");
            e.Property(x => x.DeliveryDate).HasColumnName("delivery_date");
            e.Property(x => x.Total).HasColumnName("total").HasColumnType("numeric(10,2)");
            e.Property(x => x.Advance).HasColumnName("advance").HasColumnType("numeric(10,2)");
            e.Property(x => x.Balance).HasColumnName("balance").HasColumnType("numeric(10,2)");
            e.Property(x => x.PayMode).HasColumnName("pay_mode").HasMaxLength(20);
            e.Property(x => x.Status).HasColumnName("status").HasMaxLength(30);
            e.Property(x => x.CreatedAt).HasColumnName("created_at");
            e.HasMany(x => x.Items).WithOne(i => i.Order).HasForeignKey(i => i.OrderId).OnDelete(DeleteBehavior.Cascade);
            e.HasMany(x => x.History).WithOne(h => h.Order).HasForeignKey(h => h.OrderId).OnDelete(DeleteBehavior.Cascade);
        });

        mb.Entity<OrderItem>(e => {
            e.ToTable("order_items");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasColumnName("id").UseIdentityAlwaysColumn();
            e.Property(x => x.OrderId).HasColumnName("order_id").HasMaxLength(20);
            e.Property(x => x.ProductName).HasColumnName("product_name").HasMaxLength(100);
            e.Property(x => x.Category).HasColumnName("category").HasMaxLength(20);
            e.Property(x => x.Qty).HasColumnName("qty");
            e.Property(x => x.Rate).HasColumnName("rate").HasColumnType("numeric(10,2)");
            e.Property(x => x.Amount).HasColumnName("amount").HasColumnType("numeric(10,2)");
        });

        mb.Entity<OrderHistory>(e => {
            e.ToTable("order_history");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasColumnName("id").UseIdentityAlwaysColumn();
            e.Property(x => x.OrderId).HasColumnName("order_id").HasMaxLength(20);
            e.Property(x => x.Status).HasColumnName("status").HasMaxLength(30);
            e.Property(x => x.UpdatedAt).HasColumnName("updated_at");
            e.Property(x => x.UpdatedBy).HasColumnName("updated_by").HasMaxLength(50).HasDefaultValue("Admin");
            e.Property(x => x.Note).HasColumnName("note").HasDefaultValue("");
        });

        mb.Entity<Setting>(e => {
            e.ToTable("settings");
            e.HasKey(x => x.Key);
            e.Property(x => x.Key).HasColumnName("key").HasMaxLength(50);
            e.Property(x => x.Value).HasColumnName("value");
        });

        // Seed products
        mb.Entity<Product>().HasData(
            new Product { Id = 1, Name = "Shirt", Category = "Dry Clean", Price = 100, Emoji = "👔" },
            new Product { Id = 2, Name = "Pant", Category = "Dry Clean", Price = 100, Emoji = "👖" },
            new Product { Id = 3, Name = "Coat", Category = "Dry Clean", Price = 300, Emoji = "🧥" },
            new Product { Id = 4, Name = "Saree", Category = "Dry Clean", Price = 200, Emoji = "👘" },
            new Product { Id = 5, Name = "Blanket", Category = "Dry Clean", Price = 250, Emoji = "🛏️" },
            new Product { Id = 6, Name = "Kurta", Category = "Dry Clean", Price = 80, Emoji = "👗" },
            new Product { Id = 7, Name = "Shirt Repair", Category = "Rafu", Price = 50, Emoji = "🪡" },
            new Product { Id = 8, Name = "Pant Repair", Category = "Rafu", Price = 60, Emoji = "🪡" },
            new Product { Id = 9, Name = "Button Change", Category = "Rafu", Price = 20, Emoji = "🔘" },
            new Product { Id = 10, Name = "Zip Change", Category = "Rafu", Price = 40, Emoji = "🔗" },
            new Product { Id = 11, Name = "Shirt Stitching", Category = "Charak", Price = 150, Emoji = "✂️" },
            new Product { Id = 12, Name = "Pant Alteration", Category = "Charak", Price = 100, Emoji = "✂️" },
            new Product { Id = 13, Name = "Length Change", Category = "Charak", Price = 80, Emoji = "📏" }
        );

        // Seed settings
        mb.Entity<Setting>().HasData(
            new Setting { Key = "shop_name", Value = "DryClean Pro" },
            new Setting { Key = "shop_address", Value = "Shop No. 5, Main Market" },
            new Setting { Key = "shop_city", Value = "Bhilwara, Rajasthan" },
            new Setting { Key = "shop_phone", Value = "9876543210" },
            new Setting { Key = "whatsapp", Value = "false" },
            new Setting { Key = "barcode", Value = "false" },
            new Setting { Key = "sms", Value = "false" }
        );

        mb.HasSequence<long>("order_num_seq").StartsAt(10001).IncrementsBy(1);
    }
}
