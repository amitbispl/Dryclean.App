using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Npgsql;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using DrycleanApi.Data;
using DrycleanApi.Models;

var builder = WebApplication.CreateBuilder(args);

// ─── DB ──────────────────────────────────────────────────────────────────────
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("DefaultConnection")));

// ─── JWT AUTH ─────────────────────────────────────────────────────────────────
var jwtKey = builder.Configuration["Jwt:Key"]!;
var jwtIssuer = builder.Configuration["Jwt:Issuer"]!;
var jwtAudience = builder.Configuration["Jwt:Audience"]!;
var jwtExpiry = int.Parse(builder.Configuration["Jwt:ExpiryHours"] ?? "8");

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = jwtIssuer,
            ValidAudience = jwtAudience,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey))
        };
    });

builder.Services.AddAuthorization();

// ─── CORS ─────────────────────────────────────────────────────────────────────
builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
        policy.WithOrigins("http://localhost:5173", "http://localhost:3000", "http://localhost:4173", "https://localhost:63891")
              .AllowAnyMethod()
              .AllowAnyHeader());
});

builder.Services.AddEndpointsApiExplorer();

var app = builder.Build();

// ─── MIGRATE + SEED ───────────────────────────────────────────────────────────
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    try
    {

    // Self-heal: if subscription_plans table is missing but migration entry is present,
    // delete the stale history row so Migrate() re-applies the migration cleanly.
    try
    {
        var connStr = app.Configuration.GetConnectionString("DefaultConnection")!;
        using var healConn = new Npgsql.NpgsqlConnection(connStr);
        healConn.Open();
        using var checkCmd = healConn.CreateCommand();
        checkCmd.CommandText = "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='subscription_plans' AND table_schema='public')";
        var tableExists = (bool)(checkCmd.ExecuteScalar() ?? false);
        if (!tableExists)
        {
            using var delCmd = healConn.CreateCommand();
            delCmd.CommandText = "DELETE FROM \"__EFMigrationsHistory\" WHERE \"MigrationId\"='20261031090452_AddSubscriptionsAndCustomerType'";
            delCmd.ExecuteNonQuery();
            Console.WriteLine("[Self-heal] Removed stale migration entry — will re-apply.");
        }
    }
    catch (Exception ex)
    {
        Console.Error.WriteLine($"[Self-heal] Non-fatal check error: {ex.Message}");
    }

    db.Database.Migrate();

    // Seed default company if none exists
    if (!db.Companies.Any())
    {
        var company = new Company
        {
            Name = "WashMitra",
            Address = "Shop No. 5, Main Market",
            City = "Bhilwara, Rajasthan",
            Phone = "9876543210",
            Email = "",
            Active = true,
            CreatedAt = DateTime.UtcNow
        };
        db.Companies.Add(company);
        db.SaveChanges();

        // Seed default products for this company
        var products = new[]
        {
            new Product { CompanyId = company.Id, Name = "Shirt", Category = "Dry Clean", Price = 100, Emoji = "👔", CreatedAt = DateTime.UtcNow },
            new Product { CompanyId = company.Id, Name = "Pant", Category = "Dry Clean", Price = 100, Emoji = "👖", CreatedAt = DateTime.UtcNow },
            new Product { CompanyId = company.Id, Name = "Coat", Category = "Dry Clean", Price = 300, Emoji = "🧥", CreatedAt = DateTime.UtcNow },
            new Product { CompanyId = company.Id, Name = "Saree", Category = "Dry Clean", Price = 200, Emoji = "👘", CreatedAt = DateTime.UtcNow },
            new Product { CompanyId = company.Id, Name = "Blanket", Category = "Dry Clean", Price = 250, Emoji = "🛏️", CreatedAt = DateTime.UtcNow },
            new Product { CompanyId = company.Id, Name = "Kurta", Category = "Dry Clean", Price = 80, Emoji = "👗", CreatedAt = DateTime.UtcNow },
            new Product { CompanyId = company.Id, Name = "Shirt Repair", Category = "Rafu", Price = 50, Emoji = "🪡", CreatedAt = DateTime.UtcNow },
            new Product { CompanyId = company.Id, Name = "Pant Repair", Category = "Rafu", Price = 60, Emoji = "🪡", CreatedAt = DateTime.UtcNow },
            new Product { CompanyId = company.Id, Name = "Button Change", Category = "Rafu", Price = 20, Emoji = "🔘", CreatedAt = DateTime.UtcNow },
            new Product { CompanyId = company.Id, Name = "Zip Change", Category = "Rafu", Price = 40, Emoji = "🔗", CreatedAt = DateTime.UtcNow },
            new Product { CompanyId = company.Id, Name = "Shirt Stitching", Category = "Charak", Price = 150, Emoji = "✂️", CreatedAt = DateTime.UtcNow },
            new Product { CompanyId = company.Id, Name = "Pant Alteration", Category = "Charak", Price = 100, Emoji = "✂️", CreatedAt = DateTime.UtcNow },
            new Product { CompanyId = company.Id, Name = "Length Change", Category = "Charak", Price = 80, Emoji = "📏", CreatedAt = DateTime.UtcNow }
        };
        db.Products.AddRange(products);

        // Seed settings for this company
        var settings = new[]
        {
            new Setting { Key = $"shop_name_{company.Id}", CompanyId = company.Id, Value = "WashMitra" },
            new Setting { Key = $"shop_address_{company.Id}", CompanyId = company.Id, Value = "Shop No. 5, Main Market" },
            new Setting { Key = $"shop_city_{company.Id}", CompanyId = company.Id, Value = "Bhilwara, Rajasthan" },
            new Setting { Key = $"shop_phone_{company.Id}", CompanyId = company.Id, Value = "9876543210" },
            new Setting { Key = $"whatsapp_{company.Id}", CompanyId = company.Id, Value = "false" },
            new Setting { Key = $"barcode_{company.Id}", CompanyId = company.Id, Value = "false" },
            new Setting { Key = $"sms_{company.Id}", CompanyId = company.Id, Value = "false" },
        };
        db.Settings.AddRange(settings);
        db.SaveChanges();

        // Seed admin user for this company
        db.Users.Add(new AppUser
        {
            CompanyId = company.Id,
            Name = "Admin",
            Username = "admin",
            PasswordHash = BCrypt.Net.BCrypt.HashPassword("Admin@123"),
            Role = "Admin",
            Active = true,
            CreatedAt = DateTime.UtcNow
        });
        db.SaveChanges();
    }

    // Seed SuperAdmin if not exists
    if (!db.Users.Any(u => u.Role == "SuperAdmin"))
    {
        db.Users.Add(new AppUser
        {
            CompanyId = null,
            Name = "Super Admin",
            Username = "superadmin",
            PasswordHash = BCrypt.Net.BCrypt.HashPassword("Admin@123"),
            Role = "SuperAdmin",
            Active = true,
            CreatedAt = DateTime.UtcNow
        });
        db.SaveChanges();
    }

    // Seed subscription plans if none exist
    if (!db.SubscriptionPlans.Any())
    {
        var plans = new[]
        {
            new SubscriptionPlan { Name = "Free", Price = 0, MaxOrders = 50, MaxUsers = 2, Description = "Get started for free", BillingCycle = "Monthly", Active = true, CreatedAt = DateTime.UtcNow },
            new SubscriptionPlan { Name = "Basic", Price = 999, MaxOrders = 500, MaxUsers = 5, Description = "For small shops", BillingCycle = "Monthly", Active = true, CreatedAt = DateTime.UtcNow },
            new SubscriptionPlan { Name = "Premium", Price = 2499, MaxOrders = 0, MaxUsers = 15, Description = "Unlimited orders, 15 users", BillingCycle = "Monthly", Active = true, CreatedAt = DateTime.UtcNow },
            new SubscriptionPlan { Name = "Enterprise", Price = 4999, MaxOrders = 0, MaxUsers = 0, Description = "Unlimited everything", BillingCycle = "Monthly", Active = true, CreatedAt = DateTime.UtcNow },
            new SubscriptionPlan { Name = "Enterprise Yearly", Price = 14999, MaxOrders = 0, MaxUsers = 0, Description = "Best value - annual plan", BillingCycle = "Yearly", Active = true, CreatedAt = DateTime.UtcNow },
        };
        db.SubscriptionPlans.AddRange(plans);
        db.SaveChanges();
    }

    // Seed trial subscription for the first company if no subscription exists
    var firstCompany = db.Companies.FirstOrDefault();
    if (firstCompany != null && !db.CompanySubscriptions.Any(s => s.CompanyId == firstCompany.Id))
    {
        var premiumPlan = db.SubscriptionPlans.FirstOrDefault(p => p.Name == "Premium");
        if (premiumPlan != null)
        {
            db.CompanySubscriptions.Add(new CompanySubscription
            {
                CompanyId = firstCompany.Id,
                PlanId = premiumPlan.Id,
                StartDate = DateOnly.FromDateTime(DateTime.Today),
                EndDate = DateOnly.FromDateTime(DateTime.Today.AddDays(30)),
                Status = "Trial",
                PaymentMode = "Cash",
                AmountPaid = 0,
                CreatedAt = DateTime.UtcNow
            });
            db.SaveChanges();
        }
    }
    } // end outer try
    catch (Exception ex)
    {
        Console.Error.WriteLine("=== STARTUP ERROR ===");
        Console.Error.WriteLine(ex.ToString());
        Console.Error.Flush();
        throw;
    }
}

