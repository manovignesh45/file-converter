# ConvertPro PDF Editor: Phase 0 Audit and Phases 1–5 Implementation Plan

Date: 2026-10-10  
Audited commit: `4d83c95`  
Requirements: [PDF Editor Redesign PRD](pdf-editor-redesign.md)  
Status: **Phase 0 complete. Phase 1 committed. Phase 2 feature code implemented; browser acceptance checks remain. Phases 3–5 are proposed work.**

The Phase 0 audit added only this planning document. Phase 1 changes began afterward.

### Phase 1 progress (2026-10-10)

The editor now keeps page metadata and elements in one history-backed document snapshot, assigns stable source-page IDs, and projects that state to the existing version-1 export payload. The shell includes mode navigation, a contextual top toolbar, lazy page thumbnails, collapsible side panels, and a status bar. Duplicate, internal copy/paste, arrow-key nudging, image replacement, and typing-safe undo shortcuts have been added. Page canvases render when near the viewport.

Phase 1 code is committed, but the local browser was unavailable during implementation. Visual interaction and preview/export geometry checks are still required before its exit gate can be claimed. The next verification step is a browser run through text/shape/image selection and formatting, mode switches, sidebar collapse, zoom, and export on mixed-size/rotated PDFs.

### Phase 2 progress (2026-10-10)

Quick Fill now has reusable name, address, place, date, custom text, initials, and vector mark definitions in the shared document state. Source edits propagate only to linked text placements; direct instance edits detach. Click and drag placement use the page viewport transform. Current, selected, and all-page placement create fresh IDs in one history transaction and reject out-of-bounds multi-page placement. Text controls include alignment, single-line mode, wrapping, minimum-size fitting, and an overflow warning. The editor sends the preview's line breaks and fitted font size to the exporter. Bundled Noto fonts and fontkit support form text beyond the original standard-font set.

Drawn, typed, and uploaded visual signatures can be previewed, placed repeatedly, renamed, and removed. Saving to the browser's IndexedDB library is an explicit choice; removing a library entry retains already placed images and their undo assets. Source strokes or typed text/style are retained with saved signatures. Export validation checks referenced assets and reuses embedded signature images.

Unit and export tests, type-check, lint, and production build pass. The in-app browser was unavailable, so drag/drop, pointer drawing, responsive layout, signature library behavior in a real browser, and preview/export visual comparison remain unverified. Do not claim the Phase 2 exit gate until those checks pass.

### Phase 1 and 2 acceptance attempt (2026-10-17)

Quick Fill cards now support click-to-place and direct drag/drop without separate Place or Drag buttons. The drag preview shows the field value or signature, and each successful placement clears the active placement so a later page click cannot insert another copy. The placed object remains selected for adjustment. All 34 unit/export tests, TypeScript checking, lint, and the production build passed (lint reported two existing image warnings outside the editor). Browser discovery returned no available browser session, so the Phase 1 visual/geometry checks and Phase 2 interaction, responsive, signature-library, and preview/export comparisons remain open. Neither exit gate is signed off.

The editor now keeps its editing toolbar visible with Quick Fill in the right sidebar. The separate Fill & Sign mode tab and right-side Properties panel were removed. Controls that were unique to Properties (content, linking, fitting, exact dimensions, rotation) are available under More options in the toolbar; drawing and highlight defaults are available when their tools are selected. Tests, TypeScript, and lint passed for this revision. The production build compiled but failed during final tracing because `.next/server/app/_not-found/page.js.nft.json` disappeared; the layout still needs a clean build and browser verification.

Dragging a Quick Fill card over a page now previews its field outline and corner handles at the fitted destination. The drop uses the same position and selects the new item for adjustment. Placement is clamped to fit the smallest target page, with an error only when the field itself cannot fit. Selected text has inline decrease/increase font controls near its box. The placement unit suite now checks fitting across mixed-size pages; browser pointer and visual checks remain open.

Quick Fill card dragging now uses pointer movement instead of native HTML drag events. One preview follows the pointer and changes into the placement outline over a page; releasing places the selected field at that preview position. This removes the native drag image handoff and gives the preview pointer-rate updates. Tests, TypeScript, and lint pass; browser confirmation of the motion remains pending.

Quick Fill now opens as an empty, session-only collection. Users can add and label as many text and image items as needed, create signatures and marks, reorder or remove items, and search the collection. Dates are entered as ordinary text values, with no separate date helper. “Add common labels” is an optional shortcut. Linked text and image placements follow changes to their source; editing an individual text value or replacing an individual image detaches that placement. Removing a source leaves its existing placements on the PDF. Signatures retain their existing optional browser persistence. The full test suite, TypeScript, lint, and production build passed for the initial collection revision; lint reports two existing image warnings outside the editor. Browser verification and the Phase 1/2 exit gates remain open.

Image and Sign creation tiles accept a dropped PNG or JPEG as well as a click. Dropping onto Sign opens the signature upload dialog with the file previewed so the user can name it and choose browser storage. The dialog's upload area also accepts a dropped image. TypeScript, lint, and all 38 tests passed; live drag/drop verification remains pending.

Quick Fill has a draggable divider on its left edge, with keyboard arrow support. Resizing the right panel automatically reflows field cards from one to as many as four columns as space permits; the chosen width stays set while the panel is toggled during the editor session. The panel reserves room for the PDF workspace and page thumbnails on desktop.

## 1. Findings and recommended direction

The repository already has a usable overlay PDF editor. Preserve PDF.js for loading/rendering, Fabric for object interactions, and pdf-lib for export. The redesign should extend these modules incrementally.

The largest architecture additions are a shared document state with stable page identities, reusable field definitions, versioned editable drafts, and authenticated private backend storage. There is currently **no database integration, authentication, IndexedDB persistence, draft API, or cloud synchronization**. The README's MongoDB/Mongoose claims do not describe the current source or dependencies.

