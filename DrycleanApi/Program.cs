using Microsoft.EntityFrameworkCore;
using DrycleanApi.Data;
using DrycleanApi.Models;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("DefaultConnection")));

builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
        policy.WithOrigins("http://localhost:5173", "http://localhost:3000", "http://localhost:4173")
              .AllowAnyMethod()
              .AllowAnyHeader());
});

builder.Services.AddEndpointsApiExplorer();

var app = builder.Build();

// Auto-migrate on startup
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    db.Database.Migrate();
}

app.UseCors();

// ─── HEALTH ──────────────────────────────────────────────────
app.MapGet("/api/health", () => Results.Ok(new { status = "ok" }));

// ─── DASHBOARD ───────────────────────────────────────────────
app.MapGet("/api/dashboard/stats", async (AppDbContext db) =>
{
    var today = DateOnly.FromDateTime(DateTime.Today);
    var statuses = new[] { "Received","Processing","Completed","Packing","Ready","Delivered","Cancelled" };

    var allOrders = await db.Orders.Include(o => o.Items).OrderByDescending(o => o.CreatedAt).ToListAsync();
    var statusCounts = statuses.ToDictionary(s => s, s => allOrders.Count(o => o.Status == s));
    var recentOrders = allOrders.Take(6).ToList();

    var stats = new DashboardStats(
        TotalOrders: allOrders.Count,
        TodayOrders: allOrders.Count(o => o.EntryDate == today),
        PendingOrders: allOrders.Count(o => o.Status != "Delivered" && o.Status != "Cancelled"),
        ReadyOrders: allOrders.Count(o => o.Status == "Ready"),
        OverdueOrders: allOrders.Count(o => o.Status != "Delivered" && o.Status != "Cancelled" && o.DeliveryDate < today),
        TotalCollection: allOrders.Sum(o => o.Total),
        TodayCollection: allOrders.Where(o => o.EntryDate == today).Sum(o => o.Total),
        StatusCounts: statusCounts,
        RecentOrders: recentOrders
    );
    return Results.Ok(stats);
});

// ─── CUSTOMERS ───────────────────────────────────────────────
app.MapGet("/api/customers", async (AppDbContext db) =>
{
    var custs = await db.Customers.OrderByDescending(c => c.CreatedAt).ToListAsync();
    var orderCounts = await db.Orders.GroupBy(o => o.CustId)
        .Select(g => new { CustId = g.Key, Count = g.Count() }).ToListAsync();
    foreach (var c in custs)
        c.OrderCount = orderCounts.FirstOrDefault(x => x.CustId == c.Id)?.Count ?? 0;
    return Results.Ok(custs);
});

app.MapPost("/api/customers", async (AppDbContext db, Customer customer) =>
{
    customer.RegDate = DateOnly.FromDateTime(DateTime.Today);
    customer.CreatedAt = DateTime.UtcNow;
    db.Customers.Add(customer);
    await db.SaveChangesAsync();
    return Results.Created($"/api/customers/{customer.Id}", customer);
});

app.MapGet("/api/customers/{id:int}", async (AppDbContext db, int id) =>
    await db.Customers.FindAsync(id) is { } c ? Results.Ok(c) : Results.NotFound());

app.MapPut("/api/customers/{id:int}", async (AppDbContext db, int id, Customer input) =>
{
    var c = await db.Customers.FindAsync(id);
    if (c is null) return Results.NotFound();
    c.Name = input.Name; c.Mobile = input.Mobile; c.Address = input.Address; c.Email = input.Email;
    await db.SaveChangesAsync();
    return Results.Ok(c);
});

app.MapDelete("/api/customers/{id:int}", async (AppDbContext db, int id) =>
{
    var c = await db.Customers.FindAsync(id);
    if (c is null) return Results.NotFound();
    db.Customers.Remove(c);
    await db.SaveChangesAsync();
    return Results.Ok(new { message = "deleted" });
});

// ─── PRODUCTS ────────────────────────────────────────────────
app.MapGet("/api/products", async (AppDbContext db) =>
    Results.Ok(await db.Products.OrderBy(p => p.Category).ThenBy(p => p.Name).ToListAsync()));

app.MapPost("/api/products", async (AppDbContext db, Product product) =>
{
    product.CreatedAt = DateTime.UtcNow;
    db.Products.Add(product);
    await db.SaveChangesAsync();
    return Results.Created($"/api/products/{product.Id}", product);
});

