using Xunit;

namespace SdkProductCrud.Api.Tests;

public sealed class SqlServerSchemaTests
{
    [Fact]
    public void Project_schema_can_be_retargeted_and_split_into_sqlcmd_batches()
    {
        var batches = SqlServerTestDatabase.LoadProjectSchemaBatches("SdkProductCrudTest_Static");

        Assert.NotEmpty(batches);
        Assert.Contains("USE [SdkProductCrudTest_Static]", batches[0], StringComparison.Ordinal);
        Assert.DoesNotContain("USE [SdkProductCrud]", batches[0], StringComparison.Ordinal);
        Assert.All(batches, batch => Assert.False(string.IsNullOrWhiteSpace(batch)));
    }

    [SqlServerFact]
    public async Task Project_schema_is_idempotent_and_creates_the_SDK_and_product_objects()
    {
        await using var database = await SqlServerTestDatabase.CreateInitializedAsync();

        await database.ApplyProjectSchemaAsync();

        await using var connection = await database.OpenConnectionAsync();
        await using var command = connection.CreateCommand();
        command.CommandText = """
            SELECT
                IIF(OBJECT_ID(N'dbo.HH_SA_SecurityKeys', N'U') IS NULL, 0, 1),
                IIF(OBJECT_ID(N'dbo.Products', N'U') IS NULL, 0, 1),
                IIF(OBJECT_ID(N'dbo.Get_AuditCriteria', N'P') IS NULL, 0, 1),
                IIF(OBJECT_ID(N'dbo.AppCredentials', N'U') IS NULL, 0, 1),
                (SELECT COUNT(*) FROM dbo.HH_SA_BU WHERE BUID = N'C100'),
                (SELECT DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS
                 WHERE TABLE_SCHEMA = N'dbo' AND TABLE_NAME = N'Products' AND COLUMN_NAME = N'Price'),
                (SELECT NUMERIC_PRECISION FROM INFORMATION_SCHEMA.COLUMNS
                 WHERE TABLE_SCHEMA = N'dbo' AND TABLE_NAME = N'Products' AND COLUMN_NAME = N'Price'),
                (SELECT NUMERIC_SCALE FROM INFORMATION_SCHEMA.COLUMNS
                 WHERE TABLE_SCHEMA = N'dbo' AND TABLE_NAME = N'Products' AND COLUMN_NAME = N'Price'),
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
                (SELECT COUNT(DISTINCT BUID) FROM dbo.Products WHERE BUID IN (N'C100', N'C200'));
            """;

        await using var reader = await command.ExecuteReaderAsync();
        Assert.True(await reader.ReadAsync());
        Assert.Equal(1, reader.GetInt32(0));
        Assert.Equal(1, reader.GetInt32(1));
        Assert.Equal(1, reader.GetInt32(2));
        Assert.Equal(1, reader.GetInt32(3));
        Assert.Equal(1, reader.GetInt32(4));
        Assert.Equal("decimal", reader.GetString(5));
        Assert.Equal(18, reader.GetByte(6));
        Assert.Equal(2, reader.GetInt32(7));
        Assert.Equal(15, reader.GetInt32(8));
        Assert.Equal("NO", reader.GetString(9));
        Assert.Equal(2, reader.GetInt32(10));
        Assert.Equal(2, reader.GetInt32(11));
        Assert.Equal(1, reader.GetInt32(12));
        Assert.Equal(2, reader.GetInt32(13));
        Assert.Equal(2, reader.GetInt32(14));
        await reader.DisposeAsync();

        await using var secretCommand = connection.CreateCommand();
        secretCommand.CommandText = "SELECT COUNT(*) FROM dbo.AppCredentials";
        Assert.Equal(0, Convert.ToInt32(await secretCommand.ExecuteScalarAsync()));
    }
}
