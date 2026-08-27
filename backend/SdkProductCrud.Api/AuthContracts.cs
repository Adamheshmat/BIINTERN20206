namespace SdkProductCrud.Api;

public sealed record LoginRequest(string? UserName, string? Password);

public sealed record UserSummary(string UserName, string Role, string BUID);

public sealed record ProductPermissions(
    bool CanRead, bool CanCreate, bool CanUpdate, bool CanDelete);

public sealed record LoginResponse(
    string Token, DateTime ExpiresAt, UserSummary User, ProductPermissions Permissions);
