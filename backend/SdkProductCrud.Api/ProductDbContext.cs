using Microsoft.EntityFrameworkCore;

namespace SdkProductCrud.Api;

public sealed class ProductDbContext(DbContextOptions<ProductDbContext> options) : DbContext(options)
{
    public DbSet<Product> Products => Set<Product>();
}