app.UseCors();
app.UseAuthentication();
app.UseAuthorization();

// ─── JWT HELPER ───────────────────────────────────────────────────────────────
string GenerateToken(AppUser user, string? companyName)
{
    var claims = new[]
    {
        new Claim(JwtRegisteredClaimNames.Sub, user.Id.ToString()),
        new Claim("userId", user.Id.ToString()),
        new Claim("username", user.Username),
        new Claim("name", user.Name),
        new Claim("role", user.Role),
        new Claim("companyId", user.CompanyId?.ToString() ?? ""),
        new Claim("companyName", companyName ?? ""),
    };
    var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey));
    var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);
    var token = new JwtSecurityToken(
        issuer: jwtIssuer, audience: jwtAudience, claims: claims,
        expires: DateTime.UtcNow.AddHours(jwtExpiry), signingCredentials: creds);
    return new JwtSecurityTokenHandler().WriteToken(token);
}

int? GetCompanyId(ClaimsPrincipal user)
{
    var val = user.FindFirst("companyId")?.Value;
    return string.IsNullOrEmpty(val) ? null : int.Parse(val);
}

string GetRole(ClaimsPrincipal user) => user.FindFirst("role")?.Value ?? "";
int GetUserId(ClaimsPrincipal user) => int.Parse(user.FindFirst("userId")?.Value ?? "0");
string GetUserName(ClaimsPrincipal user) => user.FindFirst("name")?.Value ?? "Admin";