The current test suite passes, but it does not establish visual preview/export equivalence. Source review identifies transform, text layout, selection, and history limitations that need focused fixes and regression tests as their related features are implemented.

Phase 1 can proceed after approval without choosing a cloud provider. Phase 3's cloud portion requires a deployment, authentication, and durable storage decision; this plan defines the contracts and recommended deployment options rather than inventing existing infrastructure.

## 2. Current architecture and libraries

### Application and editor entry

- `app/page.tsx` is a client component containing upload, conversion options, results, and editor entry state. Choosing `pdf-edit` opens `PdfEditor` with a browser `File`; it bypasses `/api/process`.
- `components/DragDropUploader.tsx` uses react-dropzone and dnd-kit. Uploads accept images/PDFs up to 50 MB. The editor entry requires exactly one PDF, although the uploader itself supports multiple files.
- `components/OptionsPanel.tsx` exposes the Edit PDF operation.
- `components/pdf-editor/PdfEditor.tsx` owns the document's added elements, history, image assets, selection, tools, page navigation, zoom, password flow, and export request.
- `components/pdf-editor/PdfEditorToolbar.tsx` provides tools, history, zoom, deletion, and object stack ordering. It has no contextual formatting controls.
- `components/pdf-editor/PdfEditorInspector.tsx` provides selection-dependent properties on the right, including text content/style, shape style, drawing style, opacity, and rotation.
- `components/pdf-editor/PdfPageSurface.tsx` renders one PDF page and its text/interactive overlay layers.
- `app/globals.css` imports PDF.js viewer CSS and defines the editor's Tailwind-based styling. The tool rail and inspector are absolutely positioned; canvas spacing reserves fixed sidebar widths.

### Installed versions and responsibilities

Versions below are from the installed packages, not the older README descriptions:

- Next.js **15.5.26**, React **19.2.3**, TypeScript **5.8.3**: App Router application with Node route handlers; React hooks/local component state. No external state-management library is installed.
- Tailwind CSS **3.x**, lucide-react, framer-motion: styling, icons, and existing application animation conventions.
- `pdfjs-dist` **5.5.207**: PDF loading, password prompts, background page rendering, and text layers.
- Fabric **7.4.0**: selection handles, drag/resize/rotation, text/image/shape/path overlay objects.
- `pdf-lib` **1.17.1**: preserves source PDF content and draws additions into a new PDF.
- Sharp **0.35.4**: server-side image validation/processing.
- `@dnd-kit/core`, sortable, utilities: existing upload queue reordering; reusable for later page organization.
- react-dropzone, uuid, archiver: uploads, server IDs, and ZIP downloads.
- `node-qpdf2`, `pdf-lib-with-encrypt`: adjacent PDF utilities. The editor exporter itself invokes the **qpdf executable** when decrypting a password-protected source.
- Vitest **4.1.11**: Node-based tests. No checked-in browser E2E runner or React component test harness is configured.

`next.config.js` aliases the PDF.js root import to its minified build to avoid a Webpack collision. The checked-in worker at `public/pdfjs/pdf.worker.min.mjs` declares the matching version **5.5.207**. Preserve the alias and API/worker version pairing.

### Backend and deployment

The backend is the same Next.js application, using Node route handlers and service modules. Relevant endpoints are:

- `POST /api/pdf/edit`: edited PDF export.
- `POST /api/process`: other image/PDF processing operations.
- `GET /api/download/[fileName]` and `GET /api/preview/[fileName]`: processed file access.
- `POST /api/download-all`: ZIP of requested processed files.
- `GET /api/cleanup`: lists processed files.
- `DELETE /api/cleanup`: deletes specified processed filenames or files older than a retention window.

`middleware.ts` supplies CORS headers; it does not authenticate or authorize requests. There are no user/session models or ownership checks.

The Dockerfile installs qpdf and Ghostscript. The current machine also has both executables. `docker-compose.yml` defines one app container, a 512 MB memory limit, and no persistent volume or database service. Container-local files can survive a process restart but are not a durable draft store across container replacement. Vercel configuration exists, but the filesystem-output/qpdf design is not evidence that hosted export works there.

## 3. Existing editor features and verification limits

### Implemented and reusable

- Upload/open PDF, PDF.js password prompt, and load errors.
- Scrollable multipage display with active-page tracking via IntersectionObserver, previous/next navigation, and page count.
- Zoom from 50% to 250%.
- Text insertion with inspector-based editing; Helvetica, TimesRoman, Courier; size, color, bold, italic, underline.
- PNG/JPEG insertion centered on the active page, with aspect-ratio sizing and asset URLs.
- Rectangle, ellipse, line, arrow, freehand drawing, and highlighting.
- Text-selection highlighting through the PDF.js text layer; rectangular fallback for scanned/image-only pages.
- Fabric selection, movement, resize, and rotation, with modification events committed back to React state.
- Delete and move-forward/backward object stacking.
- Undo/redo of the element array, capped at 100 committed past snapshots.
- Export of text, images, shapes, drawings, highlights, and original PDF content into a new file.

These capabilities have complete source paths. Their existence does not mean every transform, document type, or interaction has been browser-tested.

### Browser smoke check performed in Phase 0

The existing `test.pdf` was opened in the production build. Text was inserted and edited to `Phase 0 audit text`; font size was changed to 24 and bold enabled. Zoom-in, Undo, and Redo controls were exercised, followed by export. The download endpoint returned HTTP 200 with a 2,660-byte PDF. PDF.js reopened the output and extracted the inserted text. This confirms that the basic editor-to-export path works.

This smoke check did **not** establish pixel-accurate placement or test all tools, encrypted PDFs, page rotations, large documents, or multipage UI behavior. The only captured browser console error was the existing missing `/favicon.ico` resource.

