using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;

namespace SdkProductCrud.Api.Tests;

internal sealed class ProductApiFactory : WebApplicationFactory<Program>
{
    private readonly string connectionString;

    internal ProductApiFactory(string connectionString)
    {
        this.connectionString = connectionString;
    }

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");
        builder.UseSetting("ConnectionStrings:DefaultConnection", connectionString);
        builder.UseSetting("JWT:Key", "integration-test-signing-key-at-least-32-characters");
        builder.UseSetting("JWT:ValidIssuer", "SdkProductCrud.Tests");
        builder.UseSetting("JWT:ValidAudience", "SdkProductCrud.Frontend.Tests");
        builder.UseSetting("DemoCredentials:AdminPassword", "Admin-Test-Password-123!");
        builder.UseSetting("DemoCredentials:ViewerPassword", "Viewer-Test-Password-123!");
    }
}
