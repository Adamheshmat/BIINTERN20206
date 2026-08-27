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

app.MapControllers();

app.Run();

public partial class Program;
