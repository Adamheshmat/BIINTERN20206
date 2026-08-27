using Microsoft.AspNetCore.Authentication.JwtBearer;

namespace SdkProductCrud.Api;

public static class JwtValidationServiceCollectionExtensions
{
    public static IServiceCollection RequireConfiguredJwtIssuerAndAudience(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        var validIssuer = configuration["JWT:ValidIssuer"]!;
        var validAudience = configuration["JWT:ValidAudience"]!;

        services.PostConfigure<JwtBearerOptions>(JwtBearerDefaults.AuthenticationScheme, options =>
        {
            options.TokenValidationParameters.ValidateIssuer = true;
            options.TokenValidationParameters.ValidIssuer = validIssuer;
            options.TokenValidationParameters.ValidateAudience = true;
            options.TokenValidationParameters.ValidAudience = validAudience;
        });

        return services;
    }
}
