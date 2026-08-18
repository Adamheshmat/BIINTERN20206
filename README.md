# SDK Product CRUD

## Prerequisites

- .NET 10 SDK
- A Node.js version supported by Angular 20 and npm
- The supplied BI package archives in `../Packages/npm`

If frontend dependencies are missing, install them once:

```sh
cd frontend && npm install
```

## Run locally

```sh
./run-local.sh
```

The script starts the Angular app at <http://localhost:4200> and its API at
<http://localhost:5201>. Press Control+C to stop both.

The Product fields are Id, Name, Price, Stock Quantity, and Is Active. The toolbar
provides Add, Edit, Save, Delete, and Cancel actions.
