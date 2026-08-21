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
                (SELECT COUNT(*) FROM dbo.HH_SA_BU WHERE BUID = N'C100'),
                (SELECT DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS
                 WHERE TABLE_SCHEMA = N'dbo' AND TABLE_NAME = N'Products' AND COLUMN_NAME = N'Price'),
                (SELECT NUMERIC_PRECISION FROM INFORMATION_SCHEMA.COLUMNS
                 WHERE TABLE_SCHEMA = N'dbo' AND TABLE_NAME = N'Products' AND COLUMN_NAME = N'Price'),
                (SELECT NUMERIC_SCALE FROM INFORMATION_SCHEMA.COLUMNS
                 WHERE TABLE_SCHEMA = N'dbo' AND TABLE_NAME = N'Products' AND COLUMN_NAME = N'Price');
            """;

        await using var reader = await command.ExecuteReaderAsync();
        Assert.True(await reader.ReadAsync());
        Assert.Equal(1, reader.GetInt32(0));
        Assert.Equal(1, reader.GetInt32(1));
        Assert.Equal(1, reader.GetInt32(2));
        Assert.Equal(1, reader.GetInt32(3));
        Assert.Equal("decimal", reader.GetString(4));
        Assert.Equal(18, reader.GetByte(5));
        Assert.Equal(2, reader.GetInt32(6));
    }
}