async Task<IResult?> CheckSubscription(AppDbContext db, ClaimsPrincipal claims)
{
    var companyId = GetCompanyId(claims);
    var role = GetRole(claims);
    if (role == "SuperAdmin" || !companyId.HasValue) return null;
    var today = DateOnly.FromDateTime(DateTime.Today);
    var sub = await db.CompanySubscriptions
        .Where(s => s.CompanyId == companyId.Value)
        .OrderByDescending(s => s.EndDate)
        .FirstOrDefaultAsync();
    if (sub == null) return Results.Json(new { error = "No active subscription. Please contact admin.", expired = true }, statusCode: 403);
    if (sub.EndDate < today || sub.Status == "Expired" || sub.Status == "Cancelled")
        return Results.Json(new { error = "Subscription expired. Please renew.", expired = true }, statusCode: 403);
    return null;
}

// ─── HEALTH ───────────────────────────────────────────────────────────────────
app.MapGet("/api/health", () => Results.Ok(new { status = "ok" }));

// ─── AUTH ─────────────────────────────────────────────────────────────────────
app.MapPost("/api/auth/login", async (AppDbContext db, LoginRequest req) =>
{
    var user = await db.Users.Include(u => u.Company)
        .FirstOrDefaultAsync(u => u.Username == req.Username && u.Active);
    if (user is null || !BCrypt.Net.BCrypt.Verify(req.Password, user.PasswordHash))
        return Results.Unauthorized();

    var companyName = user.Company?.Name;
    var token = GenerateToken(user, companyName);
    return Results.Ok(new LoginResponse(
        token,
        new UserInfo(user.Id, user.Name, user.Username, user.Role, user.CompanyId, companyName)
    ));
});

app.MapGet("/api/auth/me", (ClaimsPrincipal claims, AppDbContext db) =>
{
    var userId = GetUserId(claims);
    var user = db.Users.Include(u => u.Company).FirstOrDefault(u => u.Id == userId);
    if (user is null) return Results.Unauthorized();
    return Results.Ok(new UserInfo(user.Id, user.Name, user.Username, user.Role, user.CompanyId, user.Company?.Name));
}).RequireAuthorization();

// ─── COMPANIES ────────────────────────────────────────────────────────────────
app.MapGet("/api/companies", async (AppDbContext db, ClaimsPrincipal claims) =>
{
    if (GetRole(claims) != "SuperAdmin") return Results.Forbid();
    var companies = await db.Companies.OrderByDescending(c => c.CreatedAt).ToListAsync();
    return Results.Ok(companies);
}).RequireAuthorization();

app.MapPost("/api/companies", async (AppDbContext db, ClaimsPrincipal claims, CreateCompanyRequest req) =>
{
    if (GetRole(claims) != "SuperAdmin") return Results.Forbid();
    var company = new Company { Name = req.Name, Address = req.Address, City = req.City, Phone = req.Phone, Email = req.Email, CreatedAt = DateTime.UtcNow };
    db.Companies.Add(company);
    await db.SaveChangesAsync();
    // Seed default settings for new company
    var settings = new[]
    {
        new Setting { Key = $"shop_name_{company.Id}", CompanyId = company.Id, Value = req.Name },
        new Setting { Key = $"shop_address_{company.Id}", CompanyId = company.Id, Value = req.Address },
        new Setting { Key = $"shop_city_{company.Id}", CompanyId = company.Id, Value = req.City },
        new Setting { Key = $"shop_phone_{company.Id}", CompanyId = company.Id, Value = req.Phone },
        new Setting { Key = $"whatsapp_{company.Id}", CompanyId = company.Id, Value = "false" },
        new Setting { Key = $"barcode_{company.Id}", CompanyId = company.Id, Value = "false" },
        new Setting { Key = $"sms_{company.Id}", CompanyId = company.Id, Value = "false" },
    };
    db.Settings.AddRange(settings);
    await db.SaveChangesAsync();
    return Results.Created($"/api/companies/{company.Id}", company);
}).RequireAuthorization();

