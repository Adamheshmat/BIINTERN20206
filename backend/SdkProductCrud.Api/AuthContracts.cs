using System.Text.Json.Serialization;

namespace SdkProductCrud.Api;

public sealed record LoginRequest(string? UserName, string? Password);

public sealed record UserSummary(
    [property: JsonPropertyName("userName")] string UserName,
    [property: JsonPropertyName("role")] string Role,
    [property: JsonPropertyName("buid")] string BUID);

public sealed record ProductPermissions(
    [property: JsonPropertyName("canRead")] bool CanRead,
    [property: JsonPropertyName("canCreate")] bool CanCreate,
    [property: JsonPropertyName("canUpdate")] bool CanUpdate,
    [property: JsonPropertyName("canDelete")] bool CanDelete);

public sealed record LoginResponse(
    [property: JsonPropertyName("token")] string Token,
    [property: JsonPropertyName("expiresAt")] DateTime ExpiresAt,
    [property: JsonPropertyName("user")] UserSummary User,
    [property: JsonPropertyName("permissions")] ProductPermissions Permissions);
