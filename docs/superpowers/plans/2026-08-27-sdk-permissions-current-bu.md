# SDK Permissions and Current Business Unit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a presentation-ready local login flow in which BI-SDK permissions protect Product CRUD and BI-SDK current-BU context isolates Product data between `admin`/`C100` and `viewer`/`C200`.

**Architecture:** SQL Server remains the source of SDK users, roles, permissions, and BU data, while a local `AppCredentials` table stores ASP.NET Core password hashes for the two demo users. The API issues short-lived JWTs with the SDK claim names and applies `[Authorize]`, `[HasPermission]`, and explicit `ICurrentBUContext` filtering at the Product boundary. Angular keeps the session in `sessionStorage`, adds the bearer token through an interceptor, and switches the root component between login and the existing BI Grid page.

**Tech Stack:** .NET 10 minimal hosting, ASP.NET Core JWT bearer authentication and `PasswordHasher<T>`, BI-SDK 0.2.0, Entity Framework Core/SQL Server/OData, Angular 20 standalone components, RxJS 7, Vitest, xUnit.

**Spec:** `docs/superpowers/specs/2026-08-27-sdk-permissions-current-bu-design.md`

## Global Constraints

- Keep the existing Product OData controller, BI Grid, BI Navigation, OData search, SQL Server provider, SDK exception handling, `AddSalesBuzzDb`, and packaged BI component source unchanged except where this plan explicitly extends their app-facing integration.
- The only supported demo accounts are `admin` in `C100` with read/create/update/delete and `viewer` in `C200` with read only.
- Read demo passwords from `DemoCredentials:AdminPassword` and `DemoCredentials:ViewerPassword`; read JWT settings from `JWT:Key`, `JWT:ValidIssuer`, and `JWT:ValidAudience`. Never commit usable values.
- JWTs contain `ClaimTypes.Name`, `ClaimTypes.Role`, literal `BUID`, and `JwtRegisteredClaimNames.Jti`; expiry is 15 minutes and the signing algorithm is `SecurityAlgorithms.HmacSha256`.
- Use the SDK security key `Products` and one `[HasPermission]` attribute per controller operation: `Read`, `Create`, `Update`, and `Delete` respectively.
- Backend authorization is the security boundary. UI permission flags only control presentation.
- Never accept a client-supplied Product `BUID`; cross-BU PATCH/DELETE must return 404 and PATCH must reject attempts to change `Id` or `BUID`.
- Do not add registration, password reset, refresh tokens, account administration, session-revocation middleware, Angular routing, or changes inside packaged BI component source.
- Keep SQL changes idempotent for both new and previously initialized local databases.

---

### Task 1: Persist Demo Credentials and BU-Scoped Product Data

**Files:**
- Create: `backend/SdkProductCrud.Api/AppCredential.cs`
- Modify: `backend/SdkProductCrud.Api/Product.cs`
- Modify: `backend/SdkProductCrud.Api/CatalogDbContext.cs`
- Modify: `backend/SdkProductCrud.Api/Program.cs`
- Modify: `backend/database/SDK_Minimal_Schema.sql`
- Modify: `backend/SdkProductCrud.Api.Tests/CatalogConfigurationTests.cs`
- Modify: `backend/SdkProductCrud.Api.Tests/SqlServerSchemaTests.cs`
- Modify: `backend/SdkProductCrud.Api.Tests/ProductApiTests.cs`

**Interfaces:**
- Consumes: `SalesBuzzDbContextBase.loginusers`, existing `CatalogDbContext.Products`, and the idempotent SQL schema runner.
- Produces: `AppCredential { UserName, PasswordHash }`, `CatalogDbContext.AppCredentials`, and required `Product.BUID` mapped to `nvarchar(15)` for Tasks 2 and 3.

- [ ] **Step 1: Write failing model-mapping and SQL-schema tests**

Add these assertions to `Catalog_model_matches_the_SQL_Server_Products_table`:

```csharp
Assert.Equal(15, product.FindProperty(nameof(Product.BUID))?.GetMaxLength());
Assert.False(product.FindProperty(nameof(Product.BUID))?.IsNullable);

var credential = context.Model.FindEntityType(typeof(AppCredential));
Assert.NotNull(credential);
Assert.Equal("AppCredentials", credential.GetTableName());
Assert.Equal("dbo", credential.GetSchema());
Assert.Equal(nameof(AppCredential.UserName), credential.FindPrimaryKey()!.Properties.Single().Name);
Assert.Equal(500, credential.FindProperty(nameof(AppCredential.PasswordHash))?.GetMaxLength());
```

Extend `Project_schema_is_idempotent_and_creates_the_SDK_and_product_objects` so its SQL query and assertions verify:

```sql
IIF(OBJECT_ID(N'dbo.AppCredentials', N'U') IS NULL, 0, 1),
(SELECT CHARACTER_MAXIMUM_LENGTH FROM INFORMATION_SCHEMA.COLUMNS
 WHERE TABLE_SCHEMA = N'dbo' AND TABLE_NAME = N'Products' AND COLUMN_NAME = N'BUID'),
(SELECT IS_NULLABLE FROM INFORMATION_SCHEMA.COLUMNS
 WHERE TABLE_SCHEMA = N'dbo' AND TABLE_NAME = N'Products' AND COLUMN_NAME = N'BUID'),
(SELECT COUNT(*) FROM dbo.HH_SA_BU WHERE BUID IN (N'C100', N'C200')),
(SELECT COUNT(*) FROM dbo.loginusers
 WHERE (userName = N'admin' AND BUID = N'C100' AND RoleID = N'admin' AND InActive = 0)
    OR (userName = N'viewer' AND BUID = N'C200' AND RoleID = N'viewer' AND InActive = 0)),
(SELECT COUNT(*) FROM dbo.HH_SA_SecurityKeys WHERE KeyID = N'Products'),
(SELECT COUNT(*) FROM dbo.HH_SA_RolePermissions
 WHERE KeyID = N'Products'
   AND ((RoleID = N'admin' AND CanRead = 1 AND CanInsert = 1 AND CanUpdate = 1 AND CanDelete = 1)
     OR (RoleID = N'viewer' AND CanRead = 1 AND CanInsert = 0 AND CanUpdate = 0 AND CanDelete = 0))),
(SELECT COUNT(DISTINCT BUID) FROM dbo.Products WHERE BUID IN (N'C100', N'C200'))
```

Assert `AppCredentials` exists, `BUID` is length 15 and non-nullable, both BUs/users/permission rows exist, and sample Products cover both BUs. Also assert:

```csharp
await using var secretCommand = connection.CreateCommand();
secretCommand.CommandText = "SELECT COUNT(*) FROM dbo.AppCredentials";
Assert.Equal(0, Convert.ToInt32(await secretCommand.ExecuteScalarAsync()));
```

Replace `Startup_does_not_add_sample_products_when_the_table_is_not_empty` with `Startup_does_not_mutate_schema_seeded_products`: create an initialized database, start the API once, GET `/Products?$count=true`, assert count `4`, and assert the literal names `Coffee`, `Tea`, `Juice`, and `Water` are present exactly once. Update the existing all-BU test expectations for this task to count `4` and descending price order `Coffee`, `Juice`, `Tea`, `Water`; Task 3 will change them to authenticated, BU-specific expectations.

- [ ] **Step 2: Run the focused tests and verify RED**

Run:

```bash
dotnet test backend/SdkProductCrud.Api.Tests/SdkProductCrud.Api.Tests.csproj --no-restore \
  --filter "FullyQualifiedName~CatalogConfigurationTests|FullyQualifiedName~SqlServerSchemaTests|FullyQualifiedName~Startup_does_not_mutate_schema_seeded_products"
```

Expected: model tests fail because `BUID` and `AppCredential` are absent; with `SQLSERVER_TEST_MASTER_CONNECTION` configured, schema tests additionally fail because the column/table/security seeds are absent.

- [ ] **Step 3: Add the two EF entities and mappings**

Create `AppCredential.cs`:

```csharp
using System.ComponentModel.DataAnnotations;

namespace SdkProductCrud.Api;

public sealed class AppCredential
{
    [Key, MaxLength(15)]
    public string UserName { get; set; } = string.Empty;

    [Required, MaxLength(500)]
    public string PasswordHash { get; set; } = string.Empty;
}
```

Add to `Product` (and import `Microsoft.AspNetCore.Mvc.ModelBinding.Validation`) so the database remains non-nullable while request validation does not demand a client-owned BU value:

```csharp
[ValidateNever, MaxLength(15)]
public string BUID { get; set; } = string.Empty;
```

Add `public DbSet<AppCredential> AppCredentials => Set<AppCredential>();` to `CatalogDbContext`, then add these mappings in `OnModelCreating`:

```csharp
product.Property(entity => entity.BUID).HasMaxLength(15).IsUnicode().IsRequired();

modelBuilder.Entity<AppCredential>(credential =>
{
    credential.ToTable("AppCredentials", "dbo");
    credential.HasKey(entity => entity.UserName);
    credential.Property(entity => entity.UserName).HasMaxLength(15).IsUnicode().IsRequired();
    credential.Property(entity => entity.PasswordHash).HasMaxLength(500).IsUnicode().IsRequired();
});
```

- [ ] **Step 4: Replace runtime Product samples with idempotent schema changes and seeds**

Remove the `CreateScope` Product seeding block from `Program.cs`; SQL owns all sample rows.

In `SDK_Minimal_Schema.sql`, make new `Products` tables include:

```sql
[BUID] NVARCHAR(15) NOT NULL,
```

Immediately after the guarded Products creation block, add the existing-database migration:

```sql
IF COL_LENGTH(N'dbo.Products', N'BUID') IS NULL
BEGIN
    ALTER TABLE [dbo].[Products] ADD [BUID] NVARCHAR(15) NULL;
    UPDATE [dbo].[Products] SET [BUID] = N'C100' WHERE [BUID] IS NULL;
    ALTER TABLE [dbo].[Products] ALTER COLUMN [BUID] NVARCHAR(15) NOT NULL;
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'AppCredentials' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
    CREATE TABLE [dbo].[AppCredentials]
    (
        [UserName] NVARCHAR(15) NOT NULL,
        [PasswordHash] NVARCHAR(500) NOT NULL,
        CONSTRAINT [PK_AppCredentials] PRIMARY KEY CLUSTERED ([UserName]),
        CONSTRAINT [FK_AppCredentials_loginusers] FOREIGN KEY ([UserName])
            REFERENCES [dbo].[loginusers]([userName]) ON DELETE CASCADE
    );
END
GO
```

Replace the old `demo` seed with exact idempotent seeds for:

```sql
-- C100 already exists; add C200.
IF NOT EXISTS (SELECT 1 FROM dbo.HH_SA_BU WHERE BUID = N'C200')
    INSERT INTO dbo.HH_SA_BU
        (BUID, Description, DescriptionA, Level, ShortCode, CreatedOn, Createdby)
    VALUES (N'C200', N'Viewer Business Unit', N'وحدة أعمال المشاهد', 0, N'C200', GETDATE(), N'system');
GO

IF NOT EXISTS (SELECT 1 FROM dbo.HH_SA_Roles WHERE RoleID = N'viewer')
    INSERT INTO dbo.HH_SA_Roles
        (RoleID, Description, DescriptionA, NeedExplicitUpdatePermission, CreatedOn, Createdby)
    VALUES (N'viewer', N'Viewer', N'مشاهد', 1, GETDATE(), N'system');
GO

IF NOT EXISTS (SELECT 1 FROM dbo.loginusers WHERE userName = N'admin')
    INSERT INTO dbo.loginusers
        (userName, RoleID, BUID, InActive, FullName, CreatedOn, Createdby)
    VALUES (N'admin', N'admin', N'C100', 0, N'Administrator', GETDATE(), N'system');
ELSE
    UPDATE dbo.loginusers SET RoleID = N'admin', BUID = N'C100', InActive = 0
    WHERE userName = N'admin';
GO

IF NOT EXISTS (SELECT 1 FROM dbo.loginusers WHERE userName = N'viewer')
    INSERT INTO dbo.loginusers
        (userName, RoleID, BUID, InActive, FullName, CreatedOn, Createdby)
    VALUES (N'viewer', N'viewer', N'C200', 0, N'Viewer', GETDATE(), N'system');
ELSE
    UPDATE dbo.loginusers SET RoleID = N'viewer', BUID = N'C200', InActive = 0
    WHERE userName = N'viewer';
GO
```

Delete only the old script-owned `demo` records and seed the two exact BU assignments:

```sql
DELETE FROM dbo.HH_SA_UserBUPermissions
WHERE UserID = N'demo'
  AND EXISTS (SELECT 1 FROM dbo.loginusers
              WHERE userName = N'demo' AND Createdby = N'system');
DELETE FROM dbo.loginusers WHERE userName = N'demo' AND Createdby = N'system';
GO

IF NOT EXISTS (SELECT 1 FROM dbo.HH_SA_UserBUPermissions
               WHERE UserID = N'admin' AND BUID = N'C100')
    INSERT INTO dbo.HH_SA_UserBUPermissions (UserID, BUID, CreatedOn, Createdby)
    VALUES (N'admin', N'C100', GETDATE(), N'system');
GO

IF NOT EXISTS (SELECT 1 FROM dbo.HH_SA_UserBUPermissions
               WHERE UserID = N'viewer' AND BUID = N'C200')
    INSERT INTO dbo.HH_SA_UserBUPermissions (UserID, BUID, CreatedOn, Createdby)
    VALUES (N'viewer', N'C200', GETDATE(), N'system');
GO
```

