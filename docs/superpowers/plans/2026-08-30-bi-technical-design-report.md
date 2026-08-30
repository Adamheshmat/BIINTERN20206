# BI Technical Design Report Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce a visually verified evaluator-focused PDF showing that a separately developed business page can be integrated into SalesBuzz by reusing BI frontend components and backend platform services.

**Architecture:** Treat the repository as the technical source of truth, assemble a traceable evidence brief, and generate one self-contained PDF with ReportLab. Present the Product workflow as the page-specific layer above a reusable SalesBuzz/BI platform layer, while clearly separating demonstrated behavior from the future production page-loading mechanism.

**Tech Stack:** Python 3, ReportLab, pypdf, pdfplumber, Poppler (`pdfinfo`, `pdftoppm`), Angular 20, ASP.NET Core/.NET 10, Entity Framework Core, BI-SDK, OData, SQL Server 2022

**Spec:** `docs/superpowers/specs/2026-08-30-bi-technical-design-report-design.md`

## Global Constraints

- Produce exactly one final PDF under `output/pdf/`.
- Target 8-10 pages, with modest flexibility only when layout requires it.
- Use a professional blue technology theme with consistent headers, footers, page numbers, typography, margins, and spacing.
- Make modular page feasibility the central argument, not a closing observation.
- Define implemented behavior, trial limitations, and production recommendations separately.
- Do not include secrets, credential values, confidential data, invented pass counts, or unverified production claims.
- Use ASCII hyphens only in generated PDF text.
- Render every final page to PNG and visually inspect it before delivery.

---

### Task 1: Build the technical evidence brief

**Files:**
- Read: `README.md`
- Read: `docs/superpowers/specs/2026-08-27-sdk-permissions-current-bu-design.md`
- Read: `backend/SdkProductCrud.Api/Program.cs`
- Read: `backend/SdkProductCrud.Api/Product.cs`
- Read: `backend/SdkProductCrud.Api/AuthController.cs`
- Read: `backend/SdkProductCrud.Api/ProductsController.cs`
- Read: `backend/SdkProductCrud.Api/ProductSummaryController.cs`
- Read: `backend/SdkProductCrud.Api/CatalogDbContext.cs`
- Read: `backend/database/SDK_Minimal_Schema.sql`
- Read: `frontend/src/app/app.ts`
- Read: `frontend/src/app/auth.service.ts`
- Read: `frontend/src/app/auth.interceptor.ts`
- Read: `frontend/src/app/product-data-source.ts`
- Read: `frontend/src/app/product-columns.ts`
- Read: `frontend/src/app/public-api-client.service.ts`
- Read: `frontend/package.json`
- Read: `backend/SdkProductCrud.Api.Tests/*.cs`
- Read: `frontend/src/app/*.spec.ts`
- Create: `tmp/pdfs/bi-technical-design-evidence.md`

**Interfaces:**
- Consumes: Current repository implementation and approved report design.
- Produces: A source-linked evidence brief used as the sole factual input for report copy.

- [ ] **Step 1: Record the implemented component boundary**

Document two categories in `tmp/pdfs/bi-technical-design-evidence.md`:

```markdown
## Page-specific Product layer
- Product entity and Product-specific CRUD endpoints
- Product Grid columns, summaries, editing behavior, and user messages
- Product permission key and Product OData route

## Reused SalesBuzz/BI platform layer
- BI Grid and BI Navigation frontend packages
- PublicApiClient request abstraction
- BI-SDK JWT integration and permission attributes
- ICurrentBUContext business-unit resolution
- OData query conventions, Entity Framework Core integration, and SQL Server SDK schema
```

- [ ] **Step 2: Record the end-to-end security and data flow**

Trace login, token claims, frontend session storage, bearer interception, API validation, `[HasPermission]`, `ICurrentBUContext`, BU-filtered queries, OData processing, and SQL persistence. Include exact endpoint paths and implemented Admin/Viewer behavior from the source files.

- [ ] **Step 3: Record verification evidence and scope limits**

List the behaviors covered by backend, schema, frontend, real-package, build, and manual verification. Explicitly record that the repository demonstrates a standalone page integration pattern but does not implement automatic plug-in installation, page discovery, SalesBuzz navigation registration, production-shell loading, or compatibility governance.

- [ ] **Step 4: Validate the evidence brief**

Run:

```bash
rg -n 'TBD|TODO|PLACEHOLDER|FIXME|XXX|password\s*=' tmp/pdfs/bi-technical-design-evidence.md
```

Expected: no output. Re-open every cited implementation file and correct any evidence statement that is not directly supported.

### Task 2: Author the evaluator-focused PDF

**Files:**
- Create: `tmp/pdfs/build_bi_technical_design_report.py`
- Create: `output/pdf/sdk-product-crud-bi-technical-design-report.pdf`
- Read: `tmp/pdfs/bi-technical-design-evidence.md`

