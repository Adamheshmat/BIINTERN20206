using Microsoft.EntityFrameworkCore;

namespace SdkProductCrud.Api;

public sealed class ProductDbContext(DbContextOptions<ProductDbContext> options) : DbContext(options)
{
    public DbSet<Product> Products => Set<Product>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Product>()
            .Property(product => product.Price)
            .HasConversion<double>()
            .IsRequired();
    }
}
