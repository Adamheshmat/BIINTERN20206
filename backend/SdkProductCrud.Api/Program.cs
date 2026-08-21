using Microsoft.EntityFrameworkCore;
using Microsoft.OData.Edm;
using Microsoft.OData.ModelBuilder;
using SalesBuzz.Shared.Middleware;
using SalesBuzz.Shared.OData;
using SdkProductCrud.Api;

var builder = WebApplication.CreateBuilder(args);

var modelBuilder = new ODataConventionModelBuilder();
modelBuilder.EntitySet<Product>("Products");
IEdmModel edmModel = modelBuilder.GetEdmModel();

builder.Services.AddSalesBuzzOData(edmModel);
builder.Services.AddSalesBuzzExceptionHandling();
builder.Services.AddCatalogData(builder.Configuration);
builder.Services.AddCors(options => options.AddPolicy("LocalAngular", policy =>
    policy.WithOrigins("http://localhost:4200").AllowAnyHeader().AllowAnyMethod()));

var app = builder.Build();

app.UseSalesBuzzExceptionHandling();
app.UseCors("LocalAngular");

using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<CatalogDbContext>();

    if (!await db.Products.AnyAsync())
    {
        db.Products.AddRange(
            new Product { Name = "Coffee", Price = 5.50m, StockQuantity = 24, IsActive = true },
            new Product { Name = "Tea", Price = 3.25m, StockQuantity = 36, IsActive = true },
            new Product { Name = "Juice", Price = 4.75m, StockQuantity = 18, IsActive = true });
        await db.SaveChangesAsync();
    }
}

app.MapControllers();

app.Run();

public partial class Program;
