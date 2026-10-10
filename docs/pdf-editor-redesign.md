# ConvertPro — PDF Editor Redesign & Fill & Sign
## Product Requirements Document (PRD)

**Version:** 1.0  
**Status:** Ready for technical analysis and phased implementation  
**Application:** ConvertPro — File Converter  
**Scope:** PDF Editor UI Redesign, PDF Editing, Fill & Sign, Local and Server Draft Storage  
**Implementation approach:** Incremental enhancement of the existing application

---

# 1. Project Overview

## 1.1 Current Application

ConvertPro is a web-based file utility application with an existing PDF editor.

The current editor provides several capabilities, including:

- Upload and preview PDF documents.
- Navigate between PDF pages.
- Zoom in and zoom out.
- Insert text into PDF pages.
- Add images, rectangles, ellipses, lines, and arrows.
- Drawing and highlighting tools.
- Select, move, and resize inserted objects.
- Configure text and object properties using the right-side Properties panel.
- Undo and redo operations.
- Export edited PDF files.

Some of these capabilities are visible in the provided reference screenshot. Codex must inspect the source code to verify their actual behavior and implementation.

### Current limitations

1. Object formatting controls occupy a large right-side properties panel.
2. Frequently used properties are not accessible through a compact, contextual top toolbar.
3. No dedicated workflow exists for quickly filling PDF forms.
4. Users must repeatedly create and configure text objects to enter common information.
5. Reusing a name, date, or signature across multiple pages is inconvenient.
6. Existing draft persistence capabilities need to be evaluated and extended to support both local and server storage.
7. Navigation and editing of longer PDF documents can be improved.

## 1.2 Project Goal

Redesign the current PDF editor into a modern document-editing interface supporting two main workflows:

**Edit PDF**

A general-purpose PDF editing workspace for adding and managing text, images, shapes, drawings, and annotations.

**Fill & Sign**

A specialized workspace for quickly filling forms using reusable information such as names, addresses, dates, checkmarks, and signatures.

Both workflows must use the same underlying PDF document, page-rendering system, and editable object model.

Users must be able to switch between workflows without losing document modifications.

## 1.3 Core Design Principles

- Reuse existing working functionality.
- Avoid unnecessary changes to the PDF rendering and export engine.
- Keep frequently used actions easily accessible.
- Minimize repetitive operations.
- Support multi-page documents.
- Keep PDF positioning consistent across zoom levels and exports.
- Preserve user edits during workflow changes.
- Support local-first editing and optional server synchronization.
- Avoid silently modifying the original uploaded PDF.
- Make editing predictable, responsive, and accessible.
- Keep the architecture extensible for future PDF features.

---

# 2. Implementation Instructions for Codex

Before making any changes:

1. Inspect the existing project structure.
2. Identify the frontend framework, state-management solution, PDF libraries, rendering engine, object-layer implementation, and backend architecture.
3. Examine the current editor components and relevant APIs.
4. Identify working functionality that can be reused.
5. Identify architectural limitations and any existing draft storage implementation.
6. Check existing tests and build commands.
7. Prepare a short implementation plan with affected files and technical decisions.

Do not assume a specific PDF or canvas library is already installed.

Prefer the current project's conventions, components, styling system, and dependencies.

Do not replace the existing PDF editing engine unless a significant, demonstrated technical limitation makes replacement necessary.

Implement features in phases. Keep the application working after each phase.

If a requested capability cannot safely be implemented using the existing architecture, explain the limitation and propose the smallest appropriate extension rather than introducing an unrelated rewrite.

---

# 3. Application Layout Redesign

## 3.1 Proposed Layout

The redesigned editor should use the following structure:

```text
┌───────────────────────────────────────────────────────────────────────┐
│ ConvertPro                  Document.pdf               Save   Export │
├───────────────────────────────────────────────────────────────────────┤
│ [Edit PDF] [Fill & Sign] [Organize Pages]                             │
├───────────────────────────────────────────────────────────────────────┤
│ Select | Text | Image | Shapes | Draw | Font | Size | Color | Undo    │
├─────────┬───────────────────────────────────────┬─────────────────────┤
│         │                                       │                     │
│ Page    │                                       │  Contextual Panel   │
│         │          PDF DOCUMENT CANVAS          │                     │
│ Thumb-  │                                       │  Fill & Sign:       │
│ nails   │                                       │  Name               │
│         │                                       │  Address            │
│ Page 1  │                                       │  Date               │
│ Page 2  │                                       │  Signature          │
│ Page 3  │                                       │  Checkmark          │
│         │                                       │                     │
├─────────┴───────────────────────────────────────┴─────────────────────┤
│ Page 1 of 5                 Zoom 100%           Saved locally        │
└───────────────────────────────────────────────────────────────────────┘
```

