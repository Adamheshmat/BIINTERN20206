namespace SdkProductCrud.Api;

public sealed record DemoCredentialOptions(string AdminPassword, string ViewerPassword)
{
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
}
