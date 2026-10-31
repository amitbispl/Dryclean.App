using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Text.Json.Serialization;

namespace DrycleanApi.Models;

public class Customer
{
    public int Id { get; set; }
    [Required] public string Name { get; set; } = "";
    [Required] public string Mobile { get; set; } = "";
    public string Address { get; set; } = "";
    public string Email { get; set; } = "";
    public DateOnly RegDate { get; set; } = DateOnly.FromDateTime(DateTime.Today);
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    [JsonIgnore] public List<Order> Orders { get; set; } = new();
    [NotMapped] public int OrderCount { get; set; }
}

public class Product
{
    public int Id { get; set; }
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
    public int? CustId { get; set; }
    [Required] public string CustName { get; set; } = "";
    [Required] public string Mobile { get; set; } = "";
    public DateOnly EntryDate { get; set; } = DateOnly.FromDateTime(DateTime.Today);
    public DateOnly DeliveryDate { get; set; }
    public decimal Total { get; set; }
    public decimal Advance { get; set; }
    public decimal Balance { get; set; }
    public string PayMode { get; set; } = "Cash";
    public string Status { get; set; } = "Received";
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public Customer? Customer { get; set; }
    public List<OrderItem> Items { get; set; } = new();
    public List<OrderHistory> History { get; set; } = new();
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
    [Key] public string Key { get; set; } = "";
    public string Value { get; set; } = "";
}

// DTOs
public record CreateOrderRequest(
    int? CustId, string CustName, string Mobile,
    string EntryDate, string DeliveryDate,
    decimal Advance, string PayMode,
    List<OrderItemDto> Items);

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
