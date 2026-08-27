using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace SdkProductCrud.Api;

internal sealed class DemoCredentialSeeder(
    CatalogDbContext db,
    IPasswordHasher<AppCredential> passwordHasher,
    DemoCredentialOptions options)
{
    internal async Task SeedAsync()
    {
        await SeedUserAsync("admin", options.AdminPassword);
        await SeedUserAsync("viewer", options.ViewerPassword);
        await db.SaveChangesAsync();
    }

    private async Task SeedUserAsync(string userName, string password)
    {
        if (!await db.loginusers.AsNoTracking().AnyAsync(user =>
                user.userName == userName && user.InActive == 0))
        {
            throw new InvalidOperationException(
                $"Demo SDK user '{userName}' is missing or inactive. Apply SDK_Minimal_Schema.sql.");
        }

        var credential = await db.AppCredentials.FindAsync(userName);
        if (credential is null)
        {
            credential = new AppCredential { UserName = userName };
            db.AppCredentials.Add(credential);
        }

        if (string.IsNullOrEmpty(credential.PasswordHash) ||
            passwordHasher.VerifyHashedPassword(credential, credential.PasswordHash, password)
                == PasswordVerificationResult.Failed)
        {
            credential.PasswordHash = passwordHasher.HashPassword(credential, password);
        }
    }
}