### Missing functionality

No mode navigation, contextual top formatting, page thumbnails, reusable field definitions, field linking, drag/drop fields, date formats, signature library, initials/checkmark object types, text fitting, or native form editing exists.

There is no document rename, draft save/reopen, autosave, cloud account workflow, revision conflict handling, page reorder/rotate/delete/insert/duplicate/extract, search, or alignment guides.

Copy, paste, duplicate, and keyboard nudging are absent. Current shortcuts cover document undo/redo, delete/backspace outside text inputs, and Escape. Ctrl/Cmd+Z is intercepted even while typing in inspector inputs, which can interfere with native text undo.

Original PDF text is read-only; added text is an overlay. There is no OCR or cryptographic signing.

## 4. Data models and state

`types/pdfEditor.ts` defines the current shared editor/export types:

- `PdfEditorElement`: a discriminated union of `text`, `image`, `rectangle`, `ellipse`, `line`, `arrow`, `drawing`, and `highlight`.
- Common fields: string `id`, numeric `pageIndex`, `zIndex`, `x`, `y`, `width`, `height`, `rotation`, and `opacity`.
- Text includes content and font/style fields; images refer to an `assetId`; drawings contain absolute PDF-space points.
- `PdfPageInfo`: index, visible page width/height, and source rotation. Crop-box origin, MediaBox, and stable identity are not retained.
- `PdfEditPayload`: `{ version: 1, pages, elements }`. This is an export request schema, not an editable draft schema.
- `PdfAssetMap`: asset ID to browser `File`. Separate asset-ID-to-object-URL state supports Fabric image loading.

`lib/pdf/history.ts` is generic and reusable, but the editor currently instantiates it only for `PdfEditorElement[]`. Page order, fields, assets, and document metadata are outside history. Images remain in memory after deleting an element, which helps undo but requires explicit retention/garbage-collection rules when persistence is added.

The document state is entirely in memory. Closing the editor loses edits. Successful export calls `onExported`, and `app/page.tsx` unmounts the editor to show results, also discarding the editable session. Refresh cannot restore it.

## 5. PDF rendering, coordinates, and export

### Rendering and interaction

`PdfEditor.tsx` dynamically imports PDF.js, loads the browser file bytes, and eagerly obtains every `PDFPageProxy` before showing the editor. Every page mounts a surface containing:

1. A background HTML canvas rendered by PDF.js.
2. A PDF.js text layer.
3. A Fabric canvas for added objects and selection handles.

Background rendering accounts for device pixel ratio, capped at 2. PDF render tasks and text layers have cancellation cleanup; image object URLs are revoked on editor unmount.

`lib/pdf/coordinates.ts` implements affine PDF-to-viewport transforms and their inverse. Canonical object positions are PDF user-space coordinates, normally with a bottom-left origin, rather than stored browser pixels. PDF.js viewport transforms incorporate zoom, source rotation, and crop offset for points. This is a good foundation to preserve.

Full-page rendering is eager. Fabric canvases are disposed and rebuilt whenever several props change, including element arrays, selection, tool, viewport, and asset URLs. Inline callbacks and newly filtered arrays from the parent amplify rebuilds. Asynchronous image creation has no explicit stale-generation cancellation. This is a performance and selection-lifecycle risk.

### Export path

`PdfEditor.tsx` submits multipart form data containing the original PDF, version-1 JSON edits, referenced images, asset IDs, and an optional password to `/api/pdf/edit`.

The route validates PDF magic bytes and the 50 MB limit, parses the edit payload, and validates PNG/JPEG bytes plus Sharp metadata. Images are limited to 50 MB each and decoding uses a 40-million-pixel limit. Payload validation caps elements at 5,000 and drawing points at 25,000 per drawing.

`services/pdfEditService.ts` loads the PDF with pdf-lib; if encrypted, it decrypts a temporary copy using qpdf. It sorts elements by page and z-index and draws each addition into the existing pages. Standard PDF fonts cover the current three families and bold/italic variants. Drawings are line segments; highlights use Multiply blending. It saves, reopens, verifies page count and page sizes, sanitizes the output filename, and writes a uniquely named PDF to `public/processed`.

The original uploaded PDF is not overwritten. Encrypted inputs export as unlocked copies. Temporary decryption files are cleaned up.

Export always uploads the source and referenced assets to the server, even though editing itself happens locally. A PRD-compliant local-only workflow must make that transfer explicit or provide browser-side export. Exported overlay graphics are page content, not retained editable ConvertPro objects; reopening an exported PDF is different from reopening an editable draft.

### Accuracy and validation gaps to resolve

These are source-review findings requiring targeted fixtures and browser/export comparisons before claiming accuracy:

- Fabric Textbox derives its rendered height from its content, while the exporter lays out text using stored `height`, `fontSize`, and independent wrapping. New text starts with a height of 60. The preview and exporter do not share text layout metrics or wrapping rules.
- The viewport transform reflects the PDF Y axis. Object angles currently add `element.rotation` to the viewport angle, while pdf-lib uses PDF-space rotation. Rotation direction and anchor handling need verification; point round-trip tests cannot validate them.
- Ellipse and line/arrow preview objects use different Fabric origins, but generic modification handling converts `object.left/top` as if they were the canonical anchor. Ellipse movement can therefore alter the intended Y anchor.
- Highlight export ignores `rotation`; drawing preview/export uses points rather than its `rotation` property, although the inspector exposes rotation for all types. Rotated text underlines and multiline placement also lack a common transform treatment.
- Fabric supports marquee selection, but application state retains only one `selectedId`; group modification has no object ID to map back. Mixed selection is not a dependable feature today.
- Point transforms handle crop offsets, but page metadata only stores width/height, and helpers such as `clampToPage` assume a zero-origin page. New placement/clamping must use the real visible page bounds.
- Standard fonts cannot represent every requested Unicode character. Directly inserting `✓` or `✕` as current Helvetica text is unsafe.
- Validation does not establish unique object/asset IDs, aggregate asset limits, correspondence between client page metadata and the actual source, or complete referenced-asset integrity.