### Primary layout areas

**Top header**

- Document filename.
- Rename document.
- Draft save status.
- Save actions.
- Export PDF.
- Close editor.
- Optional overflow menu for secondary actions.

**Mode navigation**

- Edit PDF.
- Fill & Sign.
- Organize Pages.

The third mode may be introduced in a later phase.

**Top contextual toolbar**

- Editing tools.
- Formatting properties.
- Context-sensitive controls.
- Undo and redo.

**Left sidebar**

- Page thumbnails.
- Page navigation.
- Drag-and-drop page reordering in the page-management phase.
- Collapsible to maximize editing space.

**Center workspace**

- Rendered PDF document.
- Editable object overlay.
- Selection outlines and resize handles.
- Scrolling and zooming.
- Drop targets for draggable form components.

**Right sidebar**

- Fill & Sign reusable fields.
- Signature management.
- Optional advanced object properties.
- Collapsible and mode-aware.

**Bottom status bar**

- Current page.
- Total pages.
- Zoom percentage.
- Document save state.
- Optional PDF dimensions.

## 3.2 Responsive Layout

Desktop is the primary target.

On narrower screens:

- Prevent toolbar controls from overflowing the viewport.
- Collapse less-used controls into an overflow menu.
- Allow the thumbnail sidebar to collapse.
- Allow the right panel to collapse.
- Preserve adequate canvas interaction space.
- Support touch-friendly controls where practical.

Mobile editing can be progressively enhanced, but full mobile feature parity is not required in the initial implementation.

---

# 4. Edit PDF Mode

## 4.1 General Behavior

Edit PDF is the default editing workspace.

Preserve existing supported tools:

- Select
- Text
- Image
- Rectangle
- Ellipse
- Line
- Arrow
- Drawing
- Highlight

Tools may be grouped into a compact toolbar.

## 4.2 Context-Aware Top Toolbar

The top toolbar must change according to the active selection.

### No selected object

Display:

- Select tool
- Add text
- Add image
- Shapes dropdown
- Draw
- Highlight
- Undo / Redo
- Zoom controls, where appropriate

### Text selected

Display:

- Font family
- Font size
- Text color
- Bold
- Italic
- Underline
- Text alignment
- Opacity
- Duplicate
- Delete
- Advanced properties

### Image selected

Display:

- Replace image
- Crop, if supported
- Rotate
- Opacity
- Duplicate
- Delete
- Advanced properties

### Shape selected

Display:

- Fill color
- Stroke color
- Stroke width
- Opacity
- Duplicate
- Delete
- Advanced properties

### Drawing selected

Display:

- Stroke color
- Stroke width
- Opacity
- Delete

### Signature selected

Display:

- Resize
- Rotate
- Duplicate
- Delete
- Advanced properties

### Selection rules

- The toolbar must immediately reflect the selected object's current properties.
- Modifying a property must update the selected object.
- Selection must remain active when interacting with toolbar controls.
- Unrelated controls must not be displayed unnecessarily.
- Mixed-selection properties must use a safe and consistent state.
- Disabled actions must be visually distinguishable.

## 4.3 Advanced Properties

Not every property needs to appear in the top toolbar.

Less-frequently-used settings can remain in a collapsible advanced-properties panel:

- X coordinate
- Y coordinate
- Width
- Height
- Rotation
- Fine-grained opacity
- Layer ordering
- Lock position, if supported

This panel must open only when requested or when context makes it useful.

---

# 5. Fill & Sign Mode

## 5.1 Objective

Allow users to fill multi-page PDF forms with minimal repetitive input.

Typical workflow:

1. Upload a PDF form.
2. Switch to Fill & Sign.
3. Enter commonly used information once.
4. Click or drag reusable fields onto the PDF.
5. Adjust positioning and formatting.
6. Reuse the fields across multiple pages.
7. Insert signatures or checkmarks.
8. Save the draft.
9. Export the completed PDF.

## 5.2 Right-Side Quick Fill Panel

Provide reusable fields:

- Full name
- Address
- Place
- Date
- Custom text
- Signature
- Initials
- Checkmark
- Cross mark

Users must be able to edit the source value of each reusable text field.

Fields may have default values, but do not silently populate personal details without user input or an existing saved profile.

For dates, provide:

- Date picker
- Display format selector
- Custom manual text
- Option to insert today's date

Suggested formats:

- DD/MM/YYYY
- DD-MM-YYYY
- YYYY-MM-DD
- DD MMM YYYY