Then seed/update the security key and role flags:

```sql
IF NOT EXISTS (SELECT 1 FROM dbo.HH_SA_SecurityKeys WHERE KeyID = N'Products')
    INSERT INTO dbo.HH_SA_SecurityKeys
        (KeyID, Description, DescriptionA, Type, ModuleID, ModuleDesc, CreatedOn, Createdby)
    VALUES (N'Products', N'Products', N'المنتجات', 0, N'Catalog', N'Catalog', GETDATE(), N'system');
GO

IF NOT EXISTS (SELECT 1 FROM dbo.HH_SA_RolePermissions WHERE RoleID = N'admin' AND KeyID = N'Products')
    INSERT INTO dbo.HH_SA_RolePermissions
        (RoleID, KeyID, CanRead, CanInsert, CanUpdate, CanDelete, CanExecute, CreatedOn, Createdby)
    VALUES (N'admin', N'Products', 1, 1, 1, 1, 0, GETDATE(), N'system');
ELSE
    UPDATE dbo.HH_SA_RolePermissions
    SET CanRead = 1, CanInsert = 1, CanUpdate = 1, CanDelete = 1, CanExecute = 0
    WHERE RoleID = N'admin' AND KeyID = N'Products';
GO

IF NOT EXISTS (SELECT 1 FROM dbo.HH_SA_RolePermissions WHERE RoleID = N'viewer' AND KeyID = N'Products')
    INSERT INTO dbo.HH_SA_RolePermissions
        (RoleID, KeyID, CanRead, CanInsert, CanUpdate, CanDelete, CanExecute, CreatedOn, Createdby)
    VALUES (N'viewer', N'Products', 1, 0, 0, 0, 0, GETDATE(), N'system');
ELSE
    UPDATE dbo.HH_SA_RolePermissions
    SET CanRead = 1, CanInsert = 0, CanUpdate = 0, CanDelete = 0, CanExecute = 0
    WHERE RoleID = N'viewer' AND KeyID = N'Products';
GO
```

Seed Products by `(Name, BUID)` with these exact rows so re-running does not duplicate them:

```sql
IF NOT EXISTS (SELECT 1 FROM dbo.Products WHERE Name = N'Coffee' AND BUID = N'C100')
    INSERT INTO dbo.Products (Name, Price, StockQuantity, IsActive, BUID)
    VALUES (N'Coffee', 5.50, 24, 1, N'C100');
IF NOT EXISTS (SELECT 1 FROM dbo.Products WHERE Name = N'Tea' AND BUID = N'C100')
    INSERT INTO dbo.Products (Name, Price, StockQuantity, IsActive, BUID)
    VALUES (N'Tea', 3.25, 36, 1, N'C100');
IF NOT EXISTS (SELECT 1 FROM dbo.Products WHERE Name = N'Juice' AND BUID = N'C200')
    INSERT INTO dbo.Products (Name, Price, StockQuantity, IsActive, BUID)
    VALUES (N'Juice', 4.75, 18, 1, N'C200');
IF NOT EXISTS (SELECT 1 FROM dbo.Products WHERE Name = N'Water' AND BUID = N'C200')
    INSERT INTO dbo.Products (Name, Price, StockQuantity, IsActive, BUID)
    VALUES (N'Water', 1.50, 48, 1, N'C200');
GO
```

Do not insert password values or password hashes in SQL.

- [ ] **Step 5: Run the focused tests and verify GREEN**

Run the Step 2 command. Expected: all non-SQL model tests pass; when SQL Server is configured, schema application passes twice and all new schema/seed assertions pass.

- [ ] **Step 6: Commit**

```bash
git add backend/SdkProductCrud.Api/AppCredential.cs \
  backend/SdkProductCrud.Api/Product.cs \
  backend/SdkProductCrud.Api/CatalogDbContext.cs \
  backend/SdkProductCrud.Api/Program.cs \
  backend/database/SDK_Minimal_Schema.sql \
  backend/SdkProductCrud.Api.Tests/CatalogConfigurationTests.cs \
  backend/SdkProductCrud.Api.Tests/SqlServerSchemaTests.cs \
  backend/SdkProductCrud.Api.Tests/ProductApiTests.cs
git commit -m "feat: add BU-scoped product security data"
```

---

### Task 2: Register BI-SDK Security and Issue Demo JWTs

**Files:**
- Create: `backend/SdkProductCrud.Api/DemoCredentialOptions.cs`
- Create: `backend/SdkProductCrud.Api/DemoCredentialSeeder.cs`
- Create: `backend/SdkProductCrud.Api/AuthContracts.cs`
- Create: `backend/SdkProductCrud.Api/AuthController.cs`
- Modify: `backend/SdkProductCrud.Api/CatalogDataServiceCollectionExtensions.cs`
- Modify: `backend/SdkProductCrud.Api/Program.cs`
- Create: `backend/SdkProductCrud.Api.Tests/AuthApiTests.cs`
- Create: `backend/SdkProductCrud.Api.Tests/ProductApiFactory.cs`
- Modify: `backend/SdkProductCrud.Api.Tests/ProductApiTests.cs`
- Modify: `backend/SdkProductCrud.Api.Tests/CatalogConfigurationTests.cs`

**Interfaces:**
- Consumes: Task 1's `CatalogDbContext.AppCredentials`, SDK `loginusers`, and configuration keys in Global Constraints.
- Produces: anonymous `POST /Auth/Login`, `LoginRequest`, `LoginResponse`, `UserSummary`, `ProductPermissions`, startup credential hashes, and the authenticated request pipeline used by Task 3.

- [ ] **Step 1: Write failing configuration, credential, and login tests**

In `CatalogConfigurationTests`, replace the old `CurrentBUContext` concrete-type assertion with registrations that include JWT settings, then assert:

```csharp
Assert.IsType<CurrentBUContext>(currentBusinessUnit);
Assert.NotNull(scope.ServiceProvider.GetRequiredService<IPermissions>());
Assert.NotNull(provider.GetRequiredService<IAuthenticationSchemeProvider>());
```

Create `ProductApiFactory.cs` by moving the existing nested `ProductApiFactory` out of `ProductApiTests` unchanged except for making it `internal sealed`. Extend `ConfigureWebHost` with the following settings so every SQL-backed API test starts with valid auth configuration:

```csharp
builder.UseSetting("JWT:Key", "integration-test-signing-key-at-least-32-characters");
builder.UseSetting("JWT:ValidIssuer", "SdkProductCrud.Tests");
builder.UseSetting("JWT:ValidAudience", "SdkProductCrud.Frontend.Tests");
builder.UseSetting("DemoCredentials:AdminPassword", "Admin-Test-Password-123!");
builder.UseSetting("DemoCredentials:ViewerPassword", "Viewer-Test-Password-123!");
```

Add these behaviors:

```csharp
[SqlServerFact]
public async Task Login_returns_a_short_lived_SDK_JWT_and_admin_permissions()
{
    await WithSqlServerApiAsync(async (database, client) =>
    {
        var response = await client.PostAsJsonAsync("/Auth/Login", new
        {
            UserName = "admin",
            Password = "Admin-Test-Password-123!"
        });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var login = await response.Content.ReadFromJsonAsync<LoginResponse>();
        Assert.NotNull(login);
        Assert.Equal("admin", login.User.UserName);
        Assert.Equal("admin", login.User.Role);
        Assert.Equal("C100", login.User.BUID);
        Assert.True(login.Permissions.CanRead);
        Assert.True(login.Permissions.CanCreate);
        Assert.True(login.Permissions.CanUpdate);
        Assert.True(login.Permissions.CanDelete);

        var jwt = new JwtSecurityTokenHandler().ReadJwtToken(login.Token);
        Assert.Contains(jwt.Claims, claim => claim.Value == "admin" &&
            claim.Type is "unique_name" or "name");
        Assert.Contains(jwt.Claims, claim => claim.Value == "admin" &&
            claim.Type is "role" or ClaimTypes.Role);
        Assert.Equal("C100", jwt.Claims.Single(c => c.Type == "BUID").Value);
        Assert.False(string.IsNullOrWhiteSpace(jwt.Id));
        Assert.InRange(jwt.ValidTo - jwt.ValidFrom, TimeSpan.FromMinutes(14), TimeSpan.FromMinutes(15));
    });
}
```

Add the Viewer and invalid-login cases with literal expectations:

```csharp
[SqlServerFact]
public async Task Login_returns_read_only_permissions_for_viewer()
{
    await WithSqlServerApiAsync(async (_, client) =>
    {
        var response = await client.PostAsJsonAsync("/Auth/Login", new
        {
            UserName = "viewer",
            Password = "Viewer-Test-Password-123!"
        });
        var login = await response.Content.ReadFromJsonAsync<LoginResponse>();

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(new ProductPermissions(true, false, false, false), login!.Permissions);
        Assert.Equal(new UserSummary("viewer", "viewer", "C200"), login.User);
    });
}

[SqlServerFact]
public async Task Login_rejects_wrong_password_and_unknown_user_with_the_same_response()
{
    await WithSqlServerApiAsync(async (_, client) =>
    {
        foreach (var request in new[]
        {
            new { userName = "admin", password = "wrong-password" },
            new { userName = "missing", password = "Admin-Test-Password-123!" }
        })
        {
            var response = await client.PostAsJsonAsync("/Auth/Login", request);
            Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
            Assert.Equal(
                "Invalid username or password.",
                (await response.Content.ReadFromJsonAsync<JsonElement>())
                    .GetProperty("message").GetString());
        }
    });
}
```

For the inactive case, set `viewer.InActive = 1` directly in the isolated test database, submit the correct password, and assert the identical 401 status/body. Query both `AppCredentials` rows and assert each `PasswordHash` is unequal to both configured plaintext values.

Add this non-SQL configuration theory:

```csharp
[Theory]
[InlineData("DemoCredentials:AdminPassword")]
[InlineData("DemoCredentials:ViewerPassword")]
public void Demo_credentials_name_the_missing_configuration_key(string missingKey)
{
    var values = new Dictionary<string, string?>
    {
        ["DemoCredentials:AdminPassword"] = "admin-secret",
        ["DemoCredentials:ViewerPassword"] = "viewer-secret"
    };
    values[missingKey] = null;
    var configuration = new ConfigurationBuilder().AddInMemoryCollection(values).Build();

    var error = Assert.Throws<InvalidOperationException>(
        () => DemoCredentialOptions.FromConfiguration(configuration));

    Assert.Contains(missingKey, error.Message, StringComparison.Ordinal);
}
```

- [ ] **Step 2: Run the auth tests and verify RED**

Run:

```bash
dotnet test backend/SdkProductCrud.Api.Tests/SdkProductCrud.Api.Tests.csproj --no-restore \
  --filter "FullyQualifiedName~AuthApiTests|FullyQualifiedName~CatalogConfigurationTests"
```

Expected: compile failures because the auth contracts, options, security registrations, and endpoint do not exist.

- [ ] **Step 3: Add strict startup options and hash seeding**

Create a public `DemoCredentialOptions` record with `AdminPassword` and `ViewerPassword` plus:

```csharp
public static DemoCredentialOptions FromConfiguration(IConfiguration configuration)
{
    static string Required(IConfiguration configuration, string key) =>
        string.IsNullOrWhiteSpace(configuration[key])
            ? throw new InvalidOperationException($"Missing required configuration value '{key}'.")
            : configuration[key]!;

    return new(
        Required(configuration, "DemoCredentials:AdminPassword"),
        Required(configuration, "DemoCredentials:ViewerPassword"));
}
```

Validate `JWT:Key`, `JWT:ValidIssuer`, and `JWT:ValidAudience` with the same clear-key error format before building the application. Require a signing key of at least 32 UTF-8 bytes and report `JWT:Key` if it is too short.

Create `DemoCredentialSeeder` with:

```csharp
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
```

Register the options instance, `IPasswordHasher<AppCredential>`, and seeder. Resolve and run the seeder in the startup scope before `MapControllers()`.

- [ ] **Step 4: Register the complete SDK security pipeline**

Change `AddCatalogData` to keep only `AddSalesBuzzDb<CatalogDbContext>(configuration)`; remove its manual `IHttpContextAccessor` and `ICurrentBUContext` registrations.

In `Program.cs`, after OData/exception registration and before `AddCatalogData`, add:

```csharp
builder.Services.AddSalesBuzzJwt(builder.Configuration);
builder.Services.AddAuthorization();
builder.Services.AddSalesBuzzCurrentBU();
```

After exception handling and CORS, use this exact order:

```csharp
app.UseStaticHttpContext();
app.UseAuthentication();
app.UseAuthorization();
```

Do not add `UseSalesBuzzTokenValidation()`.

- [ ] **Step 5: Implement the anonymous login endpoint**

