# BI Technical Design Report Design

## Purpose

Create a polished PDF that explains the SDK Product CRUD proof of concept to an
internship evaluator. The report must demonstrate technical understanding and
implementation evidence without presenting the trial as a production system or
an ongoing operational process.

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
6. Component design: Angular frontend, ASP.NET Core API, BI SDK, and SQL Server
7. Data model and Product entity
8. Authentication, permissions, and business-unit isolation
9. Login, read, and CRUD data flows
10. Verification strategy and demonstrated results
11. Limitations and production considerations
12. Conclusion and internship learning outcomes
13. Compact technical appendix when space permits

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
- A security/data-flow diagram showing login, JWT issuance, permission checks,
  current-business-unit resolution, and filtered data access.
- Compact tables for the technology stack, Admin/Viewer access matrix, Product
  data model, and verification coverage.

Diagrams will use simple boxes and arrows, remain readable when printed, and
avoid decorative complexity.

## Scope boundaries

The report will clearly state that the project is a proof of concept. Detailed
operations, disaster recovery, service-level agreements, enterprise monitoring,
and long-term support processes are excluded. A short production-considerations
section will identify the main work needed to move beyond the trial, such as
managed identity, centralized secrets, supported hosting, observability,
production data governance, and operational ownership.

## Quality and verification

The final PDF will be checked for:

- Technical consistency with the repository.
- Clear separation of implemented features, trial limitations, and future work.
- Complete rendering with no clipped, overlapping, or unreadable content.
- Consistent page furniture and section hierarchy.
- Accurate page count, headings, diagrams, tables, and searchable text.
- Absence of placeholder text and secrets.

The PDF will be rendered to page images and visually inspected before delivery.