app.MapPut("/api/companies/{id:int}", async (AppDbContext db, ClaimsPrincipal claims, int id, UpdateCompanyRequest req) =>
{
    if (GetRole(claims) != "SuperAdmin") return Results.Forbid();
    var c = await db.Companies.FindAsync(id);
    if (c is null) return Results.NotFound();
    c.Name = req.Name; c.Address = req.Address; c.City = req.City;
    c.Phone = req.Phone; c.Email = req.Email; c.Active = req.Active;
    await db.SaveChangesAsync();
    return Results.Ok(c);
}).RequireAuthorization();

// ─── USERS ────────────────────────────────────────────────────────────────────
app.MapGet("/api/users", async (AppDbContext db, ClaimsPrincipal claims) =>
{
    var role = GetRole(claims);
    var companyId = GetCompanyId(claims);
    var q = db.Users.Include(u => u.Company).AsQueryable();
    if (role != "SuperAdmin") q = q.Where(u => u.CompanyId == companyId);
    var users = await q.OrderByDescending(u => u.CreatedAt).ToListAsync();
    var result = users.Select(u => new
    {
        u.Id, u.Name, u.Username, u.Role, u.Active, u.CompanyId, u.CreatedAt,
        CompanyName = u.Company?.Name
    });
    return Results.Ok(result);
}).RequireAuthorization();

app.MapPost("/api/users", async (AppDbContext db, ClaimsPrincipal claims, CreateUserRequest req) =>
{
    var role = GetRole(claims);
    var companyId = GetCompanyId(claims);
    // Only SuperAdmin can create for any company; Admin can only create for their own company
    if (role != "SuperAdmin" && req.CompanyId != companyId) return Results.Forbid();
    if (role == "Counter" || role == "Staff") return Results.Forbid();
    if (await db.Users.AnyAsync(u => u.Username == req.Username)) return Results.Conflict(new { message = "Username already exists" });
    var user = new AppUser
    {
        CompanyId = req.CompanyId,
        Name = req.Name,
        Username = req.Username,
        PasswordHash = BCrypt.Net.BCrypt.HashPassword(req.Password),
        Role = req.Role,
        Active = true,
        CreatedAt = DateTime.UtcNow
    };
    db.Users.Add(user);
    await db.SaveChangesAsync();
    return Results.Created($"/api/users/{user.Id}", new { user.Id, user.Name, user.Username, user.Role, user.Active, user.CompanyId });
}).RequireAuthorization();

app.MapPut("/api/users/{id:int}", async (AppDbContext db, ClaimsPrincipal claims, int id, UpdateUserRequest req) =>
{
    var role = GetRole(claims);
    var companyId = GetCompanyId(claims);
    var user = await db.Users.FindAsync(id);
    if (user is null) return Results.NotFound();
    if (role != "SuperAdmin" && user.CompanyId != companyId) return Results.Forbid();
    user.Name = req.Name; user.Username = req.Username; user.Role = req.Role; user.Active = req.Active;
    await db.SaveChangesAsync();
    return Results.Ok(new { user.Id, user.Name, user.Username, user.Role, user.Active, user.CompanyId });
}).RequireAuthorization();

app.MapDelete("/api/users/{id:int}", async (AppDbContext db, ClaimsPrincipal claims, int id) =>
{
    var role = GetRole(claims);
    var companyId = GetCompanyId(claims);
    var user = await db.Users.FindAsync(id);
    if (user is null) return Results.NotFound();
    if (role != "SuperAdmin" && user.CompanyId != companyId) return Results.Forbid();
    user.Active = false; // soft delete
    await db.SaveChangesAsync();
    return Results.Ok(new { message = "User deactivated" });
}).RequireAuthorization();

app.MapPut("/api/users/{id:int}/password", async (AppDbContext db, ClaimsPrincipal claims, int id, ChangePasswordRequest req) =>
{
    var role = GetRole(claims);
    var companyId = GetCompanyId(claims);
    var myUserId = GetUserId(claims);
    var user = await db.Users.FindAsync(id);
    if (user is null) return Results.NotFound();
    // Can change own password, or Admin can change company users, SuperAdmin can change any
    if (myUserId != id && role != "SuperAdmin" && user.CompanyId != companyId) return Results.Forbid();
    user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(req.NewPassword);
    await db.SaveChangesAsync();
    return Results.Ok(new { message = "Password changed" });
}).RequireAuthorization();

