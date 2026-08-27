using Microsoft.OData.Edm;
using Microsoft.OData.ModelBuilder;
using Microsoft.AspNetCore.Identity;
using SalesBuzz.Shared.Authorization;
using SalesBuzz.Shared.Data;
using SalesBuzz.Shared.Helpers;
using SalesBuzz.Shared.Middleware;
using SalesBuzz.Shared.OData;
using SdkProductCrud.Api;

var builder = WebApplication.CreateBuilder(args);

var demoCredentialOptions = DemoCredentialOptions.FromConfiguration(builder.Configuration);
ValidateJwtConfiguration(builder.Configuration);

var modelBuilder = new ODataConventionModelBuilder();
modelBuilder.EntitySet<Product>("Products");
IEdmModel edmModel = modelBuilder.GetEdmModel();

builder.Services.AddSalesBuzzOData(edmModel);
builder.Services.AddSalesBuzzExceptionHandling();
builder.Services.AddSalesBuzzJwt(builder.Configuration);
builder.Services.RequireConfiguredJwtIssuerAndAudience(builder.Configuration);
builder.Services.AddAuthorization();
builder.Services.AddMemoryCache();
builder.Services.AddSalesBuzzCurrentBU();
builder.Services.AddCatalogData(builder.Configuration);
builder.Services.AddSingleton(demoCredentialOptions);
builder.Services.AddScoped<IPasswordHasher<AppCredential>, PasswordHasher<AppCredential>>();
builder.Services.AddScoped<DemoCredentialSeeder>();
builder.Services.AddCors(options => options.AddPolicy("LocalAngular", policy =>
    policy.WithOrigins("http://localhost:4200").AllowAnyHeader().AllowAnyMethod()));

var app = builder.Build();

app.UseSalesBuzzExceptionHandling();
app.UseCors("LocalAngular");
app.UseRequestLocalization("en-EG");
app.UseStaticHttpContext();
app.UseAuthentication();
app.UseAuthorization();

using (var scope = app.Services.CreateScope())
{
    await scope.ServiceProvider.GetRequiredService<DemoCredentialSeeder>().SeedAsync();
}

app.MapControllers();

app.Run();

static void ValidateJwtConfiguration(IConfiguration configuration)
{
    static string Required(IConfiguration configuration, string key) =>
        string.IsNullOrWhiteSpace(configuration[key])
            ? throw new InvalidOperationException($"Missing required configuration value '{key}'.")
            : configuration[key]!;

    var key = Required(configuration, "JWT:Key");
    Required(configuration, "JWT:ValidIssuer");
    Required(configuration, "JWT:ValidAudience");

    if (System.Text.Encoding.UTF8.GetByteCount(key) < 32)
    {
        throw new InvalidOperationException(
            "Configuration value 'JWT:Key' must be at least 32 UTF-8 bytes.");
    }
}

public partial class Program;
