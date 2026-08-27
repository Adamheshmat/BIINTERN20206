using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SalesBuzz.Shared.Data;
using SalesBuzz.Shared.Filters;

namespace SdkProductCrud.Api;

[ApiController]
[Route("ProductSummary")]
[Authorize]
public sealed class ProductSummaryController(
    CatalogDbContext db,
    ICurrentBUContext currentBusinessUnit) : ControllerBase
{
    private const int LowStockThreshold = 10;

    [HttpGet]
    [HasPermission("Products", PermissionKind.Read)]
    public async Task<ActionResult<ProductSummaryResponse>> Get(CancellationToken cancellationToken)
    {
        var buid = currentBusinessUnit.GetUserBUID();
        var products = db.Products.AsNoTracking().Where(product => product.BUID == buid);

        var summary = await products
            .GroupBy(_ => 1)
            .Select(group => new ProductSummaryResponse(
                group.Count(),
                group.Sum(product => (product.Price ?? 0m) * (product.StockQuantity ?? 0)),
                group.Count(product => product.IsActive),
                group.Count(product => (product.StockQuantity ?? 0) < LowStockThreshold)))
            .SingleOrDefaultAsync(cancellationToken)
            ?? new ProductSummaryResponse(0, 0m, 0, 0);

        return Ok(summary);
    }
}

public sealed record ProductSummaryResponse(
    [property: JsonPropertyName("productCount")] int ProductCount,
    [property: JsonPropertyName("totalInventoryValue")] decimal TotalInventoryValue,
    [property: JsonPropertyName("activeProductCount")] int ActiveProductCount,
    [property: JsonPropertyName("lowStockProductCount")] int LowStockProductCount);
