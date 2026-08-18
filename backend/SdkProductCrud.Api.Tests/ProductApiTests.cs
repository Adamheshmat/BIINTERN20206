using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Configuration;
using Xunit;

namespace SdkProductCrud.Api.Tests;

public sealed class ProductApiTests
{
    [Fact]
    public async Task Products_support_read_create_patch_and_delete()
    {
        using var factory = new ProductApiFactory();
        using var client = factory.CreateClient();

        var initial = await client.GetFromJsonAsync<JsonElement>("/Products?$count=true");
        Assert.Equal(3, initial.GetProperty("@odata.count").GetInt32());

        var create = await client.PostAsJsonAsync("/Products", new
        {
            Name = "Test Product",
            Price = 12.50m,
            StockQuantity = 8,
            IsActive = true
        });
        Assert.Equal(HttpStatusCode.Created, create.StatusCode);

        var product = await create.Content.ReadFromJsonAsync<JsonElement>();
        Assert.True(product.TryGetProperty("Id", out var identifier));
        Assert.Equal("Test Product", product.GetProperty("Name").GetString());
        var id = identifier.GetInt32();

        using var patch = new HttpRequestMessage(HttpMethod.Patch, $"/Products({id})")
        {
            Content = JsonContent.Create(new { Price = 15.00m })
        };
        Assert.Equal(HttpStatusCode.NoContent, (await client.SendAsync(patch)).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await client.DeleteAsync($"/Products({id})")).StatusCode);
    }

    [Fact]
    public async Task Products_reject_blank_names_and_negative_values()
    {
        using var factory = new ProductApiFactory();
        using var client = factory.CreateClient();

        var blankName = await client.PostAsJsonAsync("/Products", new
        {
            Name = "",
            Price = 12.50m,
            StockQuantity = 8,
            IsActive = true
        });
        Assert.Equal(HttpStatusCode.BadRequest, blankName.StatusCode);

        var negativeValues = await client.PostAsJsonAsync("/Products", new
        {
            Name = "Invalid Product",
            Price = -0.01m,
            StockQuantity = -1,
            IsActive = true
        });
        Assert.Equal(HttpStatusCode.BadRequest, negativeValues.StatusCode);
    }

    private sealed class ProductApiFactory : WebApplicationFactory<Program>
    {
        private readonly string databasePath = Path.Combine(
            Path.GetTempPath(),
            $"sdk-product-crud-{Guid.NewGuid():N}.db");

        protected override void ConfigureWebHost(IWebHostBuilder builder)
        {
            builder.UseEnvironment("Testing");
            builder.ConfigureAppConfiguration((_, configuration) =>
                configuration.AddInMemoryCollection(new Dictionary<string, string?>
                {
                    ["ConnectionStrings:Products"] = $"Data Source={databasePath}"
                }));
        }

        protected override void Dispose(bool disposing)
        {
            base.Dispose(disposing);

            if (disposing)
            {
                File.Delete(databasePath);
                File.Delete($"{databasePath}-shm");
                File.Delete($"{databasePath}-wal");
            }
        }
    }
}