app.MapGet("/api/products/{id:int}", async (AppDbContext db, int id) =>
    await db.Products.FindAsync(id) is { } p ? Results.Ok(p) : Results.NotFound());

app.MapPut("/api/products/{id:int}", async (AppDbContext db, int id, Product input) =>
{
    var p = await db.Products.FindAsync(id);
    if (p is null) return Results.NotFound();
    p.Name = input.Name; p.Category = input.Category; p.Price = input.Price;
    p.Emoji = input.Emoji; p.Active = input.Active;
    await db.SaveChangesAsync();
    return Results.Ok(p);
});

app.MapDelete("/api/products/{id:int}", async (AppDbContext db, int id) =>
{
    var p = await db.Products.FindAsync(id);
    if (p is null) return Results.NotFound();
    db.Products.Remove(p);
    await db.SaveChangesAsync();
    return Results.Ok(new { message = "deleted" });
});

// ─── ORDERS ──────────────────────────────────────────────────
app.MapGet("/api/orders", async (AppDbContext db, string? status, string? search, string? service) =>
{
    var q = db.Orders.AsQueryable();
    if (!string.IsNullOrEmpty(status)) q = q.Where(o => o.Status == status);
    if (!string.IsNullOrEmpty(search))
        q = q.Where(o => o.Id.Contains(search) || o.CustName.Contains(search) || o.Mobile.Contains(search));
    if (!string.IsNullOrEmpty(service))
        q = q.Where(o => o.Items.Any(i => i.Category == service));
    var orders = await q.OrderByDescending(o => o.CreatedAt).ToListAsync();
    return Results.Ok(orders);
});

app.MapPost("/api/orders", async (AppDbContext db, CreateOrderRequest req) =>
{
    var seq = await db.Database.SqlQueryRaw<long>("SELECT nextval('order_num_seq')").FirstAsync();
    var orderId = $"DC{seq}";
    var total = req.Items.Sum(i => i.Amount);
    var balance = Math.Max(0, total - req.Advance);

    var order = new Order
    {
        Id = orderId,
        CustId = req.CustId,
        CustName = req.CustName,
        Mobile = req.Mobile,
        EntryDate = DateOnly.Parse(req.EntryDate),
        DeliveryDate = DateOnly.Parse(req.DeliveryDate),
        Total = total,
        Advance = req.Advance,
        Balance = balance,
        PayMode = req.PayMode,
        Status = "Received",
        CreatedAt = DateTime.UtcNow,
        Items = req.Items.Select(i => new OrderItem
        {
            ProductName = i.ProductName,
            Category = i.Category,
            Qty = i.Qty,
            Rate = i.Rate,
            Amount = i.Amount
        }).ToList(),
        History = new List<OrderHistory>
        {
            new() { Status = "Received", UpdatedAt = DateTime.UtcNow, UpdatedBy = "Counter" }
        }
    };

    db.Orders.Add(order);
    await db.SaveChangesAsync();
    return Results.Created($"/api/orders/{orderId}", new { id = orderId, message = "order created" });
});

app.MapGet("/api/orders/{id}", async (AppDbContext db, string id) =>
{
    var order = await db.Orders
        .Include(o => o.Items)
        .Include(o => o.History)
        .FirstOrDefaultAsync(o => o.Id == id);
    return order is null ? Results.NotFound() : Results.Ok(order);
});

app.MapPut("/api/orders/{id}/status", async (AppDbContext db, string id, UpdateStatusRequest req) =>
{
    var order = await db.Orders.FindAsync(id);
    if (order is null) return Results.NotFound();
    order.Status = req.Status;
    db.OrderHistories.Add(new OrderHistory
    {
        OrderId = id,
        Status = req.Status,
        UpdatedAt = DateTime.UtcNow,
        UpdatedBy = req.UpdatedBy ?? "Admin",
        Note = req.Note ?? ""
    });
    await db.SaveChangesAsync();
    return Results.Ok(new { message = "status updated", status = req.Status });
});

