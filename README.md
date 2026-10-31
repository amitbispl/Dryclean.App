# DryClean Pro — Management System

Full-stack dry cleaning shop management application.

## Stack
- **Backend**: ASP.NET Core 8 (Minimal API, C#) — `DrycleanApi/`
- **Frontend**: React 18 + Vite — `frontend/`
- **Database**: PostgreSQL

---

## Setup

### 1. Database
Create a PostgreSQL database named `dryclean`:
```sql
CREATE DATABASE dryclean;
```

### 2. Backend (ASP.NET Core)
```bash
cd DrycleanApi

# Install EF Core CLI (once)
dotnet tool install --global dotnet-ef

# Restore packages
dotnet restore

# Create initial migration
dotnet ef migrations add InitialCreate

# Apply migrations (creates tables and seeds data)
dotnet ef database update

# Run the API server on http://localhost:8080
dotnet run --urls "http://localhost:8080"
```

Update connection string in `DrycleanApi/appsettings.json` if needed:
```json
"ConnectionStrings": {
  "DefaultConnection": "Host=localhost;Port=5432;Database=dryclean;Username=postgres;Password=password"
}
```

### 3. Frontend (React + Vite)
```bash
cd frontend
npm install
npm run dev
```
Opens at http://localhost:5173 — proxies API calls to http://localhost:8080.

---

## Features
- **Dashboard** — Stats, recent orders, overdue alerts
- **New Order** — Receipt generation, multi-item entry
- **All Orders** — Search, filter, status update
- **Order Status** — Track progress by status stage
- **Delivery Management** — Today's / tomorrow's / overdue deliveries
- **Sales Report** — Date-range revenue with service breakdown
- **Billing** — Invoices with print support
- **Products** — Service catalog (Dry Clean / Rafu / Charak)
- **Customers** — Customer master with order history
- **Settings** — Shop info, feature toggles

## Order Status Flow
Received → Processing → Completed → Packing → Ready → Delivered
                                                      ↘ Cancelled
