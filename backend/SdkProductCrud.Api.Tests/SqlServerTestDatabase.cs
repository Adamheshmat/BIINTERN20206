using System.Text.RegularExpressions;
using Microsoft.Data.SqlClient;
using Xunit;

namespace SdkProductCrud.Api.Tests;

internal sealed class SqlServerTestDatabase : IAsyncDisposable
{
    internal const string ConnectionEnvironmentVariable = "SQLSERVER_TEST_MASTER_CONNECTION";
    private const string ProjectDatabaseName = "SdkProductCrud";
    private static readonly Regex SafeDatabaseName = new(
        "^[A-Za-z][A-Za-z0-9_]+$",
        RegexOptions.CultureInvariant);
    private static readonly Regex BatchSeparator = new(
        @"^[\t ]*GO[\t ]*(?:--[^\r\n]*)?\r?$",
        RegexOptions.Multiline | RegexOptions.IgnoreCase | RegexOptions.CultureInvariant);

    private readonly string masterConnectionString;

    private SqlServerTestDatabase(string masterConnectionString, string databaseName)
    {
        this.masterConnectionString = masterConnectionString;
        DatabaseName = databaseName;

        var databaseConnection = new SqlConnectionStringBuilder(masterConnectionString)
        {
            InitialCatalog = databaseName,
            Pooling = false
        };
        ConnectionString = databaseConnection.ConnectionString;
    }

    internal static bool IsConfigured =>
        !string.IsNullOrWhiteSpace(Environment.GetEnvironmentVariable(ConnectionEnvironmentVariable));

    internal string ConnectionString { get; }

    private string DatabaseName { get; }

    internal static async Task<SqlServerTestDatabase> CreateInitializedAsync()
    {
        var suppliedConnection = Environment.GetEnvironmentVariable(ConnectionEnvironmentVariable);
        if (string.IsNullOrWhiteSpace(suppliedConnection))
        {
            throw new InvalidOperationException(
                $"Set {ConnectionEnvironmentVariable} to a SQL Server connection that can create and drop databases.");
        }

        var masterConnection = new SqlConnectionStringBuilder(suppliedConnection)
        {
            InitialCatalog = "master",
            Pooling = false
        };
        var databaseName = $"SdkProductCrudTest_{Guid.NewGuid():N}";
        var database = new SqlServerTestDatabase(masterConnection.ConnectionString, databaseName);

        try
        {
            await database.CreateDatabaseAsync();
            await database.ApplyProjectSchemaAsync();
            return database;
        }
        catch
        {
            await database.DisposeAsync();
            throw;
        }
    }

    internal static IReadOnlyList<string> LoadProjectSchemaBatches(string databaseName)
    {
        if (!SafeDatabaseName.IsMatch(databaseName))
        {
            throw new ArgumentException("The database name contains unsupported characters.", nameof(databaseName));
        }

        var scriptPath = Path.GetFullPath(Path.Combine(
            AppContext.BaseDirectory,
            "..",
            "..",
            "..",
            "..",
            "database",
            "SDK_Minimal_Schema.sql"));
        var script = File.ReadAllText(scriptPath);
        var useStatement = $"USE [{ProjectDatabaseName}]";
        var useStatementIndex = script.IndexOf(useStatement, StringComparison.Ordinal);

        if (useStatementIndex < 0 ||
            script.IndexOf(useStatement, useStatementIndex + useStatement.Length, StringComparison.Ordinal) >= 0)
        {
            throw new InvalidOperationException(
                $"The project schema must contain exactly one '{useStatement}' statement.");
        }

        script = string.Concat(
            script.AsSpan(0, useStatementIndex),
            $"USE [{databaseName}]",
            script.AsSpan(useStatementIndex + useStatement.Length));

        return BatchSeparator.Split(script)
            .Where(batch => !string.IsNullOrWhiteSpace(batch))
            .Select(batch => batch.Trim())
            .ToArray();
    }

    internal async Task ApplyProjectSchemaAsync()
    {
        await using var connection = new SqlConnection(masterConnectionString);
        await connection.OpenAsync();

        foreach (var batch in LoadProjectSchemaBatches(DatabaseName))
        {
            await using var command = connection.CreateCommand();
            command.CommandText = batch;
            command.CommandTimeout = 120;
            await command.ExecuteNonQueryAsync();
        }
    }

    internal async Task<SqlConnection> OpenConnectionAsync()
    {
        var connection = new SqlConnection(ConnectionString);
        await connection.OpenAsync();
        return connection;
    }

    public async ValueTask DisposeAsync()
    {
        await using var connection = new SqlConnection(masterConnectionString);
        await connection.OpenAsync();
        await using var command = connection.CreateCommand();
        command.CommandText = $"""
            IF DB_ID(N'{DatabaseName}') IS NOT NULL
            BEGIN
                ALTER DATABASE [{DatabaseName}] SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
                DROP DATABASE [{DatabaseName}];
            END
            """;
        command.CommandTimeout = 120;
        await command.ExecuteNonQueryAsync();
    }

    private async Task CreateDatabaseAsync()
    {
        await using var connection = new SqlConnection(masterConnectionString);
        await connection.OpenAsync();
        await using var command = connection.CreateCommand();
        command.CommandText = $"CREATE DATABASE [{DatabaseName}]";
        command.CommandTimeout = 120;
        await command.ExecuteNonQueryAsync();
    }
}

[AttributeUsage(AttributeTargets.Method)]
internal sealed class SqlServerFactAttribute : FactAttribute
{
    public SqlServerFactAttribute()
    {
        if (!SqlServerTestDatabase.IsConfigured)
        {
            Skip = $"Set {SqlServerTestDatabase.ConnectionEnvironmentVariable} to run real SQL Server integration tests.";
        }
    }
}