Create public JSON contracts:

```csharp
public sealed record LoginRequest(string? UserName, string? Password);
public sealed record UserSummary(string UserName, string Role, string BUID);
public sealed record ProductPermissions(
    bool CanRead, bool CanCreate, bool CanUpdate, bool CanDelete);
public sealed record LoginResponse(
    string Token, DateTime ExpiresAt, UserSummary User, ProductPermissions Permissions);
```

Create `[ApiController]`, `[Route("Auth")]` `AuthController`. Mark `Login` with `[HttpPost("Login")]` and `[AllowAnonymous]`. Set `var userName = request.UserName?.Trim();`; if username or password is null/blank, return the generic response below. Do not trim or otherwise alter nonblank password text. Query an active `loginusers` row, then its `AppCredential`; verify with `IPasswordHasher<AppCredential>`. Every lookup/verification failure returns:

```csharp
return Unauthorized(new { message = "Invalid username or password." });
```

Read the role's `Products` row from `db.HH_SA_RolePermissions`, convert its byte flags to booleans, and issue a token with:

```csharp
var expiresAt = DateTime.UtcNow.AddMinutes(15);
var claims = new[]
{
    new Claim(ClaimTypes.Name, user.userName),
    new Claim(ClaimTypes.Role, user.RoleID),
    new Claim("BUID", user.BUID),
    new Claim(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString("N")),
};
var credentials = new SigningCredentials(
    new SymmetricSecurityKey(Encoding.UTF8.GetBytes(configuration["JWT:Key"]!)),
    SecurityAlgorithms.HmacSha256);
var token = new JwtSecurityToken(
    issuer: configuration["JWT:ValidIssuer"],
    audience: configuration["JWT:ValidAudience"],
    claims: claims,
    notBefore: DateTime.UtcNow,
    expires: expiresAt,
    signingCredentials: credentials);
```

Return `LoginResponse` using `JwtSecurityTokenHandler.WriteToken(token)`. Guard against null/blank `BUID` or `RoleID` by returning the same generic 401.

- [ ] **Step 6: Run the auth tests and verify GREEN**

Run the Step 2 command. Expected: all non-SQL registration/configuration tests pass; with SQL Server configured, both accounts are seeded with hashes, valid login returns correct claims/flags, and every invalid login returns 401.

- [ ] **Step 7: Commit**

```bash
git add backend/SdkProductCrud.Api backend/SdkProductCrud.Api.Tests
git commit -m "feat: add demo JWT login"
```

---

### Task 3: Enforce Product Permissions and Current BU

**Files:**
- Modify: `backend/SdkProductCrud.Api/ProductsController.cs`
- Modify: `backend/SdkProductCrud.Api.Tests/ProductApiTests.cs`
- Create: `backend/SdkProductCrud.Api.Tests/ProductAuthorizationTests.cs`

**Interfaces:**
- Consumes: Task 2's JWT endpoint/security middleware and Task 1's `Product.BUID`.
- Produces: authenticated, permission-gated, BU-scoped Product OData CRUD contract consumed by the existing frontend and Tasks 4–5.

- [ ] **Step 1: Write failing attribute contract tests**

Add a non-SQL reflection test that checks `ProductsController` has `[Authorize]` and that `Get`, `Post`, `Patch`, and `Delete` each have one `HasPermission` whose constructor arguments are exactly `"Products"` and the corresponding `PermissionKind`. Assert there is no method-level `[AllowAnonymous]`.

- [ ] **Step 2: Write failing SQL-backed authorization and isolation tests**

Create helpers `LoginAsync(client, userName, password)` and `Authorize(client, token)`. Add separate tests proving:

- unauthenticated GET and POST return 401;
- Admin GET returns only `C100` Products and the OData count matches the filtered set;
- Viewer GET returns only `C200` Products;
- Admin POST ignores a supplied `BUID = "C200"` and persists/returns `C100`;
- Viewer POST, PATCH, and DELETE are rejected by the SDK permission filter;
- Admin PATCH/DELETE of a `C200` key return 404 and leave the row unchanged;
- Admin PATCH containing either `Id` or `BUID` returns 400;
- Admin can create, patch, and delete a `C100` Product.

Use literal expected product names from Task 1's seeds; do not derive expected BU results by applying the controller's filtering logic in the test.

Use this helper contract and literal BU read assertions:

```csharp
private static async Task<string> LoginAsync(HttpClient client, string userName, string password)
{
    var response = await client.PostAsJsonAsync("/Auth/Login", new { userName, password });
    response.EnsureSuccessStatusCode();
    return (await response.Content.ReadFromJsonAsync<LoginResponse>())!.Token;
}

private static void Authorize(HttpClient client, string token) =>
    client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);

[SqlServerFact]
public async Task Product_reads_are_scoped_before_OData_counting()
{
    await WithSqlServerApiAsync(async (_, client) =>
    {
        Authorize(client, await LoginAsync(client, "admin", "Admin-Test-Password-123!"));
        var admin = await client.GetFromJsonAsync<JsonElement>("/Products?$orderby=Name&$count=true");
        Assert.Equal(2, admin.GetProperty("@odata.count").GetInt32());
        Assert.Equal(
            new[] { "Coffee", "Tea" },
            admin.GetProperty("value").EnumerateArray()
                .Select(item => item.GetProperty("Name").GetString()).ToArray());

        Authorize(client, await LoginAsync(client, "viewer", "Viewer-Test-Password-123!"));
        var viewer = await client.GetFromJsonAsync<JsonElement>("/Products?$orderby=Name&$count=true");
        Assert.Equal(2, viewer.GetProperty("@odata.count").GetInt32());
        Assert.Equal(
            new[] { "Juice", "Water" },
            viewer.GetProperty("value").EnumerateArray()
                .Select(item => item.GetProperty("Name").GetString()).ToArray());
    });
}

[SqlServerFact]
public async Task Viewer_cannot_create_update_or_delete_products()
{
    await WithSqlServerApiAsync(async (_, client) =>
    {
        Authorize(client, await LoginAsync(client, "viewer", "Viewer-Test-Password-123!"));
        using var post = new HttpRequestMessage(HttpMethod.Post, "/Products")
        {
            Content = JsonContent.Create(new { Name = "Blocked", Price = 1, StockQuantity = 1 })
        };
        using var patch = new HttpRequestMessage(HttpMethod.Patch, "/Products(3)")
        {
            Content = JsonContent.Create(new { Price = 2 })
        };
        using var delete = new HttpRequestMessage(HttpMethod.Delete, "/Products(3)");

        Assert.Equal(HttpStatusCode.Unauthorized, (await client.SendAsync(post)).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.SendAsync(patch)).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.SendAsync(delete)).StatusCode);
    });
}
```

