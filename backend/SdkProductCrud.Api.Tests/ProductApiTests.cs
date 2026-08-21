using System.Net;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Xunit;

namespace SdkProductCrud.Api.Tests;

public sealed class ProductApiTests
{
    [SqlServerFact]
    public async Task Products_support_read_create_patch_and_delete()
    {
        await WithSqlServerApiAsync(async client =>
        {
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
        });
    }

    [SqlServerFact]
    public async Task Startup_does_not_add_sample_products_when_the_table_is_not_empty()
    {
        await using var database = await SqlServerTestDatabase.CreateInitializedAsync();
        await using (var connection = await database.OpenConnectionAsync())
        await using (var command = connection.CreateCommand())
        {
            command.CommandText = """
                INSERT INTO dbo.Products (Name, Price, StockQuantity, IsActive)
                VALUES (N'Existing product', 9.99, 7, 1);
                """;
            await command.ExecuteNonQueryAsync();
        }

        using var factory = new ProductApiFactory(database.ConnectionString);
        using var client = factory.CreateClient();
        var payload = await client.GetFromJsonAsync<JsonElement>("/Products?$count=true");

        Assert.Equal(1, payload.GetProperty("@odata.count").GetInt32());
        Assert.Equal(
            "Existing product",
            payload.GetProperty("value")[0].GetProperty("Name").GetString());
    }

    [SqlServerFact]
    public async Task Products_reject_blank_names_and_negative_values()
    {
        await WithSqlServerApiAsync(async client =>
        {
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
        });
    }

    [SqlServerFact]
    public async Task Products_order_by_price_on_SQL_Server()
    {
        await WithSqlServerApiAsync(async client =>
        {
            var response = await client.GetAsync("/Products?$orderby=Price%20desc");

            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            var payload = await response.Content.ReadFromJsonAsync<JsonElement>();
            Assert.Equal(
                ["Coffee", "Juice", "Tea"],
                payload.GetProperty("value").EnumerateArray()
                    .Select(item => item.GetProperty("Name").GetString()!)
                    .ToArray());
        });
    }

    [SqlServerFact]
    public async Task Products_filter_by_price_range_on_SQL_Server()
    {
        await WithSqlServerApiAsync(async client =>
        {
            var response = await client.GetAsync(
                "/Products?$filter=Price%20ge%204%20and%20Price%20lt%205&$orderby=Price");

            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            var payload = await response.Content.ReadFromJsonAsync<JsonElement>();
            var products = payload.GetProperty("value").EnumerateArray().ToArray();
            Assert.Single(products);
            Assert.Equal("Juice", products[0].GetProperty("Name").GetString());
            Assert.Equal(4.75m, products[0].GetProperty("Price").GetDecimal());
        });
    }

    [SqlServerFact]
    public async Task Products_reject_null_and_malformed_patch_bodies()
    {
        await WithSqlServerApiAsync(async client =>
        {
            var id = await CreateProductAsync(client);

            using var nullPatch = new HttpRequestMessage(HttpMethod.Patch, $"/Products({id})")
            {
                Content = new StringContent("null", Encoding.UTF8, "application/json")
            };
            Assert.Equal(HttpStatusCode.BadRequest, (await client.SendAsync(nullPatch)).StatusCode);

            using var malformedPatch = new HttpRequestMessage(HttpMethod.Patch, $"/Products({id})")
            {
                Content = JsonContent.Create(new { Price = "not-a-decimal" })
            };
            Assert.Equal(HttpStatusCode.BadRequest, (await client.SendAsync(malformedPatch)).StatusCode);
        });
    }

    [SqlServerFact]
    public async Task Products_reject_any_patch_attempt_to_set_the_key()
    {
        await WithSqlServerApiAsync(async client =>
        {
            var id = await CreateProductAsync(client);

            using var patch = new HttpRequestMessage(HttpMethod.Patch, $"/Products({id})")
            {
                Content = JsonContent.Create(new { Id = id, Name = "Changed" })
            };

            Assert.Equal(HttpStatusCode.BadRequest, (await client.SendAsync(patch)).StatusCode);
            var persisted = await client.GetFromJsonAsync<JsonElement>($"/Products?$filter=Id%20eq%20{id}");
            Assert.Equal(
                "Patch target",
                persisted.GetProperty("value")[0].GetProperty("Name").GetString());
        });
    }

    [SqlServerFact]
    public async Task Products_reject_posts_with_omitted_price_or_stock_quantity()
    {
        await WithSqlServerApiAsync(async client =>
        {
            var missingPrice = await client.PostAsJsonAsync("/Products", new
            {
                Name = "Missing price",
                StockQuantity = 8,
                IsActive = true
            });
            Assert.Equal(HttpStatusCode.BadRequest, missingPrice.StatusCode);

            var missingStock = await client.PostAsJsonAsync("/Products", new
            {
                Name = "Missing stock",
                Price = 12.50m,
                IsActive = true
            });
            Assert.Equal(HttpStatusCode.BadRequest, missingStock.StatusCode);
        });
    }

    private static async Task WithSqlServerApiAsync(Func<HttpClient, Task> test)
    {
        await using var database = await SqlServerTestDatabase.CreateInitializedAsync();
        using var factory = new ProductApiFactory(database.ConnectionString);
        using var client = factory.CreateClient();
        await test(client);
    }

    private static async Task<int> CreateProductAsync(HttpClient client)
    {
        var response = await client.PostAsJsonAsync("/Products", new
        {
            Name = "Patch target",
            Price = 12.50m,
            StockQuantity = 8,
            IsActive = true
        });
        response.EnsureSuccessStatusCode();
        var product = await response.Content.ReadFromJsonAsync<JsonElement>();
        return product.GetProperty("Id").GetInt32();
    }

    private sealed class ProductApiFactory : WebApplicationFactory<Program>
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
        }
    }
}