// ─── DASHBOARD ────────────────────────────────────────────────────────────────
app.MapGet("/api/dashboard/stats", async (AppDbContext db, ClaimsPrincipal claims) =>
{
    var today = DateOnly.FromDateTime(DateTime.Today);
    var companyId = GetCompanyId(claims);
    var statuses = new[] { "Received","Processing","Completed","Packing","Ready","Delivered","Cancelled" };

    var q = db.Orders.Include(o => o.Items).AsQueryable();
    if (companyId.HasValue) q = q.Where(o => o.CompanyId == companyId);
    var allOrders = await q.OrderByDescending(o => o.CreatedAt).ToListAsync();
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
}).RequireAuthorization();

// ─── CUSTOMERS ────────────────────────────────────────────────────────────────
app.MapGet("/api/customers", async (AppDbContext db, ClaimsPrincipal claims) =>
{
    var companyId = GetCompanyId(claims);
    var q = db.Customers.AsQueryable();
    if (companyId.HasValue) q = q.Where(c => c.CompanyId == companyId);
    var custs = await q.OrderByDescending(c => c.CreatedAt).ToListAsync();
    var orderCounts = await db.Orders.GroupBy(o => o.CustId)
        .Select(g => new { CustId = g.Key, Count = g.Count() }).ToListAsync();
    foreach (var c in custs)
        c.OrderCount = orderCounts.FirstOrDefault(x => x.CustId == c.Id)?.Count ?? 0;
    return Results.Ok(custs);
}).RequireAuthorization();

app.MapPost("/api/customers", async (AppDbContext db, ClaimsPrincipal claims, Customer customer) =>
{
    customer.CompanyId = GetCompanyId(claims);
    customer.RegDate = DateOnly.FromDateTime(DateTime.Today);
    customer.CreatedAt = DateTime.UtcNow;
    db.Customers.Add(customer);
    await db.SaveChangesAsync();
    return Results.Created($"/api/customers/{customer.Id}", customer);
}).RequireAuthorization();

app.MapGet("/api/customers/{id:int}", async (AppDbContext db, ClaimsPrincipal claims, int id) =>
{
    var companyId = GetCompanyId(claims);
    var c = await db.Customers.FindAsync(id);
    if (c is null) return Results.NotFound();
    if (companyId.HasValue && c.CompanyId != companyId) return Results.Forbid();
    return Results.Ok(c);
}).RequireAuthorization();

app.MapPut("/api/customers/{id:int}", async (AppDbContext db, ClaimsPrincipal claims, int id, Customer input) =>
{
    var companyId = GetCompanyId(claims);
    var c = await db.Customers.FindAsync(id);
    if (c is null) return Results.NotFound();
    if (companyId.HasValue && c.CompanyId != companyId) return Results.Forbid();
    c.Name = input.Name; c.Mobile = input.Mobile; c.Address = input.Address; c.Email = input.Email;
    c.CustomerType = input.CustomerType ?? c.CustomerType;
    await db.SaveChangesAsync();
    return Results.Ok(c);
}).RequireAuthorization();

app.MapDelete("/api/customers/{id:int}", async (AppDbContext db, ClaimsPrincipal claims, int id) =>
{
    var companyId = GetCompanyId(claims);
    var c = await db.Customers.FindAsync(id);
    if (c is null) return Results.NotFound();
    if (companyId.HasValue && c.CompanyId != companyId) return Results.Forbid();
    db.Customers.Remove(c);
    await db.SaveChangesAsync();
    return Results.Ok(new { message = "deleted" });
}).RequireAuthorization();

// ─── PRODUCTS ─────────────────────────────────────────────────────────────────
app.MapGet("/api/products", async (AppDbContext db, ClaimsPrincipal claims) =>
{
    var companyId = GetCompanyId(claims);
    var q = db.Products.AsQueryable();
    if (companyId.HasValue) q = q.Where(p => p.CompanyId == companyId);
    return Results.Ok(await q.OrderBy(p => p.Category).ThenBy(p => p.Name).ToListAsync());
}).RequireAuthorization();

app.MapPost("/api/products", async (AppDbContext db, ClaimsPrincipal claims, Product product) =>
{
    product.CompanyId = GetCompanyId(claims);
    product.CreatedAt = DateTime.UtcNow;
    db.Products.Add(product);
    await db.SaveChangesAsync();
    return Results.Created($"/api/products/{product.Id}", product);
}).RequireAuthorization();

