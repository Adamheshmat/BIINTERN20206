using System.IdentityModel.Tokens.Jwt;
using System.Net;
using System.Net.Http.Json;
using System.Security.Claims;
using System.Text.Json;
using Microsoft.Data.SqlClient;
using Xunit;

namespace SdkProductCrud.Api.Tests;

public sealed class AuthApiTests
{
    [SqlServerFact]
    public async Task Login_returns_a_short_lived_SDK_JWT_and_admin_permissions()
    {
        await WithSqlServerApiAsync(async (_database, client) =>
        {
            var response = await client.PostAsJsonAsync("/Auth/Login", new
            {
                UserName = "admin",
                Password = "Admin-Test-Password-123!"
            });

            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            var payload = await response.Content.ReadFromJsonAsync<JsonElement>();
            Assert.True(payload.TryGetProperty("token", out _));
            Assert.True(payload.TryGetProperty("expiresAt", out _));
            Assert.True(payload.GetProperty("user").TryGetProperty("userName", out _));
            Assert.True(payload.GetProperty("user").TryGetProperty("buid", out _));
            Assert.True(payload.GetProperty("permissions").TryGetProperty("canRead", out _));

            var login = payload.Deserialize<LoginResponse>(JsonSerializerOptions.Web);
            Assert.NotNull(login);
            Assert.Equal("admin", login.User.UserName);
            Assert.Equal("admin", login.User.Role);
            Assert.Equal("C100", login.User.BUID);
            Assert.True(login.Permissions.CanRead);
            Assert.True(login.Permissions.CanCreate);
            Assert.True(login.Permissions.CanUpdate);
            Assert.True(login.Permissions.CanDelete);

            var jwt = new JwtSecurityTokenHandler().ReadJwtToken(login.Token);
            Assert.Contains(jwt.Claims, claim => claim.Value == "admin" &&
                (claim.Type is "unique_name" or "name" || claim.Type == ClaimTypes.Name));
            Assert.Contains(jwt.Claims, claim => claim.Value == "admin" &&
                claim.Type is "role" or ClaimTypes.Role);
            Assert.Equal("C100", jwt.Claims.Single(c => c.Type == "BUID").Value);
            Assert.False(string.IsNullOrWhiteSpace(jwt.Id));
            Assert.InRange(jwt.ValidTo - jwt.ValidFrom, TimeSpan.FromMinutes(14), TimeSpan.FromMinutes(15));
        });
    }

    [SqlServerFact]
    public async Task Login_returns_read_only_permissions_for_viewer()
    {
        await WithSqlServerApiAsync(async (_, client) =>
        {
            var response = await client.PostAsJsonAsync("/Auth/Login", new
            {
                UserName = "viewer",
                Password = "Viewer-Test-Password-123!"
            });
            var login = await response.Content.ReadFromJsonAsync<LoginResponse>();

            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            Assert.Equal(new ProductPermissions(true, false, false, false), login!.Permissions);
            Assert.Equal(new UserSummary("viewer", "viewer", "C200"), login.User);
        });
    }

    [SqlServerFact]
    public async Task Login_rejects_wrong_password_and_unknown_user_with_the_same_response()
    {
        await WithSqlServerApiAsync(async (_, client) =>
        {
            foreach (var request in new[]
            {
                new { userName = "admin", password = "wrong-password" },
                new { userName = "missing", password = "Admin-Test-Password-123!" }
            })
            {
                var response = await client.PostAsJsonAsync("/Auth/Login", request);
                Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
                Assert.Equal(
                    "Invalid username or password.",
                    (await response.Content.ReadFromJsonAsync<JsonElement>())
                        .GetProperty("message").GetString());
            }
        });
    }

    [SqlServerFact]
    public async Task Login_rejects_an_inactive_user_with_the_same_response()
    {
        await WithSqlServerApiAsync(async (database, client) =>
        {
            await using (var connection = new SqlConnection(database.ConnectionString))
            {
                await connection.OpenAsync();
                await using var command = connection.CreateCommand();
                command.CommandText = "UPDATE dbo.loginusers SET InActive = 1 WHERE userName = N'viewer'";
                await command.ExecuteNonQueryAsync();
            }

            var response = await client.PostAsJsonAsync("/Auth/Login", new
            {
                UserName = "viewer",
                Password = "Viewer-Test-Password-123!"
            });

            Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
            Assert.Equal(
                "Invalid username or password.",
                (await response.Content.ReadFromJsonAsync<JsonElement>())
                    .GetProperty("message").GetString());
        });
    }

    [SqlServerFact]
    public async Task Startup_hashes_demo_credentials_without_storing_the_configured_passwords()
    {
        await WithSqlServerApiAsync(async (database, _) =>
        {
            await using var connection = new SqlConnection(database.ConnectionString);
            await connection.OpenAsync();
            await using var command = connection.CreateCommand();
            command.CommandText = "SELECT UserName, PasswordHash FROM dbo.AppCredentials ORDER BY UserName";

            await using var reader = await command.ExecuteReaderAsync();
            var rows = new List<(string UserName, string PasswordHash)>();
            while (await reader.ReadAsync())
            {
                rows.Add((reader.GetString(0), reader.GetString(1)));
            }

            Assert.Equal(["admin", "viewer"], rows.Select(row => row.UserName).ToArray());
            Assert.All(rows, row =>
            {
                Assert.NotEqual("Admin-Test-Password-123!", row.PasswordHash);
                Assert.NotEqual("Viewer-Test-Password-123!", row.PasswordHash);
            });
        });
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