Store the underlying date separately from the chosen display format when possible.

## 5.3 Placement Interactions

Support two insertion methods.

### Method A — Drag and drop

1. User begins dragging a reusable field.
2. Canvas indicates valid drop targets.
3. User drops it onto a PDF page.
4. A corresponding object is created at the drop position.
5. The new object becomes selected.
6. User can resize or reposition it.

The sidebar source field must remain available for reuse.

### Method B — Click to place

1. User clicks a reusable field in the sidebar.
2. Application enters placement mode.
3. User clicks the target PDF location.
4. The field is inserted.
5. User can continue placing the same field or exit placement mode.

Escape must cancel placement mode.

Provide clear cursor or toolbar feedback indicating which field is being placed.

## 5.4 Reusable Field Behavior

Reusable values and document objects must be separate concepts.

Example:

```text
Saved value:
Full Name = "Manovignesh"

PDF objects:
Page 1 → Full Name
Page 3 → Full Name
Page 5 → Full Name
```

Each placed object must have independent:

- Position
- Width
- Height
- Font size
- Style
- Rotation
- Visibility

Objects should initially inherit the reusable field's value.

Support two value behaviors:

**Linked:** Changes to the reusable value update the linked objects.

**Independent:** An inserted object retains its own value and can be edited separately.

Default behavior should be clearly indicated. A suggested default is linked values with an option to detach individual instances.

Do not unexpectedly overwrite independently edited text.

## 5.5 Multi-Page Field Placement

Allow users to apply a reusable field to selected pages.

Options:

- Current page
- Selected pages
- All pages

Where appropriate, offer:

- Same position across pages
- Individual positioning after insertion

Repeated field insertion must generate independent object IDs.

Inserting a field across multiple pages must be a single undoable user action.

## 5.6 Text Fitting

Provide controls for placing text inside existing PDF form spaces.

Features:

- Adjustable font size
- Adjustable box width
- Alignment
- Optional auto-fit-to-width
- Wrapping for multiline fields
- Overflow indication
- Optional single-line mode

Auto-fit must respect a configurable minimum readable font size.

If text cannot fit, warn the user rather than silently clipping it.

## 5.7 Signature Creation

Support three signature creation methods.

**Draw signature**

- Mouse or pointer drawing.
- Touch input where supported.
- Clear and redraw.
- Preview before saving.

**Type signature**

- User enters signature text.
- Application offers a small set of suitable signature-style fonts.
- Preview and save.

**Upload signature**

- Accept supported image formats such as PNG and JPEG.
- Preserve transparency where available.
- Allow basic resizing and positioning.

Optional background removal can be considered later.

### Signature library

Users can:

- Save reusable signatures.
- Rename saved signatures.
- Insert a signature multiple times.
- Delete stored signatures.
- Choose whether to save a signature locally or in their authenticated account.

Do not upload a signature to the server without the user's explicit storage choice.

Signature objects must remain editable in a draft.

On export, the visual signature must be embedded correctly in the PDF.

**Important:** Visual signatures are not equivalent to certificate-backed cryptographic digital signatures. Certificate-based digital signing is outside the initial scope.

## 5.8 Checkmarks and Initials

Provide one-click insertion for:

- ✓ Checkmark
- ✕ Cross mark
- Initials
- Optional simple symbols

Allow resizing, color changes, and repositioning.

Ensure symbols render correctly in the exported PDF by embedding compatible fonts or converting them to suitable vector paths.

---

# 6. Shared Document Editing Engine

Both modes must use the same editable object model.

## 6.1 Supported Object Types

Suggested object types:

```text
text
image
rectangle
ellipse
line
arrow
drawing
highlight
signature
initials
checkmark
crossmark
```

The existing codebase may use different identifiers. Codex should preserve compatible existing types or introduce an appropriate mapping.

## 6.2 Shared Object Capabilities

Applicable objects should support:

- Select
- Move
- Resize
- Delete
- Duplicate
- Copy and paste
- Rotate
- Change applicable style properties
- Move forward or backward in the object stack
- Undo and redo

Do not expose operations that are not meaningful for a particular object type.

## 6.3 Keyboard Shortcuts

Recommended shortcuts:

| Shortcut | Action |
|---|---|
| Ctrl/Cmd + Z | Undo |
| Ctrl/Cmd + Shift + Z | Redo |
| Ctrl/Cmd + C | Copy selected object |
| Ctrl/Cmd + V | Paste object |
| Ctrl/Cmd + D | Duplicate |
| Delete / Backspace | Delete selected object |
| Escape | Deselect or cancel placement |
| Arrow keys | Nudge selected object |
| Shift + Arrow keys | Larger nudge |
| Ctrl/Cmd + S | Save draft |

