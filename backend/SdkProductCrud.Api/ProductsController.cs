using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.OData.Deltas;
using Microsoft.AspNetCore.OData.Formatter;
using Microsoft.AspNetCore.OData.Query;
using Microsoft.AspNetCore.OData.Routing.Controllers;
using Microsoft.EntityFrameworkCore;

namespace SdkProductCrud.Api;

public sealed class ProductsController(CatalogDbContext db) : ODataController
{
    [EnableQuery]
    public IQueryable<Product> Get() => db.Products.AsNoTracking();

    public async Task<IActionResult> Post([FromBody] Product product)
    {
        if (!ModelState.IsValid)
        {
            return BadRequest(ModelState);
        }

        db.Products.Add(product);
        await db.SaveChangesAsync();
        return Created(product);
    }

    public async Task<IActionResult> Patch([FromODataUri] int key, [FromBody] Delta<Product>? delta)
    {
        if (delta is null || !ModelState.IsValid)
        {
            return BadRequest(ModelState);
        }

        if (delta.GetChangedPropertyNames().Any(property =>
                string.Equals(property, nameof(Product.Id), StringComparison.OrdinalIgnoreCase)))
        {
            ModelState.AddModelError(nameof(Product.Id), "The product key cannot be changed.");
            return BadRequest(ModelState);
        }

        var product = await db.Products.FindAsync(key);
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

    public async Task<IActionResult> Delete([FromODataUri] int key)
    {
        var product = await db.Products.FindAsync(key);
        if (product is null)
        {
            return NotFound();
        }

        db.Products.Remove(product);
        await db.SaveChangesAsync();
        return NoContent();
    }
}
