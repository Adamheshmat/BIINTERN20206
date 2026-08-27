using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Reflection;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.OData.Deltas;
using Microsoft.Data.SqlClient;
using SalesBuzz.Shared.Filters;
using Xunit;

namespace SdkProductCrud.Api.Tests;

public sealed class ProductAuthorizationTests
{
    [Fact]
    public void ProductsController_declares_the_required_authorization_and_permission_contract()
    {
        var controller = typeof(ProductsController);
        Assert.Single(controller.GetCustomAttributes<AuthorizeAttribute>(inherit: true));

        AssertOperationPermission(nameof(ProductsController.Get), PermissionKind.Read);
        AssertOperationPermission(nameof(ProductsController.Post), PermissionKind.Create);
        AssertOperationPermission(nameof(ProductsController.Patch), PermissionKind.Update);
        AssertOperationPermission(nameof(ProductsController.Delete), PermissionKind.Delete);

        Assert.DoesNotContain(controller.GetMethods(BindingFlags.Instance | BindingFlags.Public),
            method => method.IsDefined(typeof(AllowAnonymousAttribute), inherit: true));
    }

    [SqlServerFact]
    public async Task Product_requests_require_authentication()
    {
        await WithSqlServerApiAsync(async (_, client) =>
        {
            Assert.Equal(HttpStatusCode.Unauthorized, (await client.GetAsync("/Products")).StatusCode);
            Assert.Equal(HttpStatusCode.Unauthorized, (await client.PostAsJsonAsync("/Products", new
            {
                Name = "Unauthenticated", Price = 1, StockQuantity = 1
            })).StatusCode);
        });
    }

    [SqlServerFact]
    public async Task Product_reads_are_scoped_before_OData_counting()
    {
        await WithSqlServerApiAsync(async (_, client) =>
        {
            Authorize(client, await LoginAsync(client, "admin", "Admin-Test-Password-123!"));
            var admin = await client.GetFromJsonAsync<JsonElement>("/Products?$orderby=Name&$count=true");
            Assert.Equal(2, admin.GetProperty("@odata.count").GetInt32());
            Assert.Equal(
                new[] { "Coffee", "Tea" },
                admin.GetProperty("value").EnumerateArray()
                    .Select(item => item.GetProperty("Name").GetString()).ToArray());

            Authorize(client, await LoginAsync(client, "viewer", "Viewer-Test-Password-123!"));
            var viewer = await client.GetFromJsonAsync<JsonElement>("/Products?$orderby=Name&$count=true");
            Assert.Equal(2, viewer.GetProperty("@odata.count").GetInt32());
            Assert.Equal(
                new[] { "Juice", "Water" },
                viewer.GetProperty("value").EnumerateArray()
                    .Select(item => item.GetProperty("Name").GetString()).ToArray());
        });
    }

    [SqlServerFact]
    public async Task Admin_post_uses_the_current_business_unit_instead_of_the_payload()
    {
        await WithSqlServerApiAsync(async (database, client) =>
        {
            Authorize(client, await LoginAsync(client, "admin", "Admin-Test-Password-123!"));
            var response = await client.PostAsJsonAsync("/Products", new
            {
                Name = "Admin created", Price = 2.5m, StockQuantity = 3, BUID = "C200"
            });

            Assert.Equal(HttpStatusCode.Created, response.StatusCode);
            var product = await response.Content.ReadFromJsonAsync<JsonElement>();
            Assert.Equal("C100", product.GetProperty("BUID").GetString());
            var productId = product.GetProperty("Id").GetInt32();

            await using var connection = await database.OpenConnectionAsync();
            await using var command = connection.CreateCommand();
            command.CommandText = "SELECT BUID FROM dbo.Products WHERE Id = @id";
            command.Parameters.AddWithValue("@id", productId);
            Assert.Equal("C100", Convert.ToString(await command.ExecuteScalarAsync()));
        });
    }

    [SqlServerFact]
    public async Task Viewer_cannot_create_update_or_delete_products()
    {
        await WithSqlServerApiAsync(async (_, client) =>
        {
            Authorize(client, await LoginAsync(client, "viewer", "Viewer-Test-Password-123!"));
            using var post = new HttpRequestMessage(HttpMethod.Post, "/Products")
            {
                Content = JsonContent.Create(new { Name = "Blocked", Price = 1, StockQuantity = 1 })
            };
            using var patch = new HttpRequestMessage(HttpMethod.Patch, "/Products(3)")
            {
                Content = JsonContent.Create(new { Price = 2 })
            };
            using var delete = new HttpRequestMessage(HttpMethod.Delete, "/Products(3)");

            Assert.Equal(HttpStatusCode.Unauthorized, (await client.SendAsync(post)).StatusCode);
            Assert.Equal(HttpStatusCode.Unauthorized, (await client.SendAsync(patch)).StatusCode);
            Assert.Equal(HttpStatusCode.Unauthorized, (await client.SendAsync(delete)).StatusCode);
        });
    }

