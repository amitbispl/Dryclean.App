using Microsoft.EntityFrameworkCore;
using DrycleanApi.Models;

namespace DrycleanApi.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    public DbSet<Company> Companies => Set<Company>();
    public DbSet<AppUser> Users => Set<AppUser>();
    public DbSet<Customer> Customers => Set<Customer>();
    public DbSet<Product> Products => Set<Product>();
    public DbSet<Order> Orders => Set<Order>();
    public DbSet<OrderItem> OrderItems => Set<OrderItem>();
    public DbSet<OrderHistory> OrderHistories => Set<OrderHistory>();
    public DbSet<Setting> Settings => Set<Setting>();
    public DbSet<ServiceCategory> ServiceCategories => Set<ServiceCategory>();
    public DbSet<SubscriptionPlan> SubscriptionPlans => Set<SubscriptionPlan>();
    public DbSet<CompanySubscription> CompanySubscriptions => Set<CompanySubscription>();

    protected override void OnModelCreating(ModelBuilder mb)
    {
        mb.Entity<Company>(e => {
            e.ToTable("companies");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasColumnName("id").UseIdentityAlwaysColumn();
            e.Property(x => x.Name).HasColumnName("name").HasMaxLength(100);
            e.Property(x => x.Address).HasColumnName("address").HasDefaultValue("");
            e.Property(x => x.City).HasColumnName("city").HasDefaultValue("");
            e.Property(x => x.Phone).HasColumnName("phone").HasDefaultValue("");
            e.Property(x => x.Email).HasColumnName("email").HasDefaultValue("");
            e.Property(x => x.Active).HasColumnName("active");
            e.Property(x => x.CreatedAt).HasColumnName("created_at");
            e.HasMany(x => x.Users).WithOne(u => u.Company).HasForeignKey(u => u.CompanyId).OnDelete(DeleteBehavior.SetNull);
        });

        mb.Entity<AppUser>(e => {
            e.ToTable("app_users");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasColumnName("id").UseIdentityAlwaysColumn();
            e.Property(x => x.CompanyId).HasColumnName("company_id");
            e.Property(x => x.Name).HasColumnName("name").HasMaxLength(100);
            e.Property(x => x.Username).HasColumnName("username").HasMaxLength(50);
            e.Property(x => x.PasswordHash).HasColumnName("password_hash");
            e.Property(x => x.Role).HasColumnName("role").HasMaxLength(20);
            e.Property(x => x.Active).HasColumnName("active");
            e.Property(x => x.CreatedAt).HasColumnName("created_at");
            e.HasIndex(x => x.Username).IsUnique();
        });

        mb.Entity<Customer>(e => {
            e.ToTable("customers");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasColumnName("id").UseIdentityAlwaysColumn();
            e.Property(x => x.CompanyId).HasColumnName("company_id");
            e.Property(x => x.Name).HasColumnName("name").HasMaxLength(100);
            e.Property(x => x.Mobile).HasColumnName("mobile").HasMaxLength(15);
            e.Property(x => x.Address).HasColumnName("address").HasDefaultValue("");
            e.Property(x => x.Email).HasColumnName("email").HasDefaultValue("");
            e.Property(x => x.CustomerType).HasColumnName("customer_type").HasMaxLength(20).HasDefaultValue("Regular");
            e.Property(x => x.RegDate).HasColumnName("reg_date");
            e.Property(x => x.CreatedAt).HasColumnName("created_at");
            e.Property(x => x.CreatedBy).HasColumnName("created_by").HasMaxLength(100).HasDefaultValue("");
            e.Property(x => x.CreatedByIp).HasColumnName("created_by_ip").HasMaxLength(50).HasDefaultValue("");
            e.HasIndex(x => new { x.CompanyId, x.Mobile }).IsUnique().HasFilter("company_id IS NOT NULL");
        });

        mb.Entity<Product>(e => {
            e.ToTable("products");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasColumnName("id").UseIdentityAlwaysColumn();
            e.Property(x => x.CompanyId).HasColumnName("company_id");
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
            e.Property(x => x.CompanyId).HasColumnName("company_id");
            e.Property(x => x.CustId).HasColumnName("cust_id");
            e.Property(x => x.CustName).HasColumnName("cust_name").HasMaxLength(100);
            e.Property(x => x.Mobile).HasColumnName("mobile").HasMaxLength(15);
            e.Property(x => x.CustomerType).HasColumnName("customer_type").HasMaxLength(20).HasDefaultValue("Regular");
            e.Property(x => x.EntryDate).HasColumnName("entry_date");
            e.Property(x => x.DeliveryDate).HasColumnName("delivery_date");
            e.Property(x => x.Total).HasColumnName("total").HasColumnType("numeric(10,2)");
            e.Property(x => x.Discount).HasColumnName("discount").HasColumnType("numeric(10,2)").HasDefaultValue(0m);
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
            e.Property(x => x.CompanyId).HasColumnName("company_id");
            e.Property(x => x.Value).HasColumnName("value");
        });

        mb.Entity<SubscriptionPlan>(e => {
            e.ToTable("subscription_plans");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasColumnName("id").UseIdentityAlwaysColumn();
            e.Property(x => x.Name).HasColumnName("name").HasMaxLength(50);
            e.Property(x => x.Price).HasColumnName("price").HasColumnType("numeric(10,2)");
            e.Property(x => x.MaxOrders).HasColumnName("max_orders").HasDefaultValue(0);
            e.Property(x => x.MaxUsers).HasColumnName("max_users").HasDefaultValue(0);
            e.Property(x => x.Description).HasColumnName("description").HasDefaultValue("");
            e.Property(x => x.BillingCycle).HasColumnName("billing_cycle").HasMaxLength(20).HasDefaultValue("Monthly");
            e.Property(x => x.Active).HasColumnName("active");
            e.Property(x => x.CreatedAt).HasColumnName("created_at");
        });

        mb.Entity<CompanySubscription>(e => {
            e.ToTable("company_subscriptions");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasColumnName("id").UseIdentityAlwaysColumn();
            e.Property(x => x.CompanyId).HasColumnName("company_id");
            e.Property(x => x.PlanId).HasColumnName("plan_id");
            e.Property(x => x.StartDate).HasColumnName("start_date");
            e.Property(x => x.EndDate).HasColumnName("end_date");
            e.Property(x => x.Status).HasColumnName("status").HasMaxLength(20).HasDefaultValue("Active");
            e.Property(x => x.PaymentMode).HasColumnName("payment_mode").HasMaxLength(20).HasDefaultValue("Cash");
            e.Property(x => x.AmountPaid).HasColumnName("amount_paid").HasColumnType("numeric(10,2)").HasDefaultValue(0m);
            e.Property(x => x.CreatedAt).HasColumnName("created_at");
            e.HasOne(x => x.Company).WithMany().HasForeignKey(x => x.CompanyId).OnDelete(DeleteBehavior.Cascade);
            e.HasOne(x => x.Plan).WithMany().HasForeignKey(x => x.PlanId).OnDelete(DeleteBehavior.Restrict);
        });

        mb.Entity<ServiceCategory>(e => {
            e.ToTable("service_categories");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasColumnName("id").UseIdentityAlwaysColumn();
            e.Property(x => x.CompanyId).HasColumnName("company_id");
            e.Property(x => x.Name).HasColumnName("name").HasMaxLength(100);
            e.Property(x => x.Active).HasColumnName("active");
            e.Property(x => x.CreatedAt).HasColumnName("created_at");
        });

        mb.HasSequence<long>("order_num_seq").StartsAt(10001).IncrementsBy(1);
    }
}
