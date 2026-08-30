# BI Technical Design Report Design

## Purpose

Create a polished PDF that explains the SDK Product CRUD proof of concept to an
internship evaluator. The report's central argument is that a business page can
be developed separately and then added to the wider SalesBuzz application while
reusing BI's established frontend components and backend platform services. The
report must demonstrate technical understanding and implementation evidence
without presenting the trial as a production system or an ongoing operational
process.

## Audience and tone

The primary audience is an internship evaluator with general technical
knowledge. The writing will be formal, concise, and explanatory. Acronyms and
company-specific SDK concepts will be defined when first introduced. Claims will
be grounded in the implemented project files and tests.

## Deliverable

- One self-contained PDF under `output/pdf/`.
- Target length: 8-10 pages, with modest flexibility when layout requires it.
- Professional blue technology theme with restrained visual styling.
- Consistent headers, footers, page numbers, typography, margins, and spacing.
- No confidential credentials, local secrets, or unverified production claims.

## Content structure

1. Cover page
2. Executive summary
3. Purpose, trial scope, and exclusions
4. Technology stack
5. System architecture
6. Modularity feasibility case
7. Component design: Angular frontend, ASP.NET Core API, BI SDK, and SQL Server
8. Data model and Product entity
9. Authentication, permissions, and business-unit isolation
10. Login, read, and CRUD data flows
11. Verification strategy and demonstrated results
12. Limitations and production considerations
13. Conclusion and internship learning outcomes
14. Compact technical appendix when space permits

## Technical source of truth

The report will derive its technical details from the current implementation,
including the root README, application startup, controllers, services, entity
model, database schema, Angular services and components, tests, and the approved
SDK permissions/current-business-unit design document. It will distinguish
implemented behavior from recommendations.

## Visual design

The PDF will include:

- A high-level architecture diagram showing browser, Angular UI, API, BI SDK,
  Entity Framework Core, and SQL Server.
- A two-layer modularity diagram that separates the page-specific Product
  workflow from the reusable SalesBuzz/BI frontend and backend foundation.
- A security/data-flow diagram showing login, JWT issuance, permission checks,
  current-business-unit resolution, and filtered data access.
- Compact tables for the technology stack, Admin/Viewer access matrix, Product
  data model, reused platform capabilities, and verification coverage.

Diagrams will use simple boxes and arrows, remain readable when printed, and
avoid decorative complexity.

## Modularity feasibility argument

The modularity section will receive prominent treatment rather than appearing
only as a conclusion. It will explain the repeatable division of responsibility:

- The separately developed page owns its domain-specific model, Product CRUD
  workflow, columns, summaries, and presentation logic.
- BI provides reusable frontend building blocks such as BI Grid, BI Navigation,
  and the public client abstraction.
- The SalesBuzz/BI backend foundation provides authentication integration,
  permission enforcement, current-business-unit context, OData conventions,
  database integration, and shared security data.
- A future SalesBuzz business page can replace the Product-specific domain while
  retaining these platform integration points.

The evidence will connect each claim to the working implementation: the Product
page consumes shipped BI frontend packages, calls through the public client,
uses BI-SDK permission and BUID abstractions in the API, and persists through the
shared backend conventions. This demonstrates the technical feasibility of the
page-extension pattern and identifies a reusable contract between page-specific
code and the platform.

The report will not claim that dynamic plug-in installation, automatic page
discovery, navigation registration, version compatibility management, or final
embedding in the production SalesBuzz shell already exists. The current trial
runs as a standalone demonstration application. It proves the reusable page and
platform boundary; a production extension mechanism would formalize how such a
page is packaged, registered, loaded, governed, and supported inside SalesBuzz.

## Scope boundaries

The report will clearly state that the project is a proof of concept. Detailed
operations, disaster recovery, service-level agreements, enterprise monitoring,
and long-term support processes are excluded. A short production-considerations
section will identify the main work needed to move beyond the trial, such as
page registration and loading, navigation integration, compatibility/versioning
rules, managed identity, centralized secrets, supported hosting, observability,
production data governance, and operational ownership.

## Quality and verification

The final PDF will be checked for:

- Technical consistency with the repository.
- Clear separation of implemented features, trial limitations, and future work.
- A traceable evidence chain from the separate Product page to reused frontend
  components, backend SDK services, security enforcement, and persistence.
- Complete rendering with no clipped, overlapping, or unreadable content.
- Consistent page furniture and section hierarchy.
- Accurate page count, headings, diagrams, tables, and searchable text.
- Absence of placeholder text and secrets.

The PDF will be rendered to page images and visually inspected before delivery.