Shortcuts must not interfere with text entry or browser-native behavior unexpectedly.

Use a centralized keyboard handler with correct input-focus checks and cleanup.

## 6.4 Undo and Redo

All meaningful editing operations must participate in document history.

Examples:

- Create object
- Delete object
- Move object
- Resize object
- Edit text
- Modify style
- Duplicate object
- Insert multiple linked fields
- Reorder pages

High-frequency actions such as dragging should be grouped into logical history entries.

Avoid creating hundreds of undo states during a single drag action.

---

# 7. PDF Page Navigation and Management

## 7.1 Page Thumbnail Sidebar

Add a collapsible thumbnail sidebar.

Each thumbnail should show:

- Page preview
- Page number
- Selected-page indication

Clicking a thumbnail navigates to the corresponding page.

For large PDFs, use lazy rendering or virtualization rather than rendering every page at full resolution.

## 7.2 Multi-Page Editing

Editing state must be maintained independently for every page.

Switching pages must not lose changes.

Objects must remain associated with their correct page when saving, reloading, and exporting.

## 7.3 Page Management — Later Phase

Include:

- Reorder pages
- Rotate pages
- Delete pages
- Insert blank pages
- Duplicate pages
- Extract selected pages

Object-to-page relationships must survive page reordering.

If page identifiers are currently index-based, consider using stable page IDs internally.

---

# 8. Coordinate System and Rendering Accuracy

This is a critical technical requirement.

PDF object positions must remain consistent between:

- Normal display
- Zoomed display
- Resized browser windows
- Draft reload
- Exported PDF

## 8.1 Coordinate Storage

Do not use raw browser pixel coordinates as the permanent source of truth.

Use canonical page-space coordinates tied to PDF dimensions, with explicit handling of page rotation and crop boxes.

Example object data:

```json
{
  "id": "object-uuid",
  "pageId": "page-uuid",
  "type": "text",
  "x": 120,
  "y": 250,
  "width": 180,
  "height": 24,
  "rotation": 0,
  "opacity": 1,
  "text": "Manovignesh",
  "style": {
    "fontFamily": "Helvetica",
    "fontSize": 14,
    "color": "#111111"
  }
}
```

The exact coordinate convention must be documented and consistently applied.

Rendering may convert these values into viewport coordinates.

Export must convert values into the PDF library's coordinate system.

Consider:

- Top-left versus bottom-left origins.
- Zoom and CSS scaling.
- PDF page rotation.
- CropBox and MediaBox differences.
- Device pixel ratio.
- Mixed page sizes.

## 8.2 Canvas Interaction

Use consistent coordinate transformation utilities for:

- Pointer selection
- Drag operations
- Resizing
- Object placement
- Drop position calculation
- Zooming
- PDF export

Avoid duplicating conversion logic across components.

## 8.3 Alignment Assistance

Provide:

- Snap-to-object guides
- Page-center guides
- Optional grid snapping
- Alignment indicators
- Keyboard nudging

Guides must only assist positioning and must not be embedded in exported PDFs.

---

# 9. Draft Storage System

Support both local and server draft storage.

## 9.1 Storage Modes

Users should have the following options:

**Local Draft**

Store editable project data on the user's device.

**Cloud Draft**

Store editable project data on the backend for authenticated access across devices.

**Local + Cloud Sync**

Maintain a local copy while synchronizing with the server.

Local draft storage should work without a backend account where browser capabilities allow.

Cloud storage requires an authenticated user and an appropriate authorization model.

## 9.2 Local Storage

Use IndexedDB or an equivalent browser database suitable for document-sized data.

Do not store large PDF binaries in localStorage.

Store:

- Original PDF bytes or a recoverable reference
- Project metadata
- Editable objects
- Reusable field values
- Embedded image assets
- Signature assets when explicitly permitted
- Page metadata
- Last modification timestamp
- Schema version

Support opening existing local drafts.

Handle unavailable storage, quota errors, private browsing restrictions, and browser data deletion gracefully.

## 9.3 Server Storage

Use the existing backend architecture where available.

Store:

- Draft ownership
- Project metadata
- Source PDF reference
- Editable document state
- Referenced assets
- Save revision
- Creation and modification timestamps

Choose file/blob/object storage based on the current architecture rather than placing arbitrarily large binaries directly in relational JSON columns.

Every server operation must validate document ownership or equivalent access permissions.

## 9.4 Proposed Draft Data Structure

Illustrative schema:

```json
{
  "schemaVersion": 1,
  "projectId": "project-uuid",
  "name": "Application Form",
  "sourcePdf": {
    "assetId": "pdf-asset-id",
    "checksum": "sha256-hash"
  },
  "pages": [
    {
      "id": "page-uuid",
      "sourcePageIndex": 0,
      "rotation": 0,
      "objects": [
        {
          "id": "object-uuid",
          "type": "text",
          "x": 100,
          "y": 200,
          "width": 160,
          "height": 22,
          "rotation": 0,
          "text": "Manovignesh"
        }
      ]
    }
  ],
  "fieldDefinitions": [
    {
      "id": "field-uuid",
      "type": "name",
      "label": "Full Name",
      "value": "Manovignesh"
    }
  ],
  "assetReferences": [],
  "revision": 4,
  "updatedAt": "2026-10-10T12:00:00Z"
}
```

The final schema must retain complete style data, object references, and links between placed field instances and reusable field definitions.

This JSON is a conceptual representation, not a requirement to use the exact property names.

## 9.5 Autosave

Enable debounced autosave for local drafts.

Suggested initial debounce: 1–2 seconds after the last document change.

Required states:

- Unsaved changes
- Saving locally
- Saved locally
- Syncing to cloud
- Synced
- Offline
- Save failed
- Conflict detected

Do not display "Saved" before persistence completes successfully.

Use a dirty-state indicator.

When leaving with unsaved or unpersisted changes, provide an appropriate warning where browser capabilities permit.

## 9.6 Cloud Synchronization

Cloud synchronization must:

1. Detect local changes.
2. Persist them locally first.
3. Queue synchronization.
4. Upload or update the cloud draft.
5. Track server revision.
6. Report synchronization results.
7. Retry recoverable failures with bounded backoff.

Avoid uploading the unchanged original PDF on every autosave.

Use incremental document state updates or revisioned snapshots when practical.

## 9.7 Conflict Handling

Concurrent modification must not silently overwrite newer changes.

Use optimistic concurrency through a revision number, ETag, or equivalent version mechanism.

On conflict, provide choices such as:

- Keep local version as a separate draft
- Load cloud version
- Compare versions, if supported

Automatic object-level merging is not required initially.

Never silently discard unsynchronized local changes.

## 9.8 Draft Actions

Provide:

- Save draft
- Save as new draft
- Open draft
- Rename draft
- Delete draft
- Export PDF

Deletion should require confirmation and respect local/cloud storage scope.

---

# 10. Backend API Requirements

If the application already has equivalent endpoints, extend them instead of creating duplicates.

Suggested REST API contracts:

```text
POST   /api/pdf/drafts
GET    /api/pdf/drafts
GET    /api/pdf/drafts/:id
PUT    /api/pdf/drafts/:id
DELETE /api/pdf/drafts/:id

POST   /api/pdf/assets
GET    /api/pdf/assets/:id

POST   /api/pdf/signatures
GET    /api/pdf/signatures
DELETE /api/pdf/signatures/:id
```

These are proposed route names, not mandatory names.

### Draft creation

Accept project metadata and an associated source PDF asset reference.

### Draft retrieval

Return the latest authorized project state and revision.

### Draft update

Require the expected revision to prevent lost updates.

Return the new revision after successful persistence.

### Asset upload

Enforce file type validation, file size limits, and ownership.

### Signature storage

Provide per-user access controls and deletion.

Signed URLs or equivalent restricted asset access should be considered where relevant.

Document and asset retrieval must be protected against unauthorized cross-user access.

---

# 11. Export PDF

## 11.1 Export Behavior

Export must generate a valid downloadable PDF containing:

- Original document content
- Added text
- Added images
- Shapes and annotations intended for export
- Inserted signature visuals
- Checkmarks
- Filled fields
- Page changes supported by the editor

Objects must appear at the same intended positions and dimensions as in the editing preview.

## 11.2 Export Options

Initial options:

- Export all pages
- Export selected pages, if page selection is implemented
- Choose filename

Advanced options can include:

- Flatten added annotations
- Preserve interactive form fields where supported
- PDF compression

Flattening must be clearly distinguished from saving an editable ConvertPro draft.

## 11.3 Original PDF Content

In the initial implementation, inserted objects may be overlay objects while original PDF text remains read-only.

Do not advertise full native editing of original text unless the underlying implementation supports it.

True PDF text-content modification should be treated as an independent advanced capability.

## 11.4 Export Validation

Verify the exported document by rendering the resulting PDF and comparing representative object positions with the editor preview.

Test:

