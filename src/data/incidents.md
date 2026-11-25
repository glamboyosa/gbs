# Turning map alerts into an incident someone can follow up

How I built incident reporting in Guardian Connector Explorer, from selecting evidence on a map to saving, sharing and exporting it. This is about environmental incidents, not an IT outage tracker.

[Storyboard](/storyboards/incidents) · [Create and reopen: sequence diagram](/incidents/sequence) · [Shared Excalidraw board](https://excalidraw.com/#json=A8iwcCl2OREHVlfW1LKGr,Uq90IRHolzvxhFHMlRiUsQ)

## The one-minute version

A map can show where something happened. It does not tell the next person which alerts belong together, what someone thinks they mean, or what needs following up.

I built the core incidents flow in Guardian Connector Explorer so someone monitoring a territory could select alerts and field observations, give the group a name, and record their interpretation. They can return to that record, send an authorised colleague a link to the same evidence, or take it into a spreadsheet or mapping tool.

The stack is Vue and Nuxt, TypeScript, Mapbox GL, Nuxt server APIs, Drizzle and PostgreSQL. The important boundary is between the warehouse, which holds the map's source data, and the configuration database, which holds the incident and a saved copy of its evidence. The map is how someone selects the evidence. It is not the only place that evidence lives.

## The person using it

Imagine a community monitor reviewing several possible clearing alerts near a road. One alert might not say much. Three neighbouring alerts, an observation from the field and a note about what was seen give the next person something to investigate.

The user story is simple:

> I want to group the alerts and observations that describe an incident, write down what I know, and return to or share that record without reconstructing it from a map.

That example is illustrative. The names and map in the storyboard are placeholders, not a report from a community. The software records an interpretation; it does not automatically establish that an allegation is true.

## What I owned

My work covered the incident API and its UI, the browser tests, and subsequent fixes to selection, exports, deletion, view scoping and migrations. The merged pull requests under my Conservation Metrics account provide the history: the [initial test UI](https://github.com/ConservationMetrics/gc-explorer/pull/262), [tests](https://github.com/ConservationMetrics/gc-explorer/pull/276), [component split](https://github.com/ConservationMetrics/gc-explorer/pull/278) and [incident MVP](https://github.com/ConservationMetrics/gc-explorer/pull/292), followed by the smaller changes linked below.

This is the current end-to-end design, including changes made after the first version. It sits within a team-owned application; the presence of a feature in today's code is not a claim that I wrote every surrounding component or access-control rule alone.

## The flow someone sees

### Select the evidence

The alerts dashboard offers multi-select and bounding-box selection. A selection is visible on the map, and the create action becomes available when there are selected sources. The composable rejects creating an incident with an empty selection.

The identity of a selected item matters more than its position on the screen. An entry carries a source table, a source id and an explicit feature type. Alerts use `alert_id`; secondary observations use `_id`. A point rendered as a cluster or a polygon still needs to resolve to the right source record.

I keep this state in `useIncidents`, with the controls and form in separate components. Selection, map highlighting, the selected incident and the open sidebar are related, but they are not the same state. Leaving a selection mode needs to restore the normal alerts introduction, rather than leaving the dashboard in a half-closed editing state.

### Say what the evidence means

The sidebar asks for a name and offers description, incident type, responsible party, impact and supporting-evidence metadata. These are annotations around the selected data, not changes to the original alerts. A new incident defaults to `suspected` and active.

The UI sends the selected entries and the current view's parent alerts table to `POST /api/incidents`. It waits for a successful response before clearing the selection and closing the create form. An unsuccessful save should not look like a completed incident.

### Save something that can be reopened

The incident endpoints apply the application's Member-level permission guard. When an Auth0 identity is available, creation attribution comes from the session. The create handler requires a collection name and creates an incident collection through the shared annotated-collections service.

The service writes three related pieces:

| Record | What it remembers |
| --- | --- |
| `annotated_collections` | Name, description, type, author and timestamps |
| `incidents` | Parent alerts table, incident type, status, impact and other incident-specific fields |
| `collection_entries` | Source table/id, a saved source-data snapshot, entry attribution and notes |

For each selected entry, the server reads the source row from the warehouse and stores a copy in `source_data`. The collection, incident metadata and entries are written in one **configuration-database transaction**. If a write fails, those configuration writes roll back together.

That is not a transaction spanning both databases. Warehouse reads happen while the service is assembling the incident; they do not lock the warehouse into a shared historical snapshot. The saved data is a copy of what those reads returned, and a source lookup that returns no row is currently stored as an empty object. I would not describe this as a guaranteed complete forensic snapshot.

A unique constraint on `(collection_id, source_table, source_id)` stops the same source appearing twice in one collection. Saving an incident does not rewrite the original warehouse record.

![Incident reporting architecture: selection in the browser, guarded API calls, source reads from the warehouse and transactional writes to the configuration database.](/images/diagrams/incidents-architecture.svg)

## Two details that made it a usable record

### A saved incident belongs to a view

An incident can contain entries from more than one source table. Inferring its parent view from those entries is ambiguous: an alert and a field observation may come from different datasets but belong to the same investigation.

I added a canonical `parent_alerts_table` field. Creation sends the current alerts table; listing sends that same field as a filter. The database query joins incident metadata to collections and applies the parent-table condition. A user opening one alerts view does not get an unscoped list of every incident in the installation.

This is view scoping, not a substitute for authentication. The [scoping PR](https://github.com/ConservationMetrics/gc-explorer/pull/392) deliberately left legacy parent values nullable while backfill rules were worked out. The API's role guard is a separate boundary, and the current design should not be described as per-incident ownership authorisation.

### A link restores the evidence, not just the sidebar

Opening an incident loads its details and entries, highlights them and fits the map to their combined extent. The route receives `incidentId`, while unrelated single-feature query parameters are removed. Opening the link later loads that incident again and puts its evidence in view.

That distinction matters. A link that only opened the sidebar would still leave a colleague hunting across a map. The end-to-end spec checks that the linked feature falls within the reloaded map bounds and that the map has zoomed in from the original view.

The link does not make the incident public. The receiving person still goes through the application's normal access controls.

Incident details use an in-memory cache and an in-flight request map, so repeated opens can reuse data and simultaneous requests for one incident can share a promise. Hover prefetch waits 400 milliseconds and is best effort. This is not live collaboration or a subscription to other people's edits; cache freshness remains a trade-off.

## Taking the record out of the dashboard

I added [two downloads](https://github.com/ConservationMetrics/gc-explorer/pull/378) to the detail sidebar. They are generated from the incident payload already loaded in the browser.

**CSV** starts with field/value rows for the incident and collection. A second table contains one row per entry: its source identity, notes and added time, followed by the union of saved non-geometry source fields. The result is useful in a spreadsheet even when the entries came from different datasets.

**GeoJSON** contains one feature per saved entry. If its stored geometry validates, the export uses it. Otherwise the feature retains its properties with `geometry: null`. Missing geometry should not silently remove an entry from the exported record.

Doing this in the browser avoided another server request for data the user already had. Very large incidents or a requirement for centrally enforced export policy would be reasons to move that work to a dedicated endpoint. Neither is a capability I am claiming for the current download buttons.

## A migration that succeeded without changing the schema

The view-scoping change exposed a less visible problem. Drizzle's migration command returned successfully, but migration `0005` had not run.

Its journal timestamp was older than `0004`'s. The migrator compares that value with the latest recorded migration, so it treated the new migration as already behind the database. A successful command exit was not proof that `parent_alerts_table` existed.

I [corrected the journal ordering](https://github.com/ConservationMetrics/gc-explorer/pull/404), added the statement breakpoints Drizzle expects, and made the column addition tolerate an existing column. A separate migration backfilled missing parent values from saved entries, starting with collections that used one source table and then applying the agreed dominant-table heuristic to remaining rows.

The backfill is a legacy-data heuristic, not a general rule for identifying a view from mixed evidence. New records store the parent explicitly. I have no measured outage duration or user-impact number for this issue; the concrete lesson is to inspect actual schema state and migration history rather than treating exit code zero as the result.

## How I checked the flow

The browser suite is [`tests/e2e/07-annotated-collections.spec.ts`](https://github.com/ConservationMetrics/gc-explorer/blob/7962eb4167a084931f24cf402bb0d536e86b25ec/tests/e2e/07-annotated-collections.spec.ts). It exercises the interaction through the real dashboard:

- Opening and closing saved incidents.
- Selecting a rendered alert and enabling creation.
- Creating an incident, reopening it and checking cluster highlighting.
- Displaying creator attribution rather than a generic system label.
- Reloading an `incidentId` link and checking map bounds and zoom.
- Showing the CSV and GeoJSON download actions.
- Restoring the alerts introduction after leaving selection modes.

The current suite uses per-test warehouse-view fixtures, including a local basemap style, so these views do not depend on a shared named dashboard or a remote style response. The geometry-dependent cases explicitly skip when they cannot find a selectable feature. That is a limitation to inspect in a test report, not a passed assertion.

Unit tests cover map bounds, exports and the Member-level API guards. A browser assertion that download buttons are visible is different from checking the contents of their files; the export helpers' unit tests cover the CSV and geometry cases.

I read this code and test coverage for this write-up. I did not rerun the authenticated GC-Explorer browser suite here, and I am not presenting the number of tests as a production reliability or adoption metric.

## Where AI helped, and where it did not decide

I used coding agents for parts of this work. The [test PR](https://github.com/ConservationMetrics/gc-explorer/pull/276) records trying Zed, OpenCode and models for the test-writing workflow. The migration PR records consultation and SQL drafting assistance, with the migration behaviour checked against Drizzle's implementation.

The useful boundary is the same one I later made explicit in [Katalepsis](/katalepsis): generated code and an agent's confidence are not proof of runtime behaviour. The browser still has to select a feature, save a record and reopen the right evidence. A migration still has to exist in the database after the tool says it ran.

## What I would say in an interview

**Frontend:** I had to keep map selection, clusters, sidebar state and a shareable route consistent. A successful API response alone did not prove the user could return to the same evidence.

**Backend:** I modelled incidents as annotated collections, with incident-specific metadata and evidence entries. Configuration writes commit together, and a source-table/id constraint protects entry identity.

**Full stack:** The source identity selected on the map has to survive the request, warehouse lookup, saved snapshot, detail response, reloaded route and export. That is the path I would trace when something looks wrong.

**Architecture ownership:** I made the parent view explicit instead of inferring it from mixed evidence. I also chose to reuse loaded data for exports, with a clear point at which scale or policy would justify a server-side path.

**A failure I learned from:** A migration returned success but had been skipped because of journal ordering. I checked the actual schema, fixed the ordering and added the backfill, rather than changing UI code around a missing column.

## Source trail

The implementation described here was reviewed at GC-Explorer commit [`7962eb4`](https://github.com/ConservationMetrics/gc-explorer/tree/7962eb4167a084931f24cf402bb0d536e86b25ec). The main paths are:

- [`useIncidents.ts`](https://github.com/ConservationMetrics/gc-explorer/blob/7962eb4167a084931f24cf402bb0d536e86b25ec/composables/alerts/useIncidents.ts): selection, fetching, saving, routes and highlighting.
- [`IncidentsSidebar.vue`](https://github.com/ConservationMetrics/gc-explorer/blob/7962eb4167a084931f24cf402bb0d536e86b25ec/components/alerts/IncidentsSidebar.vue): the form, details and download actions.
- [`server/api/incidents`](https://github.com/ConservationMetrics/gc-explorer/tree/7962eb4167a084931f24cf402bb0d536e86b25ec/server/api/incidents): the incident endpoints.
- [`server/annotatedCollections`](https://github.com/ConservationMetrics/gc-explorer/tree/7962eb4167a084931f24cf402bb0d536e86b25ec/server/annotatedCollections): shared handlers and persistence.
- [`annotatedCollections.ts`](https://github.com/ConservationMetrics/gc-explorer/blob/7962eb4167a084931f24cf402bb0d536e86b25ec/server/database/schemas/annotatedCollections.ts): the stored records and constraints.
- [`incidentHelpers.ts`](https://github.com/ConservationMetrics/gc-explorer/blob/7962eb4167a084931f24cf402bb0d536e86b25ec/utils/incidentHelpers.ts): bounds and export behaviour.

The [storyboard](/storyboards/incidents) follows the person using it. The [sequence diagram](/incidents/sequence) follows the requests and records.