Use an Admin token and the known C200 `Juice` key looked up directly from the isolated database to assert PATCH and DELETE each return 404, then query SQL directly to assert `Juice` still has price `4.75` and remains present. Parameterize protected-property PATCH payloads as raw JSON (`{"Id":1}` and `{"BUID":"C200"}`) and assert 400. For Admin CRUD, POST with a deliberately wrong `BUID`, assert the response BUID is `C100`, then PATCH its price and DELETE it with 204 responses.

- [ ] **Step 3: Run the Product authorization tests and verify RED**

Run:

```bash
dotnet test backend/SdkProductCrud.Api.Tests/SdkProductCrud.Api.Tests.csproj --no-restore \
  --filter "FullyQualifiedName~ProductAuthorizationTests"
```

Expected: attribute tests fail because authorization attributes are absent; SQL tests expose unauthenticated access, unscoped reads/writes, and accepted `BUID` patches.

- [ ] **Step 4: Apply operation permissions and BU scoping**

Change the constructor to:

```csharp
public sealed class ProductsController(
    CatalogDbContext db,
    ICurrentBUContext currentBusinessUnit) : ODataController
```

Add `[Authorize]` to the controller. Add exact operation attributes:

```csharp
[HasPermission("Products", PermissionKind.Read)]    // Get
[HasPermission("Products", PermissionKind.Create)]  // Post
[HasPermission("Products", PermissionKind.Update)]  // Patch
[HasPermission("Products", PermissionKind.Delete)]  // Delete
```

Implement the boundaries:

```csharp
[EnableQuery]
public IQueryable<Product> Get()
{
    var buid = currentBusinessUnit.GetUserBUID();
    return db.Products.AsNoTracking().Where(product => product.BUID == buid);
}
```

At the top of POST, after model validation and before `Add`, assign:

```csharp
product.BUID = currentBusinessUnit.GetUserBUID();
```

For PATCH, reject either protected property case-insensitively:

```csharp
var protectedProperties = delta.GetChangedPropertyNames().Where(property =>
    string.Equals(property, nameof(Product.Id), StringComparison.OrdinalIgnoreCase) ||
    string.Equals(property, nameof(Product.BUID), StringComparison.OrdinalIgnoreCase)).ToArray();
if (protectedProperties.Length > 0)
{
    foreach (var property in protectedProperties)
        ModelState.AddModelError(property, $"The product {property} cannot be changed.");
    return BadRequest(ModelState);
}
```

Replace both `FindAsync(key)` calls with:

```csharp
var buid = currentBusinessUnit.GetUserBUID();
var product = await db.Products.SingleOrDefaultAsync(entity =>
    entity.Id == key && entity.BUID == buid);
```

Keep OData's `[EnableQuery]`, response types, validation, and data source URLs unchanged.

- [ ] **Step 5: Run focused and existing backend tests**

Run:

```bash
dotnet test backend/SdkProductCrud.Api.Tests/SdkProductCrud.Api.Tests.csproj --no-restore
```

Expected: all unit tests pass. With SQL Server configured, all login, Product CRUD, permission, BU isolation, schema, search, paging, sorting, and validation tests pass. Update older Product tests to login as Admin before accessing `/Products`; do not weaken their existing assertions.

- [ ] **Step 6: Commit**

```bash
git add backend/SdkProductCrud.Api/ProductsController.cs \
  backend/SdkProductCrud.Api.Tests/ProductApiTests.cs \
  backend/SdkProductCrud.Api.Tests/ProductAuthorizationTests.cs
git commit -m "feat: secure products by permission and BU"
```

---

### Task 4: Store the Angular Session and Attach Bearer Tokens

**Files:**
- Create: `frontend/src/app/auth.models.ts`
- Create: `frontend/src/app/auth.service.ts`
- Create: `frontend/src/app/auth.service.spec.ts`
- Create: `frontend/src/app/auth.interceptor.ts`
- Create: `frontend/src/app/auth.interceptor.spec.ts`
- Modify: `frontend/src/app/app.config.ts`
- Modify: `frontend/proxy.conf.json`

**Interfaces:**
- Consumes: Task 2's `POST /Auth/Login` response and existing `PublicApiClient` abstraction.
- Produces: `AuthService.session`, `AuthService.login`, `AuthService.logout`, `AuthService.token`, and `authInterceptor` for Task 5.

- [ ] **Step 1: Write failing AuthService behavior tests**

Define literal fixtures matching the backend's PascalCase JSON policy output as received by Angular's default serializer (ASP.NET Core emits camelCase):

```typescript
export interface ProductPermissions {
  canRead: boolean;
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
}

export interface AuthSession {
  token: string;
  expiresAt: string;
  user: { userName: string; role: string; buid: string };
  permissions: ProductPermissions;
}
```

Test with a real `AuthService` and a narrow fake `PublicApiClient` that:

- `login('admin', 'secret')` posts exactly `{ userName: 'admin', password: 'secret' }` to `/Auth/Login`, stores the returned object under `sdk-product-crud.auth`, and updates the signal;
- construction restores a non-expired stored session;
- construction removes expired or malformed storage;
- `logout()` clears both signal and storage.

Use a fixed future ISO timestamp rather than computing an expectation with service code.

- [ ] **Step 2: Write failing interceptor behavior tests**

Using `provideHttpClient(withInterceptors([authInterceptor]))` and `provideHttpClientTesting()`, assert:

- `/Products` gets `Authorization: Bearer <token>` when a session exists;
- `/Auth/Login` does not get an Authorization header;
- requests remain unchanged without a session;
- a 401 from `/Products` clears the session, while a 401 from `/Auth/Login` leaves the login failure available to the form and does not trigger a second mutation.

- [ ] **Step 3: Run the focused frontend tests and verify RED**

Run:

```bash
cd frontend && npm test -- --run src/app/auth.service.spec.ts src/app/auth.interceptor.spec.ts
```

Expected: compile failures because the models, service, and interceptor do not exist.

- [ ] **Step 4: Implement session state through PublicApiClient**

Create the interfaces above and:

```typescript
export const AUTH_SESSION_KEY = 'sdk-product-crud.auth';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly client = inject(PublicApiClient);
  private readonly sessionState = signal<AuthSession | null>(this.restore());
  readonly session = this.sessionState.asReadonly();
  readonly token = computed(() => this.sessionState()?.token ?? null);

  login(userName: string, password: string): Observable<AuthSession> {
    return this.client
      .post<AuthSession>('/Auth/Login', { userName, password })
      .pipe(tap((session) => this.store(session)));
  }

  logout(): void {
    sessionStorage.removeItem(AUTH_SESSION_KEY);
    this.sessionState.set(null);
  }

  private store(session: AuthSession): void {
    sessionStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(session));
    this.sessionState.set(session);
  }

  private restore(): AuthSession | null {
    try {
      const raw = sessionStorage.getItem(AUTH_SESSION_KEY);
      if (!raw) return null;
      const session = JSON.parse(raw) as AuthSession;
      if (!session.token || Date.parse(session.expiresAt) <= Date.now()) {
        sessionStorage.removeItem(AUTH_SESSION_KEY);
        return null;
      }
      return session;
    } catch {
      sessionStorage.removeItem(AUTH_SESSION_KEY);
      return null;
    }
  }
}
```

- [ ] **Step 5: Implement and register the interceptor**

Create a functional interceptor that skips `/Auth/Login`, clones other requests with the bearer header when `auth.token()` is non-null, and uses `catchError` to call `auth.logout()` only for `HttpErrorResponse.status === 401` outside login before rethrowing with `throwError(() => error)`.

Change app configuration to:

```typescript
provideHttpClient(withInterceptors([authInterceptor])),
```

Add `/Auth` to `proxy.conf.json` with the same target and security settings as `/Products`.

- [ ] **Step 6: Run focused and full frontend unit tests**

Run:

```bash
cd frontend && npm test
```

Expected: the new AuthService/interceptor tests and all existing adapter/data-source/configuration tests pass.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/app/auth.models.ts \
  frontend/src/app/auth.service.ts \
  frontend/src/app/auth.service.spec.ts \
  frontend/src/app/auth.interceptor.ts \
  frontend/src/app/auth.interceptor.spec.ts \
  frontend/src/app/app.config.ts \
  frontend/proxy.conf.json
git commit -m "feat: add frontend auth session"
```

---

### Task 5: Render Login or the Permission-Aware BI Product Page

**Files:**
- Modify: `frontend/src/app/app.ts`
- Modify: `frontend/src/app/app.spec.ts`
- Modify: `frontend/src/app/app.real-grid.spec.ts`
- Modify: `frontend/src/styles.css`

**Interfaces:**
- Consumes: Task 4's `AuthService`, current `ProductDataSource`, and existing BI-Nav/BI-Grid bindings.
- Produces: two-state root UI, visible account/role/BUID summary, Admin full CRUD flags, Viewer read-only flags, and logout.

- [ ] **Step 1: Write failing root-component tests**

With real `AuthService` and mocked `PublicApiClient`, add separate tests proving:

- with no stored session the login form is visible, BI-Nav/BI-Grid are absent, and no Product read starts;
- submitting trimmed `admin` credentials calls `/Auth/Login`, shows a pending state, then renders Products and performs exactly one initial counted read;
- a 401 login response displays `Invalid username or password.` and leaves the form visible;
- an Admin session displays `admin`, `admin`, `C100` and passes true to BI-Nav's `CanInsert`, `CanUpdate`, `CanDelete` inputs;
- a Viewer session displays `viewer`, `viewer`, `C200` and passes false to all three mutation inputs;
- logout clears the Product UI and returns to login;
- the existing search escaping and data-source error-message behavior still works after login.

Update the real-grid test to establish an Admin session before component creation, then retain every existing assertion about the shipped BI Grid, navigation connection/buttons, headers, and single initial read. Add one real-grid Viewer assertion that `navigation.CanInsert`, `navigation.CanUpdate`, and `navigation.CanDelete` are false.

- [ ] **Step 2: Run App tests and verify RED**

Run:

```bash
cd frontend && npm test -- --run src/app/app.spec.ts
```

Expected: tests fail because the root always renders Products, always grants toolbar mutations, and has no login/logout state.

- [ ] **Step 3: Implement the two-state root component**

Inject `AuthService`; expose `loginError = signal('')` and `loginPending = signal(false)`. In `ngOnInit`, call `searchProducts('')` only when `auth.session()` is present.

Replace the template's unconditional page with:

```html
<main class="page">
  @if (!auth.session()) {
    <section class="login-card" aria-labelledby="login-title">
      <h1 id="login-title">Product Demo Login</h1>
      <form (submit)="login(userName.value, password.value, $event)">
        <label for="userName">Username</label>
        <input #userName id="userName" name="userName" autocomplete="username" required />
        <label for="password">Password</label>
        <input #password id="password" name="password" type="password"
               autocomplete="current-password" required />
        <button type="submit" [disabled]="loginPending()">
          {{ loginPending() ? 'Signing in…' : 'Sign in' }}
        </button>
      </form>
      @if (loginError()) {
        <p class="login-error" role="alert">{{ loginError() }}</p>
      }
    </section>
  } @else {
    <header class="session-bar">
      <div>
        <strong>{{ auth.session()!.user.userName }}</strong>
        <span>{{ auth.session()!.user.role }}</span>
        <span>BU {{ auth.session()!.user.buid }}</span>
      </div>
      <button type="button" (click)="logout()">Log out</button>
    </header>
    <h1>Products</h1>
    <BI-Nav
      [BIGrid]="grid"
      [DomID]="'ProductsNav'"
      [CanInsert]="auth.session()!.permissions.canCreate"
      [CanUpdate]="auth.session()!.permissions.canUpdate"
      [CanDelete]="auth.session()!.permissions.canDelete"
      [deleteConfirmMsg]="true"
      [navButtons]="navButtons"
    >
      <input
        class="product-search"
        type="search"
        aria-label="Search products"
        placeholder="Search products"
        (input)="searchProducts($any($event.target).value)"
      />
    </BI-Nav>

    @if (dataSource.errorMessage()) {
      <p class="message" aria-live="polite">{{ dataSource.errorMessage() }}</p>
    }

    <BI-Grid
      #grid
      [DataService]="dataSource"
      [Columns]="columns"
      [changeSet]="changeSet"
      [GridName]="'Products'"
      [DomID]="'ProductsGrid'"
      [HasPaging]="true"
    ></BI-Grid>
  }
</main>
```

Keep all existing BI bindings except replace the three hard-coded flags with:

```html
[CanInsert]="auth.session()!.permissions.canCreate"
[CanUpdate]="auth.session()!.permissions.canUpdate"
[CanDelete]="auth.session()!.permissions.canDelete"
```

Implement:

```typescript
login(userName: string, password: string, event: Event): void {
  event.preventDefault();
  this.loginError.set('');
  this.loginPending.set(true);
  this.auth.login(userName.trim(), password).pipe(
    finalize(() => this.loginPending.set(false)),
  ).subscribe({
    next: () => this.searchProducts(''),
    error: () => this.loginError.set('Invalid username or password.'),
  });
}

