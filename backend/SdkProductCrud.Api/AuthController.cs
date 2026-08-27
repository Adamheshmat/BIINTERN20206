using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;

namespace SdkProductCrud.Api;

[ApiController]
[Route("Auth")]
public sealed class AuthController(
    CatalogDbContext db,
    IPasswordHasher<AppCredential> passwordHasher,
    IConfiguration configuration) : ControllerBase
{
    [HttpPost("Login")]
    [AllowAnonymous]
    public async Task<ActionResult<LoginResponse>> Login(LoginRequest request)
    {
        var userName = request.UserName?.Trim();
        if (string.IsNullOrWhiteSpace(userName) || string.IsNullOrWhiteSpace(request.Password))
        {
            return InvalidLogin();
        }

        var user = await db.loginusers.AsNoTracking().SingleOrDefaultAsync(candidate =>
            candidate.userName == userName && candidate.InActive == 0);
        if (user is null || string.IsNullOrWhiteSpace(user.BUID) || string.IsNullOrWhiteSpace(user.RoleID))
        {
            return InvalidLogin();
        }

        var credential = await db.AppCredentials.AsNoTracking().SingleOrDefaultAsync(candidate =>
            candidate.UserName == userName);
        if (credential is null ||
            passwordHasher.VerifyHashedPassword(credential, credential.PasswordHash, request.Password)
                == PasswordVerificationResult.Failed)
        {
            return InvalidLogin();
        }

        var permission = await db.HH_SA_RolePermissions.AsNoTracking().SingleOrDefaultAsync(candidate =>
            candidate.RoleID == user.RoleID && candidate.KeyID == "Products");
        if (permission is null)
        {
            return InvalidLogin();
        }

        var permissions = new ProductPermissions(
            permission.CanRead != 0,
            permission.CanInsert != 0,
            permission.CanUpdate != 0,
            permission.CanDelete != 0);
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

        return Ok(new LoginResponse(
            new JwtSecurityTokenHandler().WriteToken(token),
            expiresAt,
            new UserSummary(user.userName, user.RoleID, user.BUID),
            permissions));
    }

    private UnauthorizedObjectResult InvalidLogin() =>
        Unauthorized(new { message = "Invalid username or password." });
}
