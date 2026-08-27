using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using SalesBuzz.Shared.Authorization;
using SalesBuzz.Shared.Data;
using SdkProductCrud.Api;
using Xunit;

namespace SdkProductCrud.Api.Tests;

public sealed class CatalogConfigurationTests
{
    private const string DefaultConnection =
        "Server=localhost,1433;Database=SdkProductCrud;Integrated Security=True;TrustServerCertificate=True";

    [Fact]
    public void Catalog_context_derives_from_the_SalesBuzz_SDK_base()
    {
        Assert.True(typeof(SalesBuzzDbContextBase).IsAssignableFrom(typeof(CatalogDbContext)));
    }

    [Fact]
    public void Catalog_registration_uses_DefaultConnection_and_exposes_the_SDK_base_context()
    {
        using var provider = BuildServiceProvider();
        using var scope = provider.CreateScope();

        var catalog = scope.ServiceProvider.GetRequiredService<CatalogDbContext>();
        var sdkBase = scope.ServiceProvider.GetRequiredService<SalesBuzzDbContextBase>();
        var currentBusinessUnit = scope.ServiceProvider.GetRequiredService<ICurrentBUContext>();

        Assert.Same(catalog, sdkBase);
        Assert.Equal("Microsoft.EntityFrameworkCore.SqlServer", catalog.Database.ProviderName);
        Assert.Equal("SdkProductCrud", catalog.Database.GetDbConnection().Database);
        Assert.IsType<CurrentBUContext>(currentBusinessUnit);
        Assert.NotNull(scope.ServiceProvider.GetRequiredService<IPermissions>());
        Assert.NotNull(provider.GetRequiredService<IAuthenticationSchemeProvider>());
    }

    [Fact]
    public void Jwt_registration_validates_the_configured_issuer_and_audience()
    {
        using var provider = BuildServiceProvider();
        var options = provider.GetRequiredService<IOptionsMonitor<JwtBearerOptions>>()
            .Get(JwtBearerDefaults.AuthenticationScheme);

        Assert.True(options.TokenValidationParameters.ValidateIssuer);
        Assert.Equal("SdkProductCrud.Tests", options.TokenValidationParameters.ValidIssuer);
        Assert.True(options.TokenValidationParameters.ValidateAudience);
        Assert.Equal("SdkProductCrud.Frontend.Tests", options.TokenValidationParameters.ValidAudience);
    }

    [Theory]
    [InlineData("DemoCredentials:AdminPassword")]
    [InlineData("DemoCredentials:ViewerPassword")]
    public void Demo_credentials_name_the_missing_configuration_key(string missingKey)
    {
        var values = new Dictionary<string, string?>
        {
            ["DemoCredentials:AdminPassword"] = "admin-secret",
            ["DemoCredentials:ViewerPassword"] = "viewer-secret"
        };
        values[missingKey] = null;
        var configuration = new ConfigurationBuilder().AddInMemoryCollection(values).Build();

        var error = Assert.Throws<InvalidOperationException>(
            () => DemoCredentialOptions.FromConfiguration(configuration));

        Assert.Contains(missingKey, error.Message, StringComparison.Ordinal);
    }

    [Fact]
    public void Catalog_model_matches_the_SQL_Server_Products_table()
    {
        using var provider = BuildServiceProvider();
        using var scope = provider.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<CatalogDbContext>();

        var product = context.Model.FindEntityType(typeof(Product));
        Assert.NotNull(product);
        Assert.Equal("Products", product.GetTableName());
        Assert.Equal("dbo", product.GetSchema());
        Assert.Equal("decimal(18,2)", product.FindProperty(nameof(Product.Price))?.GetColumnType());
        Assert.Equal(100, product.FindProperty(nameof(Product.Name))?.GetMaxLength());
        Assert.Equal(15, product.FindProperty(nameof(Product.BUID))?.GetMaxLength());
        Assert.False(product.FindProperty(nameof(Product.BUID))?.IsNullable);

        var credential = context.Model.FindEntityType(typeof(AppCredential));
        Assert.NotNull(credential);
        Assert.Equal("AppCredentials", credential.GetTableName());
        Assert.Equal("dbo", credential.GetSchema());
        Assert.Equal(nameof(AppCredential.UserName), credential.FindPrimaryKey()!.Properties.Single().Name);
        Assert.Equal(500, credential.FindProperty(nameof(AppCredential.PasswordHash))?.GetMaxLength());
    }

    private static ServiceProvider BuildServiceProvider()
    {
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["ConnectionStrings:DefaultConnection"] = DefaultConnection,
                ["JWT:Key"] = "configuration-test-signing-key-at-least-32-characters",
                ["JWT:ValidIssuer"] = "SdkProductCrud.Tests",
                ["JWT:ValidAudience"] = "SdkProductCrud.Frontend.Tests",
                ["DemoCredentials:AdminPassword"] = "admin-secret",
                ["DemoCredentials:ViewerPassword"] = "viewer-secret"
            })
            .Build();
        var services = new ServiceCollection();
        services.AddLogging();
        services.AddMemoryCache();
        services.AddRouting();
        services.AddSingleton<IConfiguration>(configuration);
        services.AddSalesBuzzJwt(configuration);
        services.RequireConfiguredJwtIssuerAndAudience(configuration);
        services.AddAuthorization();
        services.AddSalesBuzzCurrentBU();
        services.AddCatalogData(configuration);

        return services.BuildServiceProvider(new ServiceProviderOptions
        {
            ValidateOnBuild = true,
            ValidateScopes = true
        });
    }
}