logout(): void {
  this.auth.logout();
  this.dataSource.next({ data: [], total: 0 });
}
```

Do not put `BUID` in `Product`, Product form, columns, or client mutations beyond its optional presence in server responses; it is server-controlled.

- [ ] **Step 4: Add presentation-ready app-owned styling**

In `styles.css`, retain the existing rules and append exactly:

```css
.login-card {
  box-sizing: border-box;
  max-width: 26rem;
  margin: 10vh auto 0;
  padding: 2rem;
  border: 1px solid var(--border-color, #d6d6d6);
  border-radius: 0.75rem;
  background: #fff;
  box-shadow: 0 0.75rem 2rem rgb(0 0 0 / 8%);
}

.login-card form {
  display: grid;
  gap: 0.75rem;
}

.login-card label {
  font-weight: 600;
}

.login-card input,
.login-card button,
.session-bar button {
  min-height: 2.5rem;
  border: 1px solid var(--border-color, #767676);
  border-radius: 0.35rem;
  padding: 0.5rem 0.7rem;
  font: inherit;
}

.login-card button,
.session-bar button {
  cursor: pointer;
}

.login-card input:focus-visible,
.login-card button:focus-visible,
.session-bar button:focus-visible {
  outline: 3px solid #0b57d0;
  outline-offset: 2px;
}

.login-error {
  margin: 1rem 0 0;
  color: #b3261e;
}

.session-bar,
.session-bar div {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.session-bar {
  justify-content: space-between;
  margin-bottom: 1.5rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid var(--border-color, #d6d6d6);
}
```

Do not target or modify internal BI package classes.

- [ ] **Step 5: Run unit, real-package, and build verification**

Run:

```bash
cd frontend && npm test
cd frontend && npm run test:real-grid
cd frontend && npm run build
```

Expected: all unit tests pass, the real packaged BI Grid test passes for Admin and Viewer permissions, and the production Angular build exits 0.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/app/app.ts \
  frontend/src/app/app.spec.ts \
  frontend/src/app/app.real-grid.spec.ts \
  frontend/src/styles.css
git commit -m "feat: add permission-aware login UI"
```

---

### Task 6: Configure the Local Demo and Document Verification

**Files:**
- Modify: `.env.example`
- Modify: `run-local.sh`
- Modify: `README.md`

**Interfaces:**
- Consumes: Tasks 1–5 configuration names, database initializer, API, and Angular UI.
- Produces: one-command local presentation setup without committed secrets and an explicit manual verification script.

- [ ] **Step 1: Write a failing shell behavior check for environment loading**

Run a disposable copy of `run-local.sh` with an existing explicit `ConnectionStrings__DefaultConnection` and an `.env` containing demo/JWT variables while replacing `dotnet` and `npm` with PATH-local stubs that print their environment. Assert both stubs receive `JWT__Key`, `JWT__ValidIssuer`, `JWT__ValidAudience`, `DemoCredentials__AdminPassword`, and `DemoCredentials__ViewerPassword`. This fails against the current script because it sources `.env` only when the connection string is absent.

Keep this as a one-time red/green shell check in the task report; do not add a brittle test that greps the script's source text.

- [ ] **Step 2: Add secret placeholders and always load the optional local env file**

Append empty values to `.env.example`:

```dotenv
# Required by the API authentication demo. Supply local-only values.
JWT__Key=
JWT__ValidIssuer=SdkProductCrud
JWT__ValidAudience=SdkProductCrud.Frontend
DemoCredentials__AdminPassword=
DemoCredentials__ViewerPassword=
```

In `run-local.sh`, source `.env` near the top whenever it exists, before checking `ConnectionStrings__DefaultConnection`. If no explicit connection is set, keep the existing requirement for `.env` and `MSSQL_SA_PASSWORD`. Add required-value checks for all five auth variables after loading, regardless of whether the database connection was supplied externally. Do not print secret values.

- [ ] **Step 3: Update the README from unauthenticated sample to demo workflow**

Replace the statement that authentication is disabled. Document:

- copying `.env.example` to ignored `.env` and setting a 32-byte-or-longer random JWT key plus two non-shared demo passwords;
- running `./scripts/setup-sqlserver.sh` after schema changes and then `./run-local.sh`;
- logging in as `admin` to show full CRUD in `C100` and `viewer` to show read-only data in `C200`;
- passwords are hashed at startup into `AppCredentials`, plaintext is never stored in SQL, and changing a local demo password updates its stored hash next startup;
- tokens live only in browser `sessionStorage`, expire after 15 minutes, and logout clears them;
- backend `[HasPermission]` and BU filters enforce security regardless of button visibility;
- missing JWT/password configuration intentionally stops startup with the missing key named;
- the real SQL Server verification command and the complete frontend/backend verification commands below.

- [ ] **Step 4: Verify the shell behavior and syntax**

Re-run the Step 1 stubbed behavior check. Expected: both app processes receive all five auth settings even with an externally supplied connection string.

Run:

```bash
bash -n run-local.sh scripts/setup-sqlserver.sh
```

Expected: exit 0.

- [ ] **Step 5: Run the complete automated verification suite**

Run:

```bash
dotnet restore backend/SdkProductCrud.Api.Tests/SdkProductCrud.Api.Tests.csproj \
  --configfile backend/NuGet.config
dotnet test backend/SdkProductCrud.Api.Tests/SdkProductCrud.Api.Tests.csproj --no-restore
dotnet build backend/SdkProductCrud.Api/SdkProductCrud.Api.csproj --no-restore
cd frontend && npm test
cd frontend && npm run test:bi-package-patch
cd frontend && npm run test:real-grid
cd frontend && npm run build
```

Expected: all non-SQL tests and both builds pass; when `SQLSERVER_TEST_MASTER_CONNECTION` is available, all SQL integration tests pass with zero skips. If SQL Server is unavailable, report the exact skipped SQL test count and do not claim the SQL-backed behavior was verified.

- [ ] **Step 6: Perform the local end-to-end presentation check when SQL Server is available**

Apply the schema, start the app, and verify manually:

1. no session shows only the login form;
2. wrong credentials show the generic error;
3. Admin sees C100 identity, C100 Products, and full toolbar CRUD;
4. Viewer sees C200 identity, C200 Products, and a read-only toolbar;
5. a direct Viewer POST/PATCH/DELETE returns the SDK permission rejection;
6. an Admin request for a C200 Product key returns 404;
7. logout returns to login and removes `sdk-product-crud.auth` from session storage.

- [ ] **Step 7: Commit**

```bash
git add .env.example run-local.sh README.md
git commit -m "docs: add secure local demo setup"
```