app.MapGet("/api/products/{id:int}", async (AppDbContext db, ClaimsPrincipal claims, int id) =>
{
    var p = await db.Products.FindAsync(id);
    return p is null ? Results.NotFound() : Results.Ok(p);
}).RequireAuthorization();

app.MapPut("/api/products/{id:int}", async (AppDbContext db, ClaimsPrincipal claims, int id, Product input) =>
{
    var p = await db.Products.FindAsync(id);
    if (p is null) return Results.NotFound();
    p.Name = input.Name; p.Category = input.Category; p.Price = input.Price;
    p.Emoji = input.Emoji; p.Active = input.Active;
    await db.SaveChangesAsync();
    return Results.Ok(p);
}).RequireAuthorization();

app.MapDelete("/api/products/{id:int}", async (AppDbContext db, ClaimsPrincipal claims, int id) =>
{
    var p = await db.Products.FindAsync(id);
    if (p is null) return Results.NotFound();
    db.Products.Remove(p);
    await db.SaveChangesAsync();
    return Results.Ok(new { message = "deleted" });
}).RequireAuthorization();

// ─── ORDERS ───────────────────────────────────────────────────────────────────
app.MapGet("/api/orders", async (AppDbContext db, ClaimsPrincipal claims, string? status, string? search, string? service) =>
{
    var companyId = GetCompanyId(claims);
    var q = db.Orders.AsQueryable();
    if (companyId.HasValue) q = q.Where(o => o.CompanyId == companyId);
    if (!string.IsNullOrEmpty(status)) q = q.Where(o => o.Status == status);
    if (!string.IsNullOrEmpty(search))
        q = q.Where(o => o.Id.Contains(search) || o.CustName.Contains(search) || o.Mobile.Contains(search));
    if (!string.IsNullOrEmpty(service))
        q = q.Where(o => o.Items.Any(i => i.Category == service));
    var orders = await q.OrderByDescending(o => o.CreatedAt).ToListAsync();
    return Results.Ok(orders);
}).RequireAuthorization();

app.MapPost("/api/orders", async (AppDbContext db, ClaimsPrincipal claims, CreateOrderRequest req) =>
{
    var companyId = GetCompanyId(claims);
    var userName = GetUserName(claims);
    var seq = await db.Database.SqlQueryRaw<long>("SELECT nextval('order_num_seq') AS \"Value\"").FirstAsync();
    var orderId = $"DC{seq}";
    var total = req.Items.Sum(i => i.Amount);
    var balance = Math.Max(0, total - req.Advance);

    var order = new Order
    {
        Id = orderId,
        CompanyId = companyId,
        CustId = req.CustId,
        CustName = req.CustName,
        Mobile = req.Mobile,
        CustomerType = req.CustomerType ?? "Regular",
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
            ProductName = i.ProductName, Category = i.Category,
            Qty = i.Qty, Rate = i.Rate, Amount = i.Amount
        }).ToList(),
        History = new List<OrderHistory>
        {
            new() { Status = "Received", UpdatedAt = DateTime.UtcNow, UpdatedBy = userName }
        }
    };

    db.Orders.Add(order);
    await db.SaveChangesAsync();
    return Results.Created($"/api/orders/{orderId}", new { id = orderId, message = "order created" });
}).RequireAuthorization();

app.MapGet("/api/orders/{id}", async (AppDbContext db, ClaimsPrincipal claims, string id) =>
{
    var order = await db.Orders
        .Include(o => o.Items)
        .Include(o => o.History)
        .FirstOrDefaultAsync(o => o.Id == id);
    return order is null ? Results.NotFound() : Results.Ok(order);
}).RequireAuthorization();

app.MapPut("/api/orders/{id}/status", async (AppDbContext db, ClaimsPrincipal claims, string id, UpdateStatusRequest req) =>
{
    var userName = GetUserName(claims);
    var order = await db.Orders.FindAsync(id);
    if (order is null) return Results.NotFound();
    order.Status = req.Status;
    db.OrderHistories.Add(new OrderHistory
    {
        OrderId = id, Status = req.Status,
        UpdatedAt = DateTime.UtcNow,
        UpdatedBy = req.UpdatedBy ?? userName,
        Note = req.Note ?? ""
    });
    await db.SaveChangesAsync();
    return Results.Ok(new { message = "status updated", status = req.Status });
}).RequireAuthorization();