- Different page sizes
- Rotated pages
- Multiple pages
- Different font sizes
- Non-ASCII characters
- Images with transparency
- Repeated signatures
- High zoom levels
- Mixed orientations

---

# 12. Native PDF Form Field Support

Implement in a subsequent phase.

Detect supported AcroForm fields where the PDF library and document permit it.

Potential supported fields:

- Text input
- Multiline text
- Checkbox
- Radio button
- Dropdown

When native fields are available, allow users to fill them directly.

Provide a visual distinction between native PDF fields and ConvertPro overlay objects where necessary.

When a PDF does not contain interactive fields, Fill & Sign must still work using overlay objects.

Preserving versus flattening interactive form fields should be an explicit export choice once both behaviors are supported.

XFA form support is not required initially.

---

# 13. Privacy and Security

PDF documents frequently contain personal information.

Required protections:

- No automatic cloud upload for local-only documents.
- Authenticate cloud draft access.
- Authorize every document and asset operation.
- Validate upload types and file sizes.
- Sanitize document names and untrusted metadata.
- Avoid executing PDF JavaScript or embedded active content.
- Protect APIs against unsafe document paths and asset access.
- Avoid logging document content or signatures.
- Use encrypted transport for backend communications.
- Respect existing application security controls.
- Allow deletion of uploaded draft assets according to retention policy.

Signature images must be treated as sensitive user assets.

Local-only editing must not require uploading the PDF to a remote service unless the user explicitly invokes a server-dependent feature and accepts that data transfer.

---

# 14. Performance Requirements

The editor must remain responsive for typical multi-page documents.

Recommended techniques:

- Lazy rendering of PDF pages.
- Thumbnail caching.
- Virtualization for lengthy documents.
- Debounced draft saving.
- Memoized or efficiently managed object rendering.
- Avoid unnecessary whole-document re-renders.
- Revoke temporary object URLs when no longer needed.
- Release obsolete PDF rendering resources.
- Handle large file uploads safely.

Performance targets should be established using the existing application's baseline.

Initial recommended targets:

- Typical 5–20 page documents remain comfortably interactive on a standard desktop.
- Dragging objects should remain smooth during normal use.
- Autosave should not visibly interrupt editing.
- Switching modes must not trigger a full document reload.
- Thumbnail rendering must not block initial access to the first page.

Do not require loading every page at full resolution before the editor becomes usable.

---

# 15. Accessibility and Usability

Required usability improvements:

- Keyboard-accessible primary controls.
- Visible focus indicators.
- Tooltips for icon-only buttons.
- Correct button labels.
- Clear active-tool indication.
- Sufficient contrast.
- Disabled-state feedback.
- Meaningful save and error messages.
- Confirmation for destructive actions.

Drag-and-drop must not be the only way to place form fields.

Support click-to-place and keyboard-accessible alternatives where practical.

---

# 16. Error and Edge Case Handling

The implementation must explicitly handle the following cases.

## 16.1 Documents

- Password-protected PDF
- Corrupted PDF
- Unsupported PDF features
- Zero usable pages
- Very large documents
- Mixed page sizes
- Rotated pages
- Scanned/image-only documents

Provide actionable errors rather than blank rendering areas.

## 16.2 Editing

- Object partially outside page boundaries
- Object deleted during selection
- Undo after switching pages
- Undo after multi-page insertion
- Zoom during drag or placement
- Font not available at export time
- Text overflow
- Large or transparent images
- Copy/paste across pages
- Page rotation affecting object positions

## 16.3 Draft Storage

- Storage quota exceeded
- IndexedDB unavailable
- Network disconnect
- Server timeout
- Unauthorized access
- Expired authentication
- Cloud revision conflict
- Draft deleted from another device
- Partial asset upload
- Local draft contains a missing PDF asset
- Browser closed during synchronization

## 16.4 Signatures

- Empty signature drawing
- Corrupted uploaded signature
- Oversized signature file
- Transparent image rendering
- Signature asset removed while in use
- Multiple signatures on the same page

Every failure must preserve existing successful edits whenever possible.

---

# 17. Implementation Phases

## Phase 0 — Repository Audit and Design

**Tasks**

- Inspect existing PDF editor.
- Map current components and dependencies.
- Review document state and export paths.
- Review backend and authentication.
- Identify existing storage facilities.
- Check test coverage.
- Produce a short technical implementation plan.

**Deliverable**

A repository-specific design and change list.

Do not start a broad refactor without completing this audit.

## Phase 1 — Editor UI Redesign

**Tasks**

