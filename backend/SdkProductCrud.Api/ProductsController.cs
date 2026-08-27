using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.OData.Deltas;
using Microsoft.AspNetCore.OData.Formatter;
using Microsoft.AspNetCore.OData.Query;
using Microsoft.AspNetCore.OData.Routing.Controllers;
using Microsoft.EntityFrameworkCore;
using SalesBuzz.Shared.Data;
using SalesBuzz.Shared.Filters;

namespace SdkProductCrud.Api;

[Authorize]
public sealed class ProductsController(
    CatalogDbContext db,
    ICurrentBUContext currentBusinessUnit) : ODataController
{
    [EnableQuery]
    [HasPermission("Products", PermissionKind.Read)]
    public IQueryable<Product> Get()
    {
        var buid = currentBusinessUnit.GetUserBUID();
        return db.Products.AsNoTracking().Where(product => product.BUID == buid);
    }

    [HasPermission("Products", PermissionKind.Create)]
    public async Task<IActionResult> Post([FromBody] Product product)
    {
        if (!ModelState.IsValid)
        {
            return BadRequest(ModelState);
        }

        product.BUID = currentBusinessUnit.GetUserBUID();
        db.Products.Add(product);
        await db.SaveChangesAsync();
        return Created(product);
    }

    [HasPermission("Products", PermissionKind.Update)]
    public async Task<IActionResult> Patch([FromODataUri] int key, [FromBody] Delta<Product>? delta)
    {
        if (delta is null || !ModelState.IsValid)
        {
            return BadRequest(ModelState);
        }

        var protectedProperties = delta.GetChangedPropertyNames().Where(property =>
            string.Equals(property, nameof(Product.Id), StringComparison.OrdinalIgnoreCase) ||
            string.Equals(property, nameof(Product.BUID), StringComparison.OrdinalIgnoreCase)).ToArray();
        if (protectedProperties.Length > 0)
        {
            foreach (var property in protectedProperties)
            {
                ModelState.AddModelError(property, $"The product {property} cannot be changed.");
            }

            return BadRequest(ModelState);
        }

        var buid = currentBusinessUnit.GetUserBUID();
        var product = await db.Products.SingleOrDefaultAsync(entity =>
            entity.Id == key && entity.BUID == buid);
        if (product is null)
        {
            return NotFound();
        }

        delta.Patch(product);
        ModelState.Clear();
        if (!TryValidateModel(product))
        {
            return BadRequest(ModelState);
        }

        await db.SaveChangesAsync();
        return NoContent();
    }

    [HasPermission("Products", PermissionKind.Delete)]
    public async Task<IActionResult> Delete([FromODataUri] int key)
    {
        var buid = currentBusinessUnit.GetUserBUID();
        var product = await db.Products.SingleOrDefaultAsync(entity =>
            entity.Id == key && entity.BUID == buid);
        if (product is null)
        {
            return NotFound();
        }

        db.Products.Remove(product);
        await db.SaveChangesAsync();
        return NoContent();
    }
}