// ─── REPORTS ──────────────────────────────────────────────────────────────────
app.MapGet("/api/reports/sales", async (AppDbContext db, ClaimsPrincipal claims, string? from_date, string? to_date) =>
{
    var companyId = GetCompanyId(claims);
    var from = DateOnly.Parse(from_date ?? DateTime.Today.AddDays(-30).ToString("yyyy-MM-dd"));
    var to = DateOnly.Parse(to_date ?? DateTime.Today.ToString("yyyy-MM-dd"));

    var q = db.Orders.Include(o => o.Items).Where(o => o.EntryDate >= from && o.EntryDate <= to);
    if (companyId.HasValue) q = q.Where(o => o.CompanyId == companyId);
    var orders = await q.ToListAsync();

    var rows = orders.GroupBy(o => o.EntryDate).OrderByDescending(g => g.Key)
        .Select(g => new { date = g.Key.ToString("yyyy-MM-dd"), orders = g.Count(), amount = g.Sum(o => o.Total), advance = g.Sum(o => o.Advance), balance = g.Sum(o => o.Balance) }).ToList();
    var serviceRows = orders.SelectMany(o => o.Items).GroupBy(i => i.Category)
        .Select(g => new { category = g.Key, items = g.Count(), revenue = g.Sum(i => i.Amount) }).OrderByDescending(x => x.revenue).ToList();

    return Results.Ok(new { from_date = from.ToString("yyyy-MM-dd"), to_date = to.ToString("yyyy-MM-dd"), total_orders = orders.Count, total_amount = orders.Sum(o => o.Total), total_advance = orders.Sum(o => o.Advance), total_balance = orders.Sum(o => o.Balance), rows, service_rows = serviceRows });
}).RequireAuthorization();

app.MapGet("/api/reports/delivery", async (AppDbContext db, ClaimsPrincipal claims, string? filter) =>
{
    var companyId = GetCompanyId(claims);
    var today = DateOnly.FromDateTime(DateTime.Today);
    var tomorrow = today.AddDays(1);

    var q = db.Orders.Where(o => o.Status != "Delivered" && o.Status != "Cancelled");
    if (companyId.HasValue) q = q.Where(o => o.CompanyId == companyId);
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
        id = o.Id, cust_name = o.CustName, mobile = o.Mobile,
        delivery_date = o.DeliveryDate.ToString("yyyy-MM-dd"),
        total = o.Total, balance = o.Balance, status = o.Status,
        overdue_days = Math.Max(0, today.DayNumber - o.DeliveryDate.DayNumber)
    });
    return Results.Ok(result);
}).RequireAuthorization();

// ─── SETTINGS ─────────────────────────────────────────────────────────────────
app.MapGet("/api/settings", async (AppDbContext db, ClaimsPrincipal claims) =>
{
    var companyId = GetCompanyId(claims);
    var prefix = companyId.HasValue ? $"_{companyId}" : "";
    var allSettings = await db.Settings.Where(s => s.CompanyId == companyId).ToDictionaryAsync(s => s.Key, s => s.Value);
    bool.TryParse(allSettings.GetValueOrDefault($"whatsapp{prefix}", "false"), out var whatsapp);
    bool.TryParse(allSettings.GetValueOrDefault($"barcode{prefix}", "false"), out var barcode);
    bool.TryParse(allSettings.GetValueOrDefault($"sms{prefix}", "false"), out var sms);
    return Results.Ok(new SettingsDto(
        allSettings.GetValueOrDefault($"shop_name{prefix}", "DryClean Pro"),
        allSettings.GetValueOrDefault($"shop_address{prefix}", ""),
        allSettings.GetValueOrDefault($"shop_city{prefix}", ""),
        allSettings.GetValueOrDefault($"shop_phone{prefix}", ""),
        whatsapp, barcode, sms));
}).RequireAuthorization();

app.MapPut("/api/settings", async (AppDbContext db, ClaimsPrincipal claims, SettingsDto input) =>
{
    var companyId = GetCompanyId(claims);
    var prefix = companyId.HasValue ? $"_{companyId}" : "";
    var updates = new Dictionary<string, string>
    {
        [$"shop_name{prefix}"] = input.ShopName,
        [$"shop_address{prefix}"] = input.ShopAddress,
        [$"shop_city{prefix}"] = input.ShopCity,
        [$"shop_phone{prefix}"] = input.ShopPhone,
        [$"whatsapp{prefix}"] = input.Whatsapp.ToString().ToLower(),
        [$"barcode{prefix}"] = input.Barcode.ToString().ToLower(),
        [$"sms{prefix}"] = input.Sms.ToString().ToLower(),
    };
    foreach (var kv in updates)
    {
        var s = await db.Settings.FindAsync(kv.Key);
        if (s is null) db.Settings.Add(new Setting { Key = kv.Key, CompanyId = companyId, Value = kv.Value });
        else s.Value = kv.Value;
    }
    await db.SaveChangesAsync();
    return Results.Ok(input);
}).RequireAuthorization();

// ─── SUBSCRIPTIONS ────────────────────────────────────────────────────────────
app.MapGet("/api/subscriptions/plans", async (AppDbContext db) =>
{
    var plans = await db.SubscriptionPlans.Where(p => p.Active).OrderBy(p => p.Price).ToListAsync();
    return Results.Ok(plans);
});