**Interfaces:**
- Consumes: The validated evidence brief from Task 1.
- Produces: One searchable PDF with reusable layout primitives, diagrams, tables, and evaluator-focused report copy.

- [ ] **Step 1: Mark PDF creation and confirm bundled dependencies**

Run exactly once before the authoring command:

```bash
node container_tools/mark_artifact_operation_started.mjs --operation-kind create --expected-output-count 1 --output-format pdf
```

Load the bundled workspace runtime and confirm Python can import `reportlab`, `pypdf`, and `pdfplumber`; confirm `pdfinfo` and `pdftoppm` are available.

- [ ] **Step 2: Implement the report layout system**

Create reusable ReportLab functions for the cover, section headings, callout cards, tables, diagrams, headers, footers, and page numbering. Use A4 portrait pages, a restrained navy/blue/cyan palette, print-safe contrast, and consistent content margins.

- [ ] **Step 3: Write the central modularity narrative**

Use this claim as the report's thesis:

```text
The Product Management proof of concept demonstrates that a business page can be developed separately and integrated into the wider SalesBuzz application by reusing BI's frontend components and backend platform services. The page owns its domain workflow, while BI retains the reusable platform contract.
```

Support it with a two-layer diagram and evidence matrix mapping page-specific Product responsibilities to reused BI Grid, BI Navigation, PublicApiClient, JWT contract, permissions, BUID context, OData, Entity Framework Core, and SQL Server integration.

- [ ] **Step 4: Complete the technical report sections**

Generate the cover, executive summary, scope, technology stack, architecture, modularity feasibility case, component design, data model, security design, data flows, verification evidence, limitations, production considerations, conclusion, and compact appendix. State that the trial validates the boundary but that production embedding still requires packaging, registration, navigation, loading, compatibility, governance, and support decisions.

- [ ] **Step 5: Generate the PDF and run structural checks**

Run the report builder, then:

```bash
pdfinfo output/pdf/sdk-product-crud-bi-technical-design-report.pdf
python3 - <<'PY'
from pathlib import Path
from pypdf import PdfReader

path = Path('output/pdf/sdk-product-crud-bi-technical-design-report.pdf')
reader = PdfReader(path)
assert 8 <= len(reader.pages) <= 11, len(reader.pages)
text = '\n'.join(page.extract_text() or '' for page in reader.pages)
for phrase in [
    'Modularity Feasibility',
    'BI Grid',
    'BI Navigation',
    'HasPermission',
    'ICurrentBUContext',
    'proof of concept',
    'production',
]:
    assert phrase.lower() in text.lower(), phrase
assert 'TBD' not in text and 'PLACEHOLDER' not in text
print(f'validated {len(reader.pages)} pages and {len(text)} extracted characters')
PY
```

Expected: one valid PDF, 8-11 pages, all required phrases present, no placeholders, and searchable extracted text.

### Task 3: Render, inspect, and finalize

**Files:**
- Modify if needed: `tmp/pdfs/build_bi_technical_design_report.py`
- Modify if needed: `output/pdf/sdk-product-crud-bi-technical-design-report.pdf`
- Create temporarily: `tmp/pdfs/rendered/page-*.png`

**Interfaces:**
- Consumes: Structurally valid PDF from Task 2.
- Produces: Final visually verified PDF ready for evaluator submission.

- [ ] **Step 1: Render every page**

Run:

```bash
mkdir -p tmp/pdfs/rendered
pdftoppm -png -r 150 output/pdf/sdk-product-crud-bi-technical-design-report.pdf tmp/pdfs/rendered/page
```

Expected: one PNG per PDF page.

- [ ] **Step 2: Inspect all rendered pages**

Review every PNG at readable resolution. Check for clipping, overflow, overlap, broken glyphs, weak contrast, awkward page breaks, crowded diagrams, sparse pages, inconsistent margins, malformed tables, and incorrect header/footer placement.

- [ ] **Step 3: Correct all visual defects and regenerate**

If any defect is found, modify the ReportLab builder, regenerate the PDF, rerun the structural checks, re-render all pages, and inspect the complete new render set. Repeat until zero defects remain.

- [ ] **Step 4: Perform final content and artifact checks**

Confirm the PDF opens cleanly, has exactly one output file, contains no secrets or placeholders, preserves the modularity thesis, distinguishes demonstrated integration from future production embedding, and accurately reflects the repository.

- [ ] **Step 5: Clean temporary artifacts and record completion**

Remove `tmp/pdfs/bi-technical-design-evidence.md`, `tmp/pdfs/build_bi_technical_design_report.py`, and `tmp/pdfs/rendered/` after the final PDF passes all checks. Keep only `output/pdf/sdk-product-crud-bi-technical-design-report.pdf` as the deliverable.