- Introduce new layout.
- Add Edit PDF and Fill & Sign navigation.
- Move common formatting controls to the top.
- Implement contextual toolbar behavior.
- Make right sidebar mode-aware.
- Add collapsible page thumbnails.
- Improve selection and keyboard shortcuts.
- Preserve existing PDF tools.

**Acceptance criteria**

- Existing tools continue functioning.
- Contextual toolbar reflects selected object.
- Changes made through toolbar update the object.
- Sidebars can collapse without breaking canvas alignment.
- Switching modes preserves edits.
- Zoom and navigation remain functional.
- Existing PDF export remains operational.

## Phase 2 — Fill & Sign

**Tasks**

- Implement reusable field definitions.
- Build Quick Fill sidebar.
- Implement drag-and-drop insertion.
- Implement click-to-place.
- Add date formats.
- Add text-fit controls.
- Implement linked and independent field instances.
- Implement multi-page placement.
- Add signatures, initials, checkmarks, and cross marks.

**Acceptance criteria**

- Name entered once can be placed on multiple pages.
- Each placed instance has independent positioning.
- Linked values update linked instances.
- Detached instances retain their own values.
- Users can create, save, and reuse signatures.
- Drag and click placement produce accurate positions.
- Multi-page placement can be undone as one operation.
- Export contains all inserted elements.

## Phase 3 — Draft Storage

**Tasks**

- Establish versioned draft schema.
- Implement IndexedDB persistence.
- Implement draft reopen.
- Implement autosave.
- Add server-backed draft APIs.
- Add authenticated document ownership.
- Implement synchronization.
- Handle revision conflicts.
- Provide save-state indicators.

**Acceptance criteria**

- Local draft survives browser refresh.
- Draft can be reopened for editing.
- PDF and added objects are restored.
- Cloud draft can be opened by the authorized user.
- Unauthorized users cannot retrieve another user's drafts.
- Offline editing preserves changes locally.
- Synchronization resumes after reconnection.
- Conflicts do not silently overwrite data.
- Storage failures produce visible errors.

## Phase 4 — Advanced PDF Features

**Tasks**

- Implement page reordering.
- Add page rotation and deletion.
- Support native PDF form fields.
- Add improved alignment tools.
- Add PDF text search.
- Explore optional content covering.
- Improve export options and validation.

**Acceptance criteria**

- Objects remain attached to correct pages after reordering.
- Rotated pages render and export accurately.
- Supported native form fields can be completed.
- Unsupported forms remain usable through overlays.
- Search locates selectable document text where available.
- Exported files remain valid.

## Phase 5 — Testing, Optimization, and Release Readiness

**Tasks**

- Add unit tests.
- Add integration tests.
- Add browser end-to-end tests.
- Add export regression tests.
- Test multi-page workflows.
- Test local/cloud synchronization.
- Validate responsive behavior.
- Profile rendering performance.
- Update documentation.

**Acceptance criteria**

- Critical workflows pass automated tests.
- No regressions in existing tools.
- Save and export errors are handled.
- Generated PDFs reopen in standard PDF viewers.
- Common workflows function without console errors.
- No unresolved critical data-loss issues remain.

---

# 18. Testing Requirements

## 18.1 Unit Tests

Cover:

- Coordinate transformations
- PDF page identity handling
- Object creation and serialization
- Field linking and detaching
- Date formatting
- Undo/redo history
- Draft schema validation
- Revision conflict detection

## 18.2 Integration Tests

Cover:

- Toolbar-to-canvas updates
- Field placement
- Multi-page insertion
- Draft save/reopen
- Asset loading
- API ownership checks
- Cloud synchronization
- Export pipeline

## 18.3 End-to-End Tests

Recommended browser workflows:

**Scenario 1: General editing**

1. Open a PDF.
2. Insert text.
3. Change font size.
4. Move text.
5. Export PDF.
6. Verify the text is present.

**Scenario 2: Form filling**

1. Open a five-page PDF.
2. Enter reusable name and place.
3. Place name on pages 1, 3, and 5.
4. Insert date on page 2.
5. Insert signature on page 5.
6. Export PDF.
7. Verify content placement.

**Scenario 3: Draft recovery**

1. Open PDF.
2. Add several objects.
3. Wait for confirmed local save.
4. Refresh browser.
5. Reopen draft.
6. Verify all objects and positions.

**Scenario 4: Cloud synchronization**

1. Create authenticated cloud draft.
2. Modify it.
3. Synchronize.
4. Reopen from a different session.
5. Verify document consistency.

**Scenario 5: Offline handling**

1. Open a locally available draft.
2. Disconnect network.
3. Edit document.
4. Verify local save.
5. Restore network.
6. Verify synchronization.