    [SqlServerFact]
    public async Task Admin_cannot_modify_or_disclose_a_C200_product()
    {
        await WithSqlServerApiAsync(async (database, client) =>
        {
            var juiceKey = await FindProductIdAsync(database, "Juice", "C200");
            Authorize(client, await LoginAsync(client, "admin", "Admin-Test-Password-123!"));

            using var patch = new HttpRequestMessage(HttpMethod.Patch, $"/Products({juiceKey})")
            {
                Content = JsonContent.Create(new { Price = 99m })
            };
            Assert.Equal(HttpStatusCode.NotFound, (await client.SendAsync(patch)).StatusCode);
            Assert.Equal(HttpStatusCode.NotFound, (await client.DeleteAsync($"/Products({juiceKey})")).StatusCode);

            await using var connection = await database.OpenConnectionAsync();
            await using var command = connection.CreateCommand();
            command.CommandText = "SELECT Price FROM dbo.Products WHERE Id = @id AND Name = N'Juice' AND BUID = N'C200'";
            command.Parameters.AddWithValue("@id", juiceKey);
            Assert.Equal(4.75m, Convert.ToDecimal(await command.ExecuteScalarAsync()));
        });
    }

    [InlineData("{\"Id\":1}")]
    [InlineData("{\"BUID\":\"C200\"}")]
    [SqlServerTheory]
    public async Task Admin_cannot_patch_protected_product_properties(string payload)
    {
        await WithSqlServerApiAsync(async (_, client) =>
        {
            Authorize(client, await LoginAsync(client, "admin", "Admin-Test-Password-123!"));
            var coffeeKey = 1;
            using var patch = new HttpRequestMessage(HttpMethod.Patch, $"/Products({coffeeKey})")
            {
                Content = new StringContent(payload, Encoding.UTF8, "application/json")
            };

            Assert.Equal(HttpStatusCode.BadRequest, (await client.SendAsync(patch)).StatusCode);
        });
    }

    [SqlServerFact]
    public async Task Admin_can_create_patch_and_delete_a_C100_product()
    {
        await WithSqlServerApiAsync(async (_, client) =>
        {
            Authorize(client, await LoginAsync(client, "admin", "Admin-Test-Password-123!"));
            var create = await client.PostAsJsonAsync("/Products", new
            {
                Name = "Admin CRUD", Price = 7.25m, StockQuantity = 2, BUID = "C200"
            });
            Assert.Equal(HttpStatusCode.Created, create.StatusCode);
            var product = await create.Content.ReadFromJsonAsync<JsonElement>();
            Assert.Equal("C100", product.GetProperty("BUID").GetString());
            var id = product.GetProperty("Id").GetInt32();

            using var patch = new HttpRequestMessage(HttpMethod.Patch, $"/Products({id})")
            {
                Content = JsonContent.Create(new { Price = 8.5m })
            };
            Assert.Equal(HttpStatusCode.NoContent, (await client.SendAsync(patch)).StatusCode);
            Assert.Equal(HttpStatusCode.NoContent, (await client.DeleteAsync($"/Products({id})")).StatusCode);
        });
    }

    private static void AssertOperationPermission(string methodName, PermissionKind permission)
    {
        var method = typeof(ProductsController).GetMethod(methodName)!;
        var attributes = method.GetCustomAttributesData()
            .Where(attribute => attribute.AttributeType == typeof(HasPermission)).ToArray();
        var attribute = Assert.Single(attributes);

        Assert.Equal(2, attribute.ConstructorArguments.Count);
        Assert.Equal("Products", attribute.ConstructorArguments[0].Value);
        Assert.Equal(typeof(PermissionKind), attribute.ConstructorArguments[1].ArgumentType);
        Assert.Equal(Convert.ToInt32(permission), Convert.ToInt32(attribute.ConstructorArguments[1].Value));
    }

    private static async Task<string> LoginAsync(HttpClient client, string userName, string password)
    {
        var response = await client.PostAsJsonAsync("/Auth/Login", new { userName, password });
        response.EnsureSuccessStatusCode();
        return (await response.Content.ReadFromJsonAsync<LoginResponse>())!.Token;
    }

    private static void Authorize(HttpClient client, string token) =>
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);

    private static async Task<int> FindProductIdAsync(SqlServerTestDatabase database, string name, string buid)
    {
        await using var connection = await database.OpenConnectionAsync();
        await using var command = connection.CreateCommand();
        command.CommandText = "SELECT Id FROM dbo.Products WHERE Name = @name AND BUID = @buid";
        command.Parameters.AddWithValue("@name", name);
        command.Parameters.AddWithValue("@buid", buid);
        return Convert.ToInt32(await command.ExecuteScalarAsync());
    }

    private static async Task WithSqlServerApiAsync(
        Func<SqlServerTestDatabase, HttpClient, Task> test)
    {
        await using var database = await SqlServerTestDatabase.CreateInitializedAsync();
        using var factory = new ProductApiFactory(database.ConnectionString);
        using var client = factory.CreateClient();
        await test(database, client);
    }
}

[AttributeUsage(AttributeTargets.Method)]
internal sealed class SqlServerTheoryAttribute : TheoryAttribute
{
    public SqlServerTheoryAttribute()
    {
        if (!SqlServerTestDatabase.IsConfigured)
        {
            Skip = $"Set {SqlServerTestDatabase.ConnectionEnvironmentVariable} to run real SQL Server integration tests.";
        }
    }
}