## 6. Backend storage capabilities and constraints

The only storage is generated files on the server filesystem. Source PDFs and edit JSON are received for export but are not stored as recoverable projects. There are no draft metadata records, owner IDs, asset tables, signatures, revisions, or storage adapters.

Processed outputs are under `public/processed`, accessible through unauthenticated APIs and potentially static serving. They are unsuitable for private source PDFs or signatures. Cleanup can list all outputs and delete supplied names or old files; it must never operate on future draft storage.

`PdfEditService`, download, and preview use a hard-coded `public/processed` path. Cleanup optionally uses `PROCESSED_FILES_DIR`, creating a configuration inconsistency. Phase 3 should introduce explicit storage boundaries rather than extending these public outputs into draft storage.

Cloud storage needs all of: trusted authentication, server-derived ownership, transactional metadata/revision updates, private binary storage, retention/deletion rules, durable deployment configuration, and authorization on asset reads as well as draft reads. A random filename or project UUID is not authorization.

## 7. Baseline checks completed

- `npm test`: **4 test files, 10 tests passed**.
- `./node_modules/.bin/tsc --noEmit --incremental false`: **passed**.
- `npm run lint`: **passed with two existing warnings**, both `@next/next/no-img-element` in `components/PreviewCard.tsx` and `components/ResultsView.tsx`. The command also reports that `next lint` is deprecated.
- `npm run build`: **passed**. Existing warnings include the same two image warnings and outdated Browserslist data. The build reports `/` at 139 kB route size and 241 kB first-load JS; this is a build baseline, not a runtime performance measurement.
- Production browser smoke check and exported PDF text extraction: **passed within the scope described above**.

Existing tests cover four affine point round-trips, viewport scale/rotation, basic history branching, magic-byte checks, a missing page reference, safe filenames, and one export with all existing element types on mixed-size pages. The export test checks reopening/page sizes but does not assert element content or geometry. No API ownership, React integration, persistence, browser E2E, or visual regression coverage exists.

## 8. Shared target architecture

### One document state, derived render/export views

Evolve `types/pdfEditor.ts` instead of creating a second editor model. Use a reducer-backed canonical document containing:

- Document ID/name, source PDF asset reference/checksum, and immutable asset references.
- Ordered pages with stable `id`, `sourcePageIndex` or blank-page descriptor, full source bounds, and rotation metadata.
- Existing typed elements, associated with stable `pageId`.
- Reusable field definitions and links from placed elements.
- Later, supported native-form values.

Keep selection, zoom, active mode, sidebar state, render proxies, current gestures, object URLs, placement cursor, and save/sync status outside the persisted document. Use React hooks/reducer and the existing history helpers; no state-management library is required.

Introduce stable IDs in Phase 1 while retaining source indices for rendering. Until page management is added, derive the existing version-1 export payload through an adapter that resolves `pageId` to source `pageIndex`. This transport projection is not a second mutable document store. Extend the export protocol in Phase 4 when order/blank pages/forms require it.

History should cover the editable document snapshot. Commit a drag, resize, multi-page insertion, field-value propagation, or page operation once. Use a transient gesture preview and coalesce continuous text/style edits at intentional boundaries. Keep immutable asset bytes outside history and retain assets referenced by present, past, or future snapshots.

### Coordinate and layout contract

Keep PDF user-space units and a documented bottom-left convention. Store actual crop/MediaBox bounds and source rotation. Element `x/y` should have one documented anchor per primitive; convert Fabric origins through typed adapters rather than generic `left/top` handling.

Derive all browser input from the page surface's current DOM rectangle and PDF.js viewport matrix. Device pixels must remain an implementation detail. For objects and paths, transform full geometry, including angle direction and pivots. Shared text measurement/wrapping and explicit overflow behavior must be used by preview and export.

### Export and storage boundaries

Extract reusable pdf-lib drawing/verification logic from the Node-specific service into a pure PDF export module. The existing service remains the server wrapper for qpdf and filesystem output. Add browser export for supported unencrypted local documents by Phase 3. Password-protected browser export may require an explicitly chosen server operation; do not silently transfer a local document.

Local drafts use IndexedDB with separate stores for metadata/document snapshots and blobs. Cloud drafts use Next.js Node routes, a session adapter, a transactional metadata repository, and a private asset repository. Saved-state indicators reflect completed persistence of the matching revision, not merely a scheduled save.

### Dependencies and decisions

- Retain PDF.js, Fabric, pdf-lib, Tailwind, lucide, dnd-kit, Sharp, and Vitest.
- Phase 1: no new runtime UI/state dependency is needed. Add a checked-in Playwright test runner for meaningful canvas/browser regressions; use existing Vitest for pure logic.
- Phase 2: add `@pdf-lib/fontkit` and licensed, bundled fonts for required non-ASCII text and typed-signature choices. Render check/cross symbols as shared vector primitives. Avoid remote font availability dependencies. Signature library persistence can start with a small IndexedDB repository and be reused in Phase 3.
- Phase 3: native IndexedDB is sufficient; a thin wrapper such as `idb` is optional, not required. A database driver, authentication integration, and blob-storage adapter will depend on the approved deployment. Use real-browser storage tests; an IndexedDB test shim is optional for isolated unit tests.
- Recommended deployment branch: for the current single-container self-hosted setup, a transactional metadata database and a private persistent volume are the smallest extension. SQLite is a candidate if single-instance operation is intentional. For hosted or multiple-instance deployment, use a shared transactional SQL database and private object storage instead. Do not deploy a per-container SQLite/file store across independent instances.
- Authentication should use an established maintained session/OIDC integration rather than custom password handling. Provider and deployment selection remain explicit Phase 3 prerequisites. Phase 1 does not depend on them.

