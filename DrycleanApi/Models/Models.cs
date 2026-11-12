using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Text.Json.Serialization;

namespace DrycleanApi.Models;

public class Company
{
    public int Id { get; set; }
    [Required] public string Name { get; set; } = "";
    public string Address { get; set; } = "";
    public string City { get; set; } = "";
    public string Phone { get; set; } = "";
    public string Email { get; set; } = "";
    public bool Active { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    [JsonIgnore] public List<AppUser> Users { get; set; } = new();
}

public class AppUser
{
    public int Id { get; set; }
    public int? CompanyId { get; set; }
    [Required] public string Name { get; set; } = "";
    [Required] public string Username { get; set; } = "";
    [JsonIgnore] public string PasswordHash { get; set; } = "";
    [Required] public string Role { get; set; } = "Counter";
    public bool Active { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    [JsonIgnore] public Company? Company { get; set; }
    [NotMapped] public string? CompanyName { get; set; }
}

public class Customer
{
    public int Id { get; set; }
    public int? CompanyId { get; set; }
    [Required] public string Name { get; set; } = "";
    [Required] public string Mobile { get; set; } = "";
    public string Address { get; set; } = "";
    public string Email { get; set; } = "";
    public string CustomerType { get; set; } = "Regular";
    public DateOnly RegDate { get; set; } = DateOnly.FromDateTime(DateTime.Today);
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public string CreatedBy { get; set; } = "";
    public string CreatedByIp { get; set; } = "";
    [JsonIgnore] public List<Order> Orders { get; set; } = new();
    [NotMapped] public int OrderCount { get; set; }
}

public class Product
{
    public int Id { get; set; }
    public int? CompanyId { get; set; }
    [Required] public string Name { get; set; } = "";
    [Required] public string Category { get; set; } = "Dry Clean";
    public decimal Price { get; set; }
    public string Emoji { get; set; } = "";
    public bool Active { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public class Order
{
    public string Id { get; set; } = "";
    public int? CompanyId { get; set; }
    public int? CustId { get; set; }
    [Required] public string CustName { get; set; } = "";
    [Required] public string Mobile { get; set; } = "";
    public string CustomerType { get; set; } = "Regular";
    public DateOnly EntryDate { get; set; } = DateOnly.FromDateTime(DateTime.Today);
    public DateOnly DeliveryDate { get; set; }
    public decimal Total { get; set; }
    public decimal Discount { get; set; } = 0;
    public decimal Advance { get; set; }
    public decimal Balance { get; set; }
    public string PayMode { get; set; } = "Cash";
    public string Status { get; set; } = "Received";
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public Customer? Customer { get; set; }
    public List<OrderItem> Items { get; set; } = new();
    public List<OrderHistory> History { get; set; } = new();
}

public class ServiceCategory
{
    public int Id { get; set; }
    public int? CompanyId { get; set; }
    [Required] public string Name { get; set; } = "";
    public bool Active { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public class SubscriptionPlan
{
    public int Id { get; set; }
    [Required] public string Name { get; set; } = "";
    public decimal Price { get; set; }
    public int MaxOrders { get; set; } = 0;
    public int MaxUsers { get; set; } = 0;
    public string Description { get; set; } = "";
    public string BillingCycle { get; set; } = "Monthly";
    public bool Active { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public class CompanySubscription
{
    public int Id { get; set; }
    public int CompanyId { get; set; }
    public int PlanId { get; set; }
    public DateOnly StartDate { get; set; }
    public DateOnly EndDate { get; set; }
    public string Status { get; set; } = "Active";
    public string PaymentMode { get; set; } = "Cash";
    public decimal AmountPaid { get; set; } = 0;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    [JsonIgnore] public Company? Company { get; set; }
    public SubscriptionPlan? Plan { get; set; }
}

public class OrderItem
{
    public int Id { get; set; }
    public string OrderId { get; set; } = "";
    [Required] public string ProductName { get; set; } = "";
    [Required] public string Category { get; set; } = "";
    public int Qty { get; set; } = 1;
    public decimal Rate { get; set; }
    public decimal Amount { get; set; }
    [JsonIgnore] public Order? Order { get; set; }
}

public class OrderHistory
{
    public int Id { get; set; }
    public string OrderId { get; set; } = "";
    [Required] public string Status { get; set; } = "";
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    public string UpdatedBy { get; set; } = "Admin";
    public string Note { get; set; } = "";
    [JsonIgnore] public Order? Order { get; set; }
}

public class Setting
{
    [Key, Column("key")] public string Key { get; set; } = "";
    [Column("company_id")] public int? CompanyId { get; set; }
    [Column("value")] public string Value { get; set; } = "";
}

// ─── DTOs ────────────────────────────────────────────────────────────────────

public record LoginRequest(string Username, string Password);
public record LoginResponse(string Token, UserInfo User);
public record UserInfo(int Id, string Name, string Username, string Role, int? CompanyId, string? CompanyName);

public record CreateUserRequest(string Name, string Username, string Password, string Role, int? CompanyId);
public record UpdateUserRequest(string Name, string Username, string Role, bool Active);
public record ChangePasswordRequest(string NewPassword);

public record CreateCompanyRequest(string Name, string Address, string City, string Phone, string Email);
public record UpdateCompanyRequest(string Name, string Address, string City, string Phone, string Email, bool Active);

public record CreateOrderRequest(
    int? CustId, string CustName, string Mobile,
    string CustomerType,
    string EntryDate, string DeliveryDate,
    decimal Advance, decimal Discount, string PayMode,
    List<OrderItemDto> Items);

public record CategoryDto(string Name);

public record CreateSubscriptionRequest(int CompanyId, int PlanId, string StartDate, string EndDate, string PaymentMode, decimal AmountPaid, string Status);
public record UpdateSubscriptionRequest(int PlanId, string StartDate, string EndDate, string PaymentMode, decimal AmountPaid, string Status);

public record OrderItemDto(string ProductName, string Category, int Qty, decimal Rate, decimal Amount);
public record UpdateStatusRequest(string Status, string? Note, string? UpdatedBy);

public record SettingsDto(
    string ShopName, string ShopAddress, string ShopCity, string ShopPhone,
    bool Whatsapp, bool Barcode, bool Sms);

public record DashboardStats(
    int TotalOrders, int TodayOrders, int PendingOrders,
    int ReadyOrders, int OverdueOrders,
    decimal TotalCollection, decimal TodayCollection,
    Dictionary<string, int> StatusCounts,
    List<Order> RecentOrders);
