# SDK Permissions and Current Business Unit Design

## Goal

Add a small, presentation-ready authentication flow that demonstrates the two
BI-SDK security features requested by the internship instructor:

- `[HasPermission]` protects Product CRUD operations by role.
- `ICurrentBUContext` scopes Product data to the logged-in user's business unit.

The existing Product CRUD page, BI Grid, BI Navigation, OData search, and SQL
Server setup remain in place.

## Scope

The demonstration has exactly two roles and two local demo accounts:

| Account | Role | Business unit | Product access |
| --- | --- | --- | --- |
| `admin` | Admin | `C100` | Read, create, update, delete |
| `viewer` | Viewer | `C200` | Read only |

The two demo passwords come from ignored local `.env` values. At startup, a
small seeder hashes them with ASP.NET Core's built-in password hasher and stores
only the hashes in a local `AppCredentials` table keyed to the SDK
`loginusers` rows. `.env.example` contains variable names but no usable secret,
and the README explains the one-time local values the presenter must set.

This feature does not add registration, password reset, refresh tokens, account
administration, or a general identity-management system.

## Backend design

### SDK registration

Replace the manually assembled current-BU registration with the SDK's complete
security registration:

- `AddSalesBuzzJwt(configuration)` configures bearer-token validation.
- `AddAuthorization()` enables ASP.NET Core authorization.
- `AddSalesBuzzCurrentBU()` registers `ICurrentBUContext`, `IPermissions`, BU
  control, and the permission services needed by `[HasPermission]`.
- `UseStaticHttpContext()` makes the active authenticated request available to
  SDK permission services.
- `UseAuthentication()` and `UseAuthorization()` are placed in the correct
  middleware order.

The existing SDK OData, exception handling, and `AddSalesBuzzDb` integration
remain unchanged. Session revocation middleware is excluded to keep the demo
focused; the requirement is authentication, permissions, and current BU rather
than a complete session-management system.

### Login

An anonymous `POST /Auth/Login` endpoint accepts username and password. It:

1. Finds an active SDK `loginusers` row and its `AppCredentials` password hash.
2. Verifies the password with ASP.NET Core's built-in password hasher.
3. Issues a short-lived JWT containing the exact user-name, role, BUID, and JTI
   claims expected by BI-SDK.
4. Returns the token plus a small user summary and UI permission flags.

The signing key and demo passwords are read from local configuration and are
never committed. Startup fails with a clear message when they are missing.

### Permissions

The `Products` security key is seeded into the existing SDK tables. Admin gets
Read/Create/Update/Delete; Viewer gets Read only.

`ProductsController` remains an OData controller and applies a separate SDK
permission attribute to every operation:

- GET: `PermissionKind.Read`
- POST: `PermissionKind.Create`
- PATCH: `PermissionKind.Update`
- DELETE: `PermissionKind.Delete`

The controller is authenticated as a whole, while the login endpoint remains
anonymous. Backend attributes are the security boundary; frontend button state
is only a user-experience improvement.

### Current Business Unit

`Product` gains a required `BUID` field, mapped to `nvarchar(15)`. The SQL schema
adds the column idempotently for both new and existing local databases and seeds
sample Products for `C100` and `C200`.

The controller injects `ICurrentBUContext` and uses `GetUserBUID()`:

- GET filters the `IQueryable<Product>` by the current BUID before OData applies
  search, paging, sorting, or count.
- POST ignores any client-supplied BUID and assigns the current BUID.
- PATCH finds the Product by both key and current BUID and forbids changing Id or
  BUID.
- DELETE finds the Product by both key and current BUID.

A product outside the current BU is returned as not found, avoiding disclosure
that another BU owns that key.

## Frontend design

The application shows a small login form when no valid session is present and
the existing Product page after login. Angular routing is not added because a
two-state root component is sufficient for this demo.

The login call goes through the company `PublicApiClient` abstraction. A small
authentication service stores the returned token in `sessionStorage`, exposes
the current role/BUID and permission flags, and clears the session on logout. An
Angular HTTP interceptor attaches the bearer token to API calls.

The existing BI components remain the Product UI:

- `BI-Nav` uses the returned flags for `CanInsert`, `CanUpdate`, and `CanDelete`.
- `BI-Grid` continues to use `ProductDataSource` for OData and CRUD.
- Viewer sees a read-only toolbar; Admin sees full CRUD.
- The page displays the current account, role, and BUID so the presentation can
  visibly demonstrate the SDK context.

No changes are made inside the packaged BI component source.

## Data flow

1. User submits the login form through `PublicApiClient`.
2. Backend verifies the password and returns a signed JWT with role and BUID.
3. Frontend stores the session and attaches the bearer token to later requests.
4. ASP.NET Core validates the JWT.
5. `[HasPermission]` checks the role's Product permission in SDK tables.
6. `ICurrentBUContext` reads BUID from the authenticated request.
7. `ProductsController` restricts the Entity Framework query or mutation to that
   BUID.
8. OData applies search/paging to the already BU-scoped query.

## Error behavior

- Invalid login returns a generic 401 without identifying which credential was
  wrong.
- Missing/invalid token returns 401.
- Missing operation permission is handled by BI-SDK's permission filter.
- A Product belonging to another BU returns 404.
- Existing shared SDK exception handling formats unexpected server errors.
- The frontend clears an invalid session and returns to login when appropriate.

## Verification

Backend tests cover JWT/security registration, permission attributes on all
controller actions, login success/failure, Admin CRUD, Viewer write rejection,
and BU isolation. SQL tests verify the new BUID and security seed records.

Frontend tests cover login state, bearer-token attachment, conditional Product
page rendering, Admin toolbar permissions, Viewer read-only permissions, logout,
and preservation of the existing search/CRUD behavior.

Final verification runs all frontend tests, the real BI Grid package test,
backend tests, builds, and an end-to-end local check when SQL Server is available.