The custom-font approach follows the [pdf-lib project documentation](https://github.com/Hopding/pdf-lib/blob/master/README.md?plain=1). The installed library already exposes `registerFontkit`, `getForm`, page rotation/removal/copy operations, and form flattening. [PDFForm documentation](https://pdf-lib.js.org/docs/api/classes/pdfform) confirms AcroForm support and the XFA limitation. These extend the current engine without replacing it.

## 9. Phase 1 — Editor UI Redesign

### Scope and implementation sequence

1. Extract a reducer/controller from `PdfEditor.tsx`, retaining one document/history store. Assign stable page IDs, add a version-1 export adapter, and separate transient UI state.
2. Introduce header, mode tabs, contextual toolbar, collapsible thumbnail navigation, mode-aware right sidebar, and bottom status bar. Mode switches change UI state without remounting the document or PDF loader.
3. Move common formatting controls from the inspector into the toolbar. Keep text content and advanced geometry/layer controls available in a deliberate advanced panel. Add text alignment only with matching preview/export support. Add image replacement using the existing upload validation; hide crop because no crop implementation exists.
4. Consolidate selection and object commands: duplicate, internal copy/paste across pages, delete, stacking, Escape, and arrow-key nudging. Preserve text-entry shortcuts, including contenteditable/Fabric editing contexts and IME composition. Add save shortcut when real persistence arrives in Phase 3.
5. Make Fabric selection lifecycle stable across toolbar focus and updates. Handle mixed selection safely through selected IDs/shared applicable properties and atomic transforms, or deliberately restrict the initial UI to single selection rather than exposing broken Fabric group edits.
6. Add low-resolution, lazily rendered/cached thumbnails. Reserve page shells so navigation does not depend on already mounted canvases. Prioritize first/visible pages and avoid rendering every page at full resolution before interaction.
7. Replace fixed canvas paddings with actual layout regions. Sidebar collapse must change workspace space without changing stored geometry. Preserve zoom, page navigation, all tools, and export.
8. Fix primitive anchor/rotation and text-layout issues needed to preserve Phase 1 behavior. Add focused regressions before changing those paths. Unsupported type-specific operations must be hidden; there must be no cosmetic controls without behavior.

### Affected files

Modify:

- `components/pdf-editor/PdfEditor.tsx`: orchestration, shared controller, modes, navigation, export adapter.
- `PdfEditorToolbar.tsx`: grouped tools and type-aware formatting/actions.
- `PdfEditorInspector.tsx`: advanced properties and defaults.
- `PdfPageSurface.tsx`: stable Fabric lifecycle, selection, typed transforms, viewport-aware interaction, visible-page rendering.
- `types/pdfEditor.ts`: canonical document/page identity, applicable style extensions.
- `lib/pdf/history.ts`, `lib/pdf/coordinates.ts`: transaction support and typed geometry helpers.
- `lib/pdf/validation.ts`, `services/pdfEditService.ts`: any alignment/layout additions needed for parity, preserving legacy payload support.
- `app/page.tsx`, `app/globals.css`: editor integration and responsive shell.
- `package.json`, `package-lock.json`, `vitest.config.mts`: test tooling only as needed.

Add proposed modules:

- `components/pdf-editor/PdfEditorHeader.tsx`, `PdfEditorModeNav.tsx`, `PdfThumbnailSidebar.tsx`, `PdfEditorStatusBar.tsx`.
- `components/pdf-editor/usePdfEditorDocument.ts`, `usePdfEditorKeyboard.ts`.
- `lib/pdf/document.ts`, `commands.ts`, `elementTransforms.ts`, `exportPayload.ts`, and `textLayout.ts`.
- `playwright.config.ts`, `tests/e2e/pdf-editor.spec.ts`; focused tests under `tests/pdf/`.

These are proposed boundaries; avoid splitting files merely to match the list.

### Dependencies, risks, and testing

Depends on the Phase 0 audit only. Main risks are lost selection during rebuilds, invalid group transforms, different text wrapping/rotation, toolbar input focus, and eager thumbnail rendering worsening performance.

Test all existing object types, mode-switch preservation, selected property reflection/update, collapse at multiple viewport widths, copy/paste IDs/page assignment, atomic move/resize, typing-safe keyboard shortcuts, mixed-size/cropped/rotated fixtures, zoom and export. Compare preview and exported geometry for representative primitives. Preserve the 10 baseline tests; add browser tests alongside this phase rather than postponing them.

**Exit gate:** every Phase 1 PRD acceptance criterion passes; no fake save indicator or advertised unsupported operation. Fill & Sign navigation may show a clear phase-specific introductory state until Phase 2 tools exist. Header reports unsaved/session state until persistence is implemented.

## 10. Phase 2 — Fill & Sign

### Scope and implementation sequence

1. Add typed reusable definitions for name, address, place, date, custom text, initials, marks, and signature references. Store dates as date-only values with a separate display format/manual-text option to avoid timezone shifts.
2. Implement Quick Fill source editing and both click-to-place and drag/drop. A placement controller carries a definition ID; both insertion paths use the same DOM-to-PDF mapper. Escape cancels; the source field remains reusable.
3. Add optional `fieldId` and link behavior to placed elements. Default to visibly linked instances. Updating the source updates linked values only; editing an instance directly explicitly detaches it. Styles and geometry stay independent.
4. Place on current, selected, or all pages with fresh object IDs and one history transaction. For mixed-size pages, use the same canonical offset from the visible page edge and flag out-of-bounds placement rather than silently changing position.
5. Add alignment, wrapping/single-line mode, minimum-size auto-fit, and visible overflow warnings. Preview/export use shared font metrics and fitted results.
6. Add draw/type/upload signature creation with preview, empty/corrupt/size checks, PNG transparency, reusable asset IDs, rename/delete, and local saving by explicit choice. Typed signatures use bundled font choices; retaining source text/strokes allows regeneration. Placed signatures remain movable/resizable objects.
7. Add vector check/cross primitives and text initials; ensure the same geometry is used in Fabric and pdf-lib. A signature can be an image element with semantic metadata rather than a separate incompatible image engine.
8. Reuse the signature asset for repeated placements; deletion from the library must not destroy already placed objects or their undo state. Server signature storage remains unavailable until Phase 3 auth/private storage exists.

### Affected files

Modify `types/pdfEditor.ts`, `PdfEditor.tsx`, `PdfEditorToolbar.tsx`, `PdfEditorInspector.tsx`, `PdfPageSurface.tsx`, the Phase 1 controller/commands, `lib/pdf/validation.ts`, shared text layout/coordinates/export adapters, `services/pdfEditService.ts`, `app/api/pdf/edit/route.ts`, `app/globals.css`, and dependency manifests.

Add proposed modules:

- `components/pdf-editor/QuickFillPanel.tsx`, `SignatureDialog.tsx`, `SignatureLibrary.tsx`, `FieldPlacementControls.tsx`, `MultiPagePlacementDialog.tsx`.
- `lib/pdf/fields.ts`, `dateFormatting.ts`, `placement.ts`, `symbols.ts`, `signatures.ts`, `fonts.ts`.
- `lib/pdf/drafts/database.ts` and `signatureRepository.ts` for the reusable local signature store.
- Licensed font assets and license notices under `public/fonts/`.
- Field/date/linking/fit/signature tests and `tests/e2e/fill-sign.spec.ts`.

### Dependencies, risks, and testing

Depends on stable page identity, command transactions, selection, and accurate coordinate/layout handling from Phase 1. New production dependency: fontkit, with verified font licensing and glyph coverage. Prefer existing pointer/Fabric/dnd-kit facilities over an additional placement library.

Risks include accidentally overwriting detached text, timezone conversion, Unicode export failure, signature storage/upload without consent, font-loading races, overflow clipping, and missing signature assets. Local signature persistence is included here because Phase 2 requires saving/reuse; full document persistence follows in Phase 3.

Unit-test links/detachment, all date formats/manual override, unique IDs, one-step multi-page undo/redo, text-fit minimums, overflow, symbol geometry, and serialization. Browser-test drag/drop and click placement at 50/100/250% zoom, cropped/rotated pages, name reuse on pages 1/3/5, date on page 2, signature on page 5, repeated signatures, transparent uploads, and library deletion. Export tests must verify text, marks, asset embedding, and position.

**Exit gate:** all Phase 2 acceptance criteria pass. Local signatures can be saved/reused; account storage is explicitly gated on Phase 3. Visual signatures are described as visual signatures, not certificate-backed signing.

## 11. Phase 3 — Draft Storage

### Scope and implementation sequence

1. Define `schemaVersion: 1` for editable drafts, separate from export transport versions. Serialize the canonical document, full styles/links/page bounds, asset references/checksums, timestamps, and local/cloud revision metadata. Validate on load; reject unsupported future versions safely and migrate older supported versions explicitly.
2. Extend the Phase 2 IndexedDB database with projects, blob assets, signature records, and sync queue stores. Commit a snapshot and its required local asset references atomically. Keep the original PDF recoverable, not just a transient File/object URL or exported-file URL.
3. Implement Save, Save As, Open, Rename, Delete, and draft browser entry from `app/page.tsx`. Reconstruct PDF.js proxies and object URLs from stored bytes; retain editable geometry and field links. Preserve the editor after export so users can keep editing.
4. Implement 1–2 second debounced local autosave, explicit Save, dirty/leave warnings, quota/unavailable-storage errors, and recovery. Track a document change sequence so a completed older save cannot mark newer changes saved.
5. Complete the pure pdf-lib export extraction and supported browser-local export. Explicitly disclose any optional server export/decryption transfer. No local-only draft or signature enters a cloud queue without the user's storage choice.
6. Implement trusted sessions and private cloud repositories using the approved deployment choice. Store metadata/state separately from source/image/signature binaries. Ownership comes from the authenticated session; never trust an owner ID sent by the client.
7. Add revisioned APIs. Validate references, IDs, content types/byte limits, ownership, and asset availability before publishing a new draft revision. Upload changed assets once; reuse verified unchanged source PDFs by asset reference.
8. Implement local-first synchronization, persistent queues, bounded retry/backoff, offline recovery, auth-expiry handling, and reconnect/resume. A retry must be idempotent. Signatures are uploaded only after explicit account-storage choice; cloud drafts containing local-only signature assets require resolving that choice before upload.
9. Require expected revision on updates, implemented as an atomic compare-and-set. Return conflict on mismatch. Preserve the local snapshot before offering save-as-separate-draft or load-cloud-version. Loading cloud must not silently discard unsynced local edits.
10. Define deletion/retention and reference-aware asset cleanup. Library deletion and draft deletion are scoped and confirmed. Keep draft assets outside public outputs and outside `/api/cleanup`.

### Draft and API contracts

A draft contains project ID/name, source PDF asset/checksum, ordered stable pages, elements, reusable fields, optional native-form state, complete asset references, schema version, and timestamps. Cloud metadata adds trusted owner ID and server revision. Local metadata records the last accepted cloud revision and current local sequence; UI selection and object URLs are excluded.

Proposed Node route handlers:

- `app/api/pdf/drafts/route.ts`: authenticated list/create.
- `app/api/pdf/drafts/[id]/route.ts`: authenticated get/update/delete. Update requires `expectedRevision`; success returns the new revision, conflict returns HTTP 409.
- `app/api/pdf/assets/route.ts` and `app/api/pdf/assets/[id]/route.ts`: validated private upload/read, with reference-aware lifecycle.
- `app/api/pdf/signatures/route.ts` and `app/api/pdf/signatures/[id]/route.ts`: explicitly requested account storage, list/read/delete.

All reads/writes resolve ownership server-side. Asset authorization is required even if the caller already knows its ID. Metadata revision and asset references must commit transactionally; partial uploads cannot make a draft appear successfully saved. Use private responses/signed access as appropriate and prevent unsafe paths.

### Affected files

Modify the editor/header/status/controller, `app/page.tsx`, `types/pdfEditor.ts`, validation, history retention, export service/route, `middleware.ts`, `next.config.js`, dependency manifests, `Dockerfile`, `docker-compose.yml`, and deployment/environment documentation. Update CORS allowed methods/headers if cross-origin APIs are intentionally supported; current headers omit PUT and concurrency headers.

Add proposed modules:

- `types/pdfDraft.ts` for the storage envelope around the existing document type.
- `lib/pdf/drafts/schema.ts`, `migrations.ts`, `serialize.ts`, `localRepository.ts`, `cloudClient.ts`, `sync.ts`, and asset reference tracking.
- `components/pdf-editor/useDraftPersistence.ts`, `DraftBrowser.tsx`, `SaveDraftDialog.tsx`, `ConflictDialog.tsx`.
- `lib/server/auth.ts`, `lib/server/pdfDraftRepository.ts`, `lib/server/pdfAssetRepository.ts`, and the selected database/blob adapters plus schema migrations.
- `lib/pdf/exportPdf.ts` for environment-neutral drawing/verification; Node qpdf/filesystem concerns remain in `services/pdfEditService.ts`.
- Storage/API/sync tests and `tests/e2e/draft-recovery.spec.ts`, `cloud-sync.spec.ts`.

### Dependencies, risks, and testing

Depends on Phase 2 serialization/link/asset semantics. Cloud rollout additionally depends on approved auth/database/blob providers, persistent infrastructure, and retention policy. Do not claim Phase 3 complete with only local storage implemented.

Main risks are transaction interruption, browser quota/data deletion, incomplete asset uploads, stale autosave completion, leaked private assets, revision races, expired authentication, and cloud-only signatures being uploaded unexpectedly. An unauthenticated random-ID API is not an acceptable interim cloud implementation.

Test refresh/reopen with PDF bytes and assets, schema round-trips/migrations, unavailable/quota storage, save failure status, delayed saves, local save during offline use, restart during sync, partial upload, auth expiry, another-device deletion, and asset removal while referenced. API tests use two owners and cover list/get/update/delete plus asset/signature reads. Concurrent revision updates must allow one winner and preserve the loser's local version. Browser tests implement PRD recovery, cross-session cloud reopen, offline reconnect, and conflict scenarios.

**Exit gate:** all Phase 3 acceptance criteria pass for local and authenticated cloud storage; no saved status before transaction completion, no cloud overwrite without revision checking, and no silent local-only upload.

## 12. Phase 4 — Advanced PDF Features

### Scope and implementation sequence

1. Add Organize Pages using stable page IDs and dnd-kit. Implement reorder, quarter-turn rotation, confirmed deletion, blank insertion, duplication, and selected-page extraction. Page operations are document-history transactions; duplicating a page creates new page/object IDs while retaining intended field links and sharing immutable assets.
2. Extend export to a versioned page manifest mapping logical pages to original source pages or blank descriptors. The current source-page-count equality check cannot support these operations; replace it with validation of the requested manifest, expected output count, dimensions, and rotations. Preserve legacy version-1 behavior.
3. Preserve source content and supported form relationships deliberately. Arbitrary `copyPages` is not proof of AcroForm catalog preservation. Add fixtures for forms plus reorder/duplicate/extract; implement supported rebuilding/remapping or report a limitation rather than silently dropping widgets/values.
4. Detect supported AcroForm widgets with PDF.js, map bounds through the shared coordinate utilities, and render accessible form controls. Persist values in the canonical document; apply them through pdf-lib during export. Cover text/multiline, checkbox, radio, and dropdown, with explicit preserve/flatten choices.
5. Keep overlay Fill & Sign available for unsupported/non-form/scanned documents. XFA remains outside scope; detect and explain fallback without silently deleting XFA data.
6. Add page-center/object alignment guides, optional grid snapping, and improved nudge commands. Guides remain transient and never export.
7. Add text search using PDF.js text content with incremental page indexing, cancellation, navigation, and viewport-mapped matches. Scanned PDFs get an actionable no-text result; no OCR claim.
8. Add filename and selected-page export options, plus structural/content/geometry validation. Optional content covering uses an opaque overlay and must be clearly described as covering, not secure redaction or removal of underlying text.

### Affected files

Modify `types/pdfEditor.ts`, draft schema/migrations, the document controller/commands/history, `PdfThumbnailSidebar.tsx`, mode navigation, `PdfPageSurface.tsx`, header/export UI, `lib/pdf/coordinates.ts`, export payload validation, the shared exporter, `services/pdfEditService.ts`, and `app/api/pdf/edit/route.ts`.

Add proposed modules:

- `components/pdf-editor/OrganizePagesPanel.tsx`, `PdfSearchPanel.tsx`, `NativeFormLayer.tsx`, `ExportOptionsDialog.tsx`.
- `lib/pdf/pages.ts`, `forms.ts`, `search.ts`, `alignment.ts`.
- Page-identity/history/form/search/export tests and `tests/e2e/organize-pages.spec.ts`, `native-forms.spec.ts`.

### Dependencies, risks, and testing

Depends on stable identity and draft migrations already established, plus accurate rotations/bounds and private asset restoration. Existing dnd-kit/PDF.js/pdf-lib are the default dependencies; no replacement engine is proposed.

Risks are detached page/object relationships, wrong total rotation, loss of form widgets/catalog references during page copying, duplicated field names, stale search indices after page edits, and confusing covering with redaction. Test these combinations before enabling them.

Test reordered/duplicated/blank/deleted/extracted pages, distinct IDs, linked versus detached fields after duplication, undo/redo and save/reopen of page edits, native form values and flatten/preserve behavior, XFA fallback, search on text/scanned PDFs, crop boxes, all four page rotations, guides excluded from output, selected-page exports, and output page count/bounds/rotation/content. Native forms combined with page organization require dedicated fixtures, not just separate passing tests.

**Exit gate:** all Phase 4 acceptance criteria pass, with documented safe fallbacks for unsupported forms. Exported files reopen and preserve expected page/object relationships.

## 13. Phase 5 — Testing, Optimization, and Release Readiness

### Scope and implementation sequence

1. Complete a deterministic fixture corpus: 1/5/20-page documents, a longer stress document, mixed dimensions, crop offsets, rotations, scanned pages, AcroForms, encrypted/corrupt/zero-usable-page cases, transparent images, repeated signatures, and required Unicode glyphs.
2. Run all six PRD browser scenarios with text/asset/geometry assertions: general editing, form filling, draft recovery, cross-session cloud synchronization, offline recovery, and revision conflict. Include original tools, copying across pages, page organization, save/export failures, and leave/reopen behavior.
3. Add export regression comparisons. Extract PDF text and coordinates, inspect page metadata/form state/assets, and render representative output pages to compare against the preview. Reopening/download success alone is insufficient. Normalize fonts, viewport, device scale, and render settings; define reasonable pixel/coordinate tolerances.
4. Validate keyboard/focus/accessibility, toolbar overflow, sidebar collapse, narrow-screen usable canvas, and practical pointer/touch placement. Review `app/layout.tsx` disabling browser zoom (`userScalable: false`) as part of accessibility work.
5. Profile first-page readiness, scroll/zoom, object drag, thumbnail work, save latency, retained canvases, and asset/object-URL memory on 5–20-page documents and the stress fixture. Establish measured targets on a named environment rather than inventing baseline timings. Verify the existing 512 MB container setting under representative export workloads.
6. Optimize measured hotspots: visible-page rendering, thumbnail cache eviction, stable Fabric objects/callbacks, font/image caches, debounced work, task cancellation, asset URL lifecycle, and moving expensive work off the interaction path where needed.
7. Add CI commands for tests/type-check/lint/build/E2E, reproducible browser/font fixtures, and documentation for drafts/privacy/storage/signatures/unsupported PDF features. Replace deprecated `next lint` with direct ESLint invocation when updating tooling, keeping existing rules.
8. Validate the approved production deployment, database migrations/backups, private asset retention/deletion, qpdf availability for optional server decryption, auth configuration, and worker-version integrity. Resolve critical data-loss/export/privacy issues before release.

### Affected files

Extend `tests/pdf/`, `tests/e2e/`, fixtures, `vitest.config.mts`, `playwright.config.ts`, `package.json`, `package-lock.json`, and CI configuration. Optimize only measured hotspots in editor/page rendering, draft synchronization, and export modules. Update `README.md`, add an editor architecture/usage/deployment guide, and adjust Docker/deployment configuration as required by measurements.

Playwright's [visual comparison documentation](https://playwright.dev/docs/test-snapshots) supports checked-in browser screenshot regression tests. Use those alongside structural and PDF-coordinate assertions, not as the sole correctness check.

### Dependencies, risks, and testing

Depends on complete Phases 1–4 and a representative approved deployment. Browser runtime and fixed licensed fonts are test prerequisites. Optional coverage tooling should be added only when used by CI; the existing coverage reporter configuration alone does not establish collected coverage.

Risks are nondeterministic screenshots, font/platform differences, tests that pass only with mocked storage, load-related memory failures, and optimizing away correctness. Use real-browser IndexedDB, real transactional repository integration tests, deterministic fixture generation, and geometry assertions to keep the suite meaningful.

**Exit gate:** all PRD critical workflows pass, outputs reopen in standard viewers, no editor-related console errors occur in common flows, responsive/accessibility checks pass, save/export failures preserve edits, and no unresolved critical data-loss issues remain. Record any supported-scope limitations before release.

## 14. Phase sequencing and approval boundary

Implement in reviewable steps within each phase, with tests alongside the behavior:

1. **Phase 1:** shared controller/identity and transform regressions → shell/contextual controls → selection/shortcuts → thumbnails/responsiveness → acceptance checks.
2. **Phase 2:** field definitions/linking → placement/multi-page transactions → fitting/fonts/symbols → signatures/local library → export checks.
3. **Phase 3:** schema/local storage/reopen → autosave/recovery/local export → approved auth/private repositories/APIs → sync/conflicts → acceptance checks.
4. **Phase 4:** page manifest/organization → forms and preservation cases → search/alignment/export options → acceptance checks.
5. **Phase 5:** complete workflow/geometry suite → measured optimizations → deployment/docs/release gate.

At each gate run the appropriate tests plus type-check, lint, and build, and fix regressions before proceeding. Baseline commands are `npm test`, `./node_modules/.bin/tsc --noEmit --incremental false`, `npm run lint`, and `npm run build`. Add explicit E2E commands when the checked-in runner is introduced.

Phase 1 has started at the user's request. Cloud provider/authentication/storage selection, signature account-storage consent, and optional server-dependent local export behavior are later decisions and do not block the UI/shared-controller phase.
