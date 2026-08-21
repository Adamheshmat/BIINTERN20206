# SDK Product CRUD

## Prerequisites

- .NET 10 SDK
- A Node.js version supported by Angular 20 and npm
- The supplied BI package archives in `../Packages/npm` and `../Packages/nuget`
- Docker Desktop for the included local SQL Server, or access to the company SQL Server

If frontend dependencies are missing, install them once:

```sh
cd frontend && npm install
```

## Initialize local SQL Server

The optional local workflow uses SQL Server 2022 Developer in Docker, persists its
data in the named volume `sdk-product-crud-sqlserver-data`, and applies
`backend/database/SDK_Minimal_Schema.sql` idempotently.

1. Create the ignored local environment file and set a strong password:

   ```sh
   cp .env.example .env
   ```

   `.env` is loaded as shell syntax, so wrap passwords containing shell-special
   characters in single quotes.

2. Review the SQL Server container license terms. Running the next command sets
   `ACCEPT_EULA=Y`, so run it only if you accept those terms:

   ```sh
   ./scripts/setup-sqlserver.sh
   ```

The setup script starts the container, waits until it accepts connections, creates
`SdkProductCrud` if needed, and reapplies the guarded SDK schema and Products table.
Use `docker compose stop` to stop SQL Server. `docker compose down` removes the
container but keeps the named data volume; avoid `docker compose down -v` if the
data must be retained.

### Apple silicon support note

The Compose file explicitly requests `linux/amd64`. Microsoft supports SQL Server
container images only on x86-64 Linux hosts and does not support emulation or
translation environments such as Rosetta 2 or QEMU. Consequently, this Docker
workflow is not a Microsoft-supported SQL Server configuration on this arm64 Mac.
Use the company SQL Server as the supported alternative. See
[Microsoft's SQL Server container deployment guidance](https://learn.microsoft.com/en-us/sql/linux/containers/deploy?view=sql-server-ver17).

For the company server, have the database/schema initialized by the appropriate
database administrator and provide the connection directly instead of `.env`:

```sh
export ConnectionStrings__DefaultConnection='Server=company-host;Database=SdkProductCrud;User Id=...;Password=...;Encrypt=True;TrustServerCertificate=False'
```

## Run the app

```sh
./run-local.sh
```

The script starts the Angular app at <http://localhost:4200> and its API at
<http://localhost:5201>. When the explicit company connection is not set, it
generates `ConnectionStrings:DefaultConnection` from the same
`MSSQL_SA_PASSWORD`, host, and port used by the local container. Press Control+C
to stop both app processes; SQL Server remains available separately.

Authentication remains disabled for this sample. The API uses the BI-SDK SQL
Server context, shared OData registration, and shared exception middleware without
JWT registration, token-validation middleware, authorization attributes, or login UI.

## Backend tests

The SDK inheritance, SQL Server provider registration, model mapping, and schema
batch tests run without a database. Real schema/API tests require a SQL Server
master connection whose login can create and drop isolated test databases:

```sh
export SQLSERVER_TEST_MASTER_CONNECTION='Server=localhost,1433;Database=master;User Id=sa;Password=...;Encrypt=True;TrustServerCertificate=True'
dotnet restore backend/SdkProductCrud.Api.Tests/SdkProductCrud.Api.Tests.csproj \
  --configfile backend/NuGet.config
dotnet test backend/SdkProductCrud.Api.Tests/SdkProductCrud.Api.Tests.csproj --no-restore
```

When `SQLSERVER_TEST_MASTER_CONNECTION` is absent, only the real SQL Server tests
are reported as skipped; they never fall back to SQLite.

The Product fields are Id, Name, Price, Stock Quantity, and Is Active. The toolbar
provides Add, Edit, Save, Delete, and Cancel actions.
