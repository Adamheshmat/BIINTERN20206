using System.IdentityModel.Tokens.Jwt;
using System.Net;
using System.Net.Http.Headers;
using System.Security.Claims;
using System.Text;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.IdentityModel.Tokens;
using SalesBuzz.Shared.Authorization;
using Xunit;

namespace SdkProductCrud.Api.Tests;

public sealed class JwtAuthenticationIntegrationTests
{
    private const string Key = "integration-test-signing-key-at-least-32-characters";
    private const string ValidIssuer = "SdkProductCrud.Tests";
    private const string ValidAudience = "SdkProductCrud.Frontend.Tests";

    [Theory]
    [InlineData("Wrong.Issuer", ValidAudience)]
    [InlineData(ValidIssuer, "Wrong.Audience")]
    public async Task Protected_endpoint_rejects_tokens_for_the_wrong_issuer_or_audience(
        string issuer,
        string audience)
    {
        await using var app = await StartAppAsync();
        using var client = app.GetTestClient();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", CreateToken(issuer, audience));

        Assert.Equal(HttpStatusCode.Unauthorized, (await client.GetAsync("/protected")).StatusCode);
    }

    [Fact]
    public async Task Protected_endpoint_accepts_a_correctly_issued_and_audienced_token()
    {
        await using var app = await StartAppAsync();
        using var client = app.GetTestClient();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", CreateToken(ValidIssuer, ValidAudience));

        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/protected")).StatusCode);
    }

    private static async Task<WebApplication> StartAppAsync()
    {
        var builder = WebApplication.CreateBuilder();
        builder.WebHost.UseTestServer();
        builder.Configuration.AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["JWT:Key"] = Key,
            ["JWT:ValidIssuer"] = ValidIssuer,
            ["JWT:ValidAudience"] = ValidAudience
        });
        builder.Services.AddSalesBuzzJwt(builder.Configuration);
        builder.Services.RequireConfiguredJwtIssuerAndAudience(builder.Configuration);
        builder.Services.AddAuthorization();

        var app = builder.Build();
        app.UseAuthentication();
        app.UseAuthorization();
        app.MapGet("/protected", () => Results.Ok()).RequireAuthorization();
        await app.StartAsync();
        return app;
    }

    private static string CreateToken(string issuer, string audience)
    {
        var token = new JwtSecurityToken(
            issuer,
            audience,
            [new Claim(ClaimTypes.Name, "admin")],
            notBefore: DateTime.UtcNow.AddMinutes(-1),
            expires: DateTime.UtcNow.AddMinutes(5),
            signingCredentials: new SigningCredentials(
                new SymmetricSecurityKey(Encoding.UTF8.GetBytes(Key)),
                SecurityAlgorithms.HmacSha256));

        return new JwtSecurityTokenHandler().WriteToken(token);
    }
}