// ─── REPORTS ─────────────────────────────────────────────────
app.MapGet("/api/reports/sales", async (AppDbContext db, string? from_date, string? to_date) =>
{
    var from = DateOnly.Parse(from_date ?? DateTime.Today.AddDays(-30).ToString("yyyy-MM-dd"));
    var to = DateOnly.Parse(to_date ?? DateTime.Today.ToString("yyyy-MM-dd"));

    var orders = await db.Orders
        .Include(o => o.Items)
        .Where(o => o.EntryDate >= from && o.EntryDate <= to)
        .ToListAsync();

    var rows = orders
        .GroupBy(o => o.EntryDate)
        .OrderByDescending(g => g.Key)
        .Select(g => new
        {
            date = g.Key.ToString("yyyy-MM-dd"),
            orders = g.Count(),
            amount = g.Sum(o => o.Total),
            advance = g.Sum(o => o.Advance),
            balance = g.Sum(o => o.Balance)
        }).ToList();

    var serviceRows = orders.SelectMany(o => o.Items)
        .GroupBy(i => i.Category)
        .Select(g => new { category = g.Key, items = g.Count(), revenue = g.Sum(i => i.Amount) })
        .OrderByDescending(x => x.revenue).ToList();

    return Results.Ok(new
    {
        from_date = from.ToString("yyyy-MM-dd"),
        to_date = to.ToString("yyyy-MM-dd"),
        total_orders = orders.Count,
        total_amount = orders.Sum(o => o.Total),
        total_advance = orders.Sum(o => o.Advance),
        total_balance = orders.Sum(o => o.Balance),
        rows,
        service_rows = serviceRows
    });
});

app.MapGet("/api/reports/delivery", async (AppDbContext db, string? filter) =>
{
    var today = DateOnly.FromDateTime(DateTime.Today);
    var tomorrow = today.AddDays(1);

    var q = db.Orders.Where(o => o.Status != "Delivered" && o.Status != "Cancelled");
    q = filter switch
    {
        "today" => q.Where(o => o.DeliveryDate == today),
        "tomorrow" => q.Where(o => o.DeliveryDate == tomorrow),
        "overdue" => q.Where(o => o.DeliveryDate < today),
        _ => q
    };

    var orders = await q.OrderBy(o => o.DeliveryDate).ToListAsync();
    var result = orders.Select(o => new
    {
        id = o.Id,
        cust_name = o.CustName,
        mobile = o.Mobile,
        delivery_date = o.DeliveryDate.ToString("yyyy-MM-dd"),
        total = o.Total,
        balance = o.Balance,
        status = o.Status,
        overdue_days = Math.Max(0, today.DayNumber - o.DeliveryDate.DayNumber)
    });
    return Results.Ok(result);
});

// ─── SETTINGS ────────────────────────────────────────────────
app.MapGet("/api/settings", async (AppDbContext db) =>
{
    var settings = await db.Settings.ToDictionaryAsync(s => s.Key, s => s.Value);
    bool.TryParse(settings.GetValueOrDefault("whatsapp", "false"), out var whatsapp);
    bool.TryParse(settings.GetValueOrDefault("barcode", "false"), out var barcode);
    bool.TryParse(settings.GetValueOrDefault("sms", "false"), out var sms);
    return Results.Ok(new SettingsDto(
        settings.GetValueOrDefault("shop_name", "DryClean Pro"),
        settings.GetValueOrDefault("shop_address", ""),
        settings.GetValueOrDefault("shop_city", ""),
        settings.GetValueOrDefault("shop_phone", ""),
        whatsapp, barcode, sms
    ));
});

app.MapPut("/api/settings", async (AppDbContext db, SettingsDto input) =>
{
    var updates = new Dictionary<string, string>
    {
        ["shop_name"] = input.ShopName,
        ["shop_address"] = input.ShopAddress,
        ["shop_city"] = input.ShopCity,
        ["shop_phone"] = input.ShopPhone,
        ["whatsapp"] = input.Whatsapp.ToString().ToLower(),
        ["barcode"] = input.Barcode.ToString().ToLower(),
        ["sms"] = input.Sms.ToString().ToLower(),
    };
    foreach (var kv in updates)
    {
        var s = await db.Settings.FindAsync(kv.Key);
        if (s is null) db.Settings.Add(new Setting { Key = kv.Key, Value = kv.Value });
        else s.Value = kv.Value;
    }
    await db.SaveChangesAsync();
    return Results.Ok(input);
});

app.Run();