app.MapGet("/api/subscriptions/status", async (AppDbContext db, ClaimsPrincipal claims) =>
{
    var companyId = GetCompanyId(claims);
    if (!companyId.HasValue) return Results.Ok(new { status = "SuperAdmin", plan = "Unlimited" });
    var today = DateOnly.FromDateTime(DateTime.Today);
    var sub = await db.CompanySubscriptions.Include(s => s.Plan)
        .Where(s => s.CompanyId == companyId.Value)
        .OrderByDescending(s => s.EndDate)
        .FirstOrDefaultAsync();
    if (sub == null) return Results.Ok(new { status = "None", plan = (string?)null, end_date = (string?)null, days_remaining = 0 });
    var daysRemaining = Math.Max(0, sub.EndDate.DayNumber - today.DayNumber);
    var effectiveStatus = sub.EndDate < today ? "Expired" : sub.Status;
    return Results.Ok(new {
        status = effectiveStatus,
        plan = sub.Plan?.Name,
        billing_cycle = sub.Plan?.BillingCycle,
        end_date = sub.EndDate.ToString("yyyy-MM-dd"),
        days_remaining = daysRemaining,
        max_orders = sub.Plan?.MaxOrders ?? 0,
        max_users = sub.Plan?.MaxUsers ?? 0,
        price = sub.Plan?.Price ?? 0
    });
}).RequireAuthorization();

app.MapGet("/api/subscriptions/company/{id:int}", async (AppDbContext db, ClaimsPrincipal claims, int id) =>
{
    var role = GetRole(claims);
    var companyId = GetCompanyId(claims);
    if (role != "SuperAdmin" && companyId != id) return Results.Forbid();
    var today = DateOnly.FromDateTime(DateTime.Today);
    var sub = await db.CompanySubscriptions.Include(s => s.Plan)
        .Where(s => s.CompanyId == id)
        .OrderByDescending(s => s.EndDate)
        .FirstOrDefaultAsync();
    if (sub == null) return Results.NotFound(new { message = "No subscription found" });
    return Results.Ok(sub);
}).RequireAuthorization();

app.MapGet("/api/subscriptions", async (AppDbContext db, ClaimsPrincipal claims) =>
{
    if (GetRole(claims) != "SuperAdmin") return Results.Forbid();
    var today = DateOnly.FromDateTime(DateTime.Today);
    var subs = await db.CompanySubscriptions.Include(s => s.Plan).Include(s => s.Company)
        .OrderByDescending(s => s.CreatedAt).ToListAsync();
    var result = subs.Select(s => new {
        s.Id, s.CompanyId, company_name = s.Company?.Name,
        s.PlanId, plan_name = s.Plan?.Name, billing_cycle = s.Plan?.BillingCycle,
        start_date = s.StartDate.ToString("yyyy-MM-dd"),
        end_date = s.EndDate.ToString("yyyy-MM-dd"),
        effective_status = s.EndDate < today ? "Expired" : s.Status,
        s.Status, s.PaymentMode, s.AmountPaid,
        days_remaining = Math.Max(0, s.EndDate.DayNumber - today.DayNumber)
    });
    return Results.Ok(result);
}).RequireAuthorization();

app.MapPost("/api/subscriptions", async (AppDbContext db, ClaimsPrincipal claims, CreateSubscriptionRequest req) =>
{
    if (GetRole(claims) != "SuperAdmin") return Results.Forbid();
    var sub = new CompanySubscription
    {
        CompanyId = req.CompanyId, PlanId = req.PlanId,
        StartDate = DateOnly.Parse(req.StartDate), EndDate = DateOnly.Parse(req.EndDate),
        Status = req.Status, PaymentMode = req.PaymentMode, AmountPaid = req.AmountPaid,
        CreatedAt = DateTime.UtcNow
    };
    db.CompanySubscriptions.Add(sub);
    await db.SaveChangesAsync();
    return Results.Created($"/api/subscriptions/{sub.Id}", sub);
}).RequireAuthorization();

app.MapPut("/api/subscriptions/{id:int}", async (AppDbContext db, ClaimsPrincipal claims, int id, UpdateSubscriptionRequest req) =>
{
    if (GetRole(claims) != "SuperAdmin") return Results.Forbid();
    var sub = await db.CompanySubscriptions.FindAsync(id);
    if (sub is null) return Results.NotFound();
    sub.PlanId = req.PlanId;
    sub.StartDate = DateOnly.Parse(req.StartDate);
    sub.EndDate = DateOnly.Parse(req.EndDate);
    sub.Status = req.Status;
    sub.PaymentMode = req.PaymentMode;
    sub.AmountPaid = req.AmountPaid;
    await db.SaveChangesAsync();
    return Results.Ok(sub);
}).RequireAuthorization();

app.Run();