**Scenario 6: Revision conflict**

1. Open the same cloud draft in two sessions.
2. Make separate edits.
3. Save the first session.
4. Attempt to synchronize the second.
5. Verify conflict handling without data loss.

Automated export tests should verify document geometry and content, not only that the PDF download succeeds.

---

# 19. Technical Architecture Recommendations

Keep responsibilities separated.

Suggested logical modules:

```text
PDF Editor
│
├── Editor Shell
│   ├── Header
│   ├── Mode Navigation
│   ├── Contextual Toolbar
│   ├── Thumbnail Sidebar
│   └── Right Sidebar
│
├── PDF Engine
│   ├── PDF Loader
│   ├── Page Renderer
│   ├── Coordinate Mapper
│   └── PDF Exporter
│
├── Editing Engine
│   ├── Object Model
│   ├── Selection Controller
│   ├── Transform Controller
│   ├── History Manager
│   └── Clipboard Manager
│
├── Edit PDF
│   ├── Text
│   ├── Images
│   ├── Shapes
│   └── Annotations
│
├── Fill & Sign
│   ├── Field Definitions
│   ├── Field Placement
│   ├── Signature Manager
│   └── Multi-page Placement
│
├── Draft Management
│   ├── Serialization
│   ├── Local Repository
│   ├── Cloud Repository
│   ├── Autosave
│   └── Sync Manager
│
└── Tests
    ├── Unit
    ├── Integration
    └── E2E
```

These are logical boundaries, not mandatory filesystem paths.

Codex should map this structure onto the current application architecture.

### State management

Maintain one canonical document state.

UI panels should read and modify this shared document state rather than maintaining conflicting copies.

Transient UI state and persisted document state should be separated.

Examples of transient state:

- Active toolbar mode
- Selected object
- Open sidebar
- Current zoom
- Active drag operation

Examples of persisted state:

- PDF source reference
- Page order
- Object positions
- Object content and styling
- Reusable field definitions
- Linked object relationships
- Embedded assets

### Data migrations

All stored drafts must include a schema version.

Future versions should support migration of older editable drafts without silent data loss.

---

# 20. Features Explicitly Outside Initial Scope

The initial implementation does not need:

- Collaborative real-time multi-user editing
- Google Docs-style simultaneous cursors
- Full native rewriting of original PDF text
- Certificate-backed digital signatures
- OCR-based text reconstruction
- AI-powered automatic form filling
- Guaranteed support for every PDF standard extension
- Automatic merging of simultaneous conflicting edits

Architectural choices should avoid unnecessarily preventing these features later.

---

# 21. Definition of Done

The redesign is complete when:

1. The new editor layout works without loss of existing functionality.
2. Contextual formatting works for supported object types.
3. Edit PDF and Fill & Sign use the same document model.
4. Users can rapidly reuse form values on different PDF pages.
5. Signatures can be placed, resized, reused, and exported.
6. Inserted objects maintain position through zoom, save, reload, and export.
7. Local editable drafts can be saved and reopened.
8. Authenticated cloud drafts can be saved and reopened.
9. Synchronization failures and conflicts do not silently destroy edits.
10. Multi-page PDFs export correctly.
11. Critical flows are covered by automated tests.
12. Existing features are regression-tested.
13. Relevant architecture and usage documentation is updated.

---

# 22. Final Instructions to Codex

Implement this specification incrementally within the existing ConvertPro application.

**Required working process:**

1. First inspect the existing codebase.
2. Identify existing functionality, dependencies, APIs, and data models.
3. Provide a concise repository-specific implementation plan.
4. Identify any requirements that conflict with current architecture.
5. Preserve existing working functionality.
6. Implement one phase at a time.
7. Add or update tests alongside each phase.
8. Run relevant lint, type-check, test, and build commands.
9. Fix regressions before proceeding.
10. Summarize completed work, changed files, test results, and any remaining limitations.

**Important constraints:**

- Do not replace existing working modules unnecessarily.
- Do not introduce duplicate document state models.
- Do not conflate PDF rendering with persistent document coordinates.
- Do not silently upload local-only documents.
- Do not report a draft as saved until persistence is confirmed.
- Do not overwrite cloud revisions without conflict checking.
- Do not treat a visual signature as a cryptographic digital signature.
- Do not claim original PDF text is natively editable when only overlays are supported.
- Do not implement cosmetic UI changes while leaving advertised controls nonfunctional.
- Do not mark a phase complete without verifying its acceptance criteria.

**Start with Phase 0: inspect the repository and prepare the implementation plan. Then proceed through the phases in order, subject to approval of any major architectural change.**
