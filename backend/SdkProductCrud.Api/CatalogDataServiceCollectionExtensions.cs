using SalesBuzz.Shared.Data;

namespace Microsoft.Extensions.DependencyInjection;

public static class CatalogDataServiceCollectionExtensions
{
    public static IServiceCollection AddCatalogData(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        services.AddHttpContextAccessor();
        services.AddScoped<ICurrentBUContext, CurrentBUContext>();
        services.AddSalesBuzzDb<SdkProductCrud.Api.CatalogDbContext>(configuration);

        return services;
    }
}
