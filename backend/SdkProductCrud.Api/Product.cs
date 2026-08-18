using System.ComponentModel.DataAnnotations;

namespace SdkProductCrud.Api;

public sealed class Product
{
    public int Id { get; set; }

    [Required, MaxLength(100)]
    public string Name { get; set; } = string.Empty;

    [Required, Range(0, double.MaxValue)]
    public decimal? Price { get; set; }

    [Required, Range(0, int.MaxValue)]
    public int? StockQuantity { get; set; }

    public bool IsActive { get; set; } = true;
}
