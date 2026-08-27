using Microsoft.EntityFrameworkCore;
using SalesBuzz.Shared.Data;

namespace SdkProductCrud.Api;

public sealed class CatalogDbContext(
    DbContextOptions<CatalogDbContext> options,
    ICurrentBUContext currentBusinessUnit)
    : SalesBuzzDbContextBase(options, currentBusinessUnit)
{
    public DbSet<Product> Products => Set<Product>();

    public DbSet<AppCredential> AppCredentials => Set<AppCredential>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.Entity<Product>(product =>
        {
            product.ToTable("Products", "dbo");
            product.HasKey(entity => entity.Id);
            product.Property(entity => entity.Id).ValueGeneratedOnAdd();
            product.Property(entity => entity.Name).HasMaxLength(100).IsUnicode().IsRequired();
            product.Property(entity => entity.Price).HasColumnType("decimal(18,2)").IsRequired();
            product.Property(entity => entity.StockQuantity).IsRequired();
            product.Property(entity => entity.IsActive).IsRequired();
            product.Property(entity => entity.BUID).HasMaxLength(15).IsUnicode().IsRequired();
        });

        modelBuilder.Entity<AppCredential>(credential =>
        {
            credential.ToTable("AppCredentials", "dbo");
            credential.HasKey(entity => entity.UserName);
            credential.Property(entity => entity.UserName).HasMaxLength(15).IsUnicode().IsRequired();
            credential.Property(entity => entity.PasswordHash).HasMaxLength(500).IsUnicode().IsRequired();
        });
    }
}
