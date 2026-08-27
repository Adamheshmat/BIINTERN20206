using System.ComponentModel.DataAnnotations;

namespace SdkProductCrud.Api;

public sealed class AppCredential
{
    [Key, MaxLength(15)]
    public string UserName { get; set; } = string.Empty;

    [Required, MaxLength(500)]
    public string PasswordHash { get; set; } = string.Empty;
}
