# Rebuilding the wildfire data pipeline

Interview notes on the FIRMS refactor I designed, built and shipped at Conservation Metrics, September to October 2026.

## The one-minute version

I rebuilt the wildfire pipeline behind a conservation dashboard that tracks threats to Indigenous territories. The fire data comes from NASA's satellite fire detections, a product called FIRMS.

The old pipeline appended every load into one table with no unique key, so the same fires piled up two and three times. The dashboard showed roughly three times the real fire count. It also threw away every fire outside the current territories, so adding a territory meant downloading and reprocessing years of CSV files, and it repeated the same spatial join on every refresh and counted fires on every chart request.

I wrote the design doc, proved the design on a full-size copy of production with 140 million real rows, wrote the end-to-end tests first, then built it as a stack of small pull requests. The new pipeline has three commands. One loads NASA's yearly archive into year-partitioned tables. One loads the rolling 7-day file. One recomputes every territory and grouping count from the stored detections. Every load is idempotent, every write runs in one transaction, and the API reads small precomputed tables, so no request runs a point-in-polygon join.

In production it holds 124.5 million detections. A full recompute takes 24 minutes, down from 3 hours 7 minutes in the prototype, and the daily update takes about 2 minutes on the smallest database tier. I proved the new numbers were right by deduplicating the old table and reproducing my new counts from it exactly, for every year.

## Background

### The product

The dashboard shows environmental indicators for 102 Indigenous territories: tree loss, land cover, carbon, and fires. Users can look at one territory, or at a grouping of territories. A grouping is a region, a bioregion, a country, a partnership, a few other tags, or the global view. Production has 150 groupings.

Every territory has two shapes:

- `geometry`, the territory's own polygon.
- `buffered_geometry`, a generated column that adds a 10 km buffer around the polygon.

A fire is **inside** when the polygon contains it, and **buffered** when the 10 km buffer contains it. Buffered includes inside. The fire chart shows both numbers: yearly bars from 2019 onward, and a daily view of the last 7 days. The map shows the fire points themselves as vector tiles, coloured by inside or buffer-only.

### The data

NASA FIRMS publishes active fire detections from the VIIRS instrument on the Suomi NPP satellite. Two sources matter:

- **The yearly archive.** One CSV per country per year, published about six months after the year ends. A year is about 220 files and 1.5 GB, and holds 15 to 19 million detections once low confidence is removed.
- **The rolling 7-day file.** One global CSV of the last seven days, regenerated every hour. It holds about 350,000 to 420,000 rows.

Each row has a date, a time (HHMM, UTC), latitude, longitude, satellite, a confidence level, and some measurements such as brightness and fire radiative power. Confidence is low, nominal or high. The dashboard only counts nominal and high. The two files even spell confidence differently: the archive uses `l`, `n`, `h`, and the 7-day file uses `low`, `nominal`, `high`.

### The stack

TypeScript and Node, Express, TypeORM, PostgreSQL 17 with PostGIS on Azure Database for PostgreSQL. Collectors are CLI commands that operators run on a VM. The API runs as a container on Azure. Tests use Jest against a PostGIS container.

## The problem

### How the old pipeline worked

Everything went through one table and two materialized views.

- `fire_footprints`: a table of fire points with no primary key and no unique constraint.
- `fire_footprints_view`: a materialized view joining fires to territories with `ST_Contains` on the buffer, with a flag for inside.
- `fire_footprints_groupings_view`: a materialized view joining fires to grouping shapes the same way.

There were two collectors.

- **The 7-day collector** downloaded NASA's file, copied every row into `fire_footprints`, built the point geometry, deleted every row outside every territory buffer, then refreshed the materialized view. That refresh ran the same spatial join a second time.
- **The yearly collector** read the yearly CSVs in Node worker threads, filtered each row against the territories with the Turf library, wrote filtered copies of the files to disk, copied them into `fire_footprints`, and refreshed the view, which ran the spatial join again. The list of years was hard-coded in the source: `['2019', ..., '2025']`. Adding a year meant a code change.

The API counted fires at request time with `COUNT(1) ... GROUP BY date` over the materialized views.

### What was wrong with it

1. **The counts were inflated.** Both collectors appended, and nothing stopped the same file from loading twice. When I checked production, about 390,000 fires were stored three times and 105,000 twice. Every copy was identical down to the brightness value. From 2019 to 2024 there were 2.5 to 2.8 rows per real fire. The dashboard was showing roughly three times the true count.
2. **Adding a territory needed the old CSVs.** Both collectors deleted every fire outside the current territories. A new territory had no fire history until someone found the old yearly files and reprocessed them.
3. **The spatial work ran in the wrong places.** The same `ST_Contains` join ran in the collector, again in each view refresh, and the API grouped and counted on every request. The database runs on a small tier for normal traffic, so this was slow and fragile.
4. **Concurrent runs corrupted data.** Both collectors used `fire_footprints` as a shared staging table. The code had a comment saying so: `BUG: data corruption if both collectors run concurrently.`
5. **Several smaller bugs.** Low-confidence fires were counted. The API shifted every date by two days. Years with no fires had no bar. Grouping and global maps drew every territory's fires, so a fire in two territories appeared twice. A 7-day file that spanned New Year could change a finished year. `/firms/points` returned 500 on every request.

When I wrote the first end-to-end tests against the old code, 15 of 19 failed, each for one of the reasons above. That table of failures became the to-do list for the rebuild.

## How I started: the design doc

I wrote a design doc on 14 September 2026 and shared it with my lead. The goal in one line: retain FIRMS fire data and calculate reliable statistics for changing territories.

The key results I committed to:

1. `/firms/series?timeMode=year` returns yearly inside and buffered counts from 2019 to the current year.
2. `/firms/series?timeMode=7days` returns the last 7 UTC days.
3. `/firms/tiles/{z}/{x}/{y}.mvt` returns the detections for the selected scope and period.
4. None of those endpoints runs `ST_Contains`.
5. After a territory change, one recompute command rebuilds every count from stored detections, with no CSVs and no download.
6. Loading the same files twice changes nothing.

The API paths and response shapes stayed the same, so the frontend needed no change.

I split the work into three milestones:

1. **Tests only.** End-to-end tests with fake territories and mock CSVs, written against the target behaviour. They fail on the old code.
2. **Build.** Schema, collectors, recompute and API reads, until every test passes.
3. **Switch production.** Add the new tables beside the old ones, load them, deploy the API, and drop the old objects later once the new path has run for a while.

The review shaped the design in a few concrete ways:

- **Prove it before writing code.** My lead's biggest worry was size: storing every fire in the world could make the whole idea unworkable. The review asked me to load seven years of real CSVs into a side database first. I did that before writing any production code.
- **One detections table or two.** My lead asked whether a single partitioned table could hold both the archive and the 7-day data. I kept two tables because the two sources have different replacement scopes: a yearly load replaces a whole year, and a 7-day load replaces only the hours its file covers. Separate tables make it impossible for a rolling file to touch a finished year, and both collectors stay simple. My lead agreed and asked for that reason as a code comment beside both models, which is there.
- **Key groupings by `gid`.** My lead suggested using the grouping's integer id. I confirmed it is stable, because grouping refresh updates rows in place, and switched to it.
- **Tables or materialized views for the derived data.** Tables let the recompute replace results while the API keeps reading the previous ones, then switch in one transaction.

## Proving it at full scale

From 28 to 30 September I ran the design against real data on a second Azure PostgreSQL server.

- **Setup.** I restored a logical dump of production into the proof server, with production read-only the whole time. Both had 102 territories, 148 groupings at the time, and 1,508,233 rows in `fire_footprints`.
- **Input.** The real yearly archive for 2019 to 2025: 1,309 CSV files, 11 GB.
- **Yearly load.** 140,255,502 raw rows became 124,542,368 detections in 1 hour 29 minutes on Standard B4ms. 15,713,061 low-confidence rows were dropped and 73 repeated rows collapsed.
- **7-day load.** 367,737 detections in 17 seconds. Loading the same file again made zero writes.
- **Recompute.** A full rebuild of every count took 3 hours 7 minutes on Standard E4ds (4 vCPU, 32 GiB).
- **Storage.** The yearly partitions use 22.4 GB, about half heap and half indexes.

The proof changed the design in five places:

1. **Grouping geometry was the bottleneck.** The prototype matched fires to grouping shapes with a second spatial join, and that join took 2 hours 51 minutes, 91.5% of the recompute. I removed it. A grouping's matches now come from its member territories' matches, which is a join on integer ids. That also removed a planned column and a whole pull request. In production the grouping step now takes about 1.5 minutes.
2. **Duplicate detections with different confidence.** The 2023 archive has a detection listed twice in the same file, identical except one copy says nominal and the other says high. I took it to the domain owner, who decided it is one fire. The rule: drop low confidence first, then keep one row per detection, as high if either copy is high.
3. **Order of validation.** My first loader checked for conflicting duplicates before removing low-confidence rows, which rejected a 2019 file where one copy was low and the other nominal. Filtering low confidence first fixed it.
4. **Rolling replacement.** The first 7-day loader deleted the file's dates and reinserted them. Reloading the same file grew the table from 66 MB to 149 MB in dead rows. I changed it to reconcile: delete detections the file no longer lists, insert new ones, update changed confidence, and leave identical rows alone. An unchanged file now makes zero writes.
5. **Storage size.** After the yearly load, the 32 GB allocation was 90% full. I raised it to 64 GB, which left 34 GB free before the recompute.

The proof also showed the database tier matters. On B4ms the prototype recompute was cancelled after four hours. The rule in the docs now: scale to E4ds before a full load or recompute, and scale back afterwards.

## The design

### Data flow

```text
 Yearly CSVs (tmp/firms/YYYY/*.csv)        NASA 7-day CSV (HTTP)
            |                                      |
     COPY, replace one year              COPY, reconcile the file's time span
            v                                      v
  firms_detections_yearly                 firms_detections_7day
  (partitioned by year)                   (one table)
            \                                      /
             \--- firms_detections_for_recompute -/   (view)
                              |
                territory match: ST_Contains on the 10 km buffer,
                inside = ST_Contains on the territory polygon
                              |
              +---------------+----------------+
              v                                v
  firms_territory_detections      grouping match: member territories'
  firms_territory_counts          matches, one row per grouping and fire
                                               |
                                               v
                                  firms_groupings_detections
                                  firms_groupings_counts

  Charts read the two count tables. Map tiles read the two detection tables.
```

### The tables

**`firms_detections_yearly`** holds every nominal and high-confidence detection in the world from NASA's yearly archive.

- Columns: `acq_date`, `acq_time`, `latitude`, `longitude`, `satellite`, `confidence` (`n` or `h`), and `geometry` as a PostGIS Point in SRID 4326.
- Primary key: `(acq_date, acq_time, latitude, longitude, satellite)`. That is the detection's natural identity. NASA has no detection id, and these five values identify one detection from one satellite pass.
- Range-partitioned by `acq_date`, one partition per year. The loader creates a year's partition on its first load, so no year is hard-coded anywhere. Replacing a year is a `TRUNCATE` of one partition.
- A GiST index on `geometry` for the spatial join.
- A check constraint keeps confidence to `n` or `h`.

Detections are stored worldwide. That is the design choice that makes territory changes cheap: a new or redrawn territory gets its full history from the database with no download.

**`firms_detections_7day`** holds detections from the rolling 7-day downloads. It has the same columns and primary key, without partitions. Each download reconciles only the time span its file covers, so overlapping daily downloads keep one copy of each day.

**`firms_detections_for_recompute`** is a view, the single input to the recompute. It returns every yearly row, plus 7-day rows for years the archive does not have yet. In practice that is the current year until NASA publishes its archive. The year check is a date range built with `make_date`, so the yearly primary key index answers it. Once a year's archive loads, its 7-day rows drop out of the counts automatically.

**`firms_territory_detections`** stores one row per detection per territory whose buffer contains it, with an `inside` boolean. The primary key is the territory id plus the five detection columns, and it has a GiST index on `geometry`. The map tiles read this table.

**`firms_groupings_detections`** is the same for groupings, keyed by `grouping_id`, which references `territories_groupings(gid)`. A detection appears once per grouping, inside if any member territory contains it.

**`firms_territory_counts`** holds the chart values: `territory_id`, `resolution` (`day` or `year`), `period_start`, `inside_count`, `buffered_count`. The primary key is `(territory_id, resolution, period_start)`, so a chart is one index range scan. Check constraints enforce non-negative counts, buffered at least inside, and a year period starting on 1 January.

**`firms_groupings_counts`** is the same, keyed by `grouping_id`.

All four derived tables reference their territory or grouping with `ON DELETE CASCADE`. Deleting a territory removes its fire results and is never blocked by them.

### Decisions and the reasons behind them

- **Two source tables.** Different replacement scopes, so a 7-day load can never change an archived year.
- **Separate territory and grouping tables.** Each table has one non-null foreign key and a natural primary key. A combined table would need nullable keys or a generic key the database cannot check.
- **Derived results as plain tables.** The recompute can replace them inside one transaction while the API keeps reading the old rows.
- **Counts for every period, zero-filled.** The recompute writes a row for every territory and grouping for every loaded year and each of the last seven days, with zeros where nothing matched. A missing row then means the period was never processed, and a quiet year shows a 0 bar.
- **A year counts as loaded when it has rows.** An early design had a `firms_finalized_years` table to mark a year with zero fires as loaded. My lead pointed out that zero fires worldwide in a year means something went wrong. So the loader rejects a year with no accepted detections, and the table was never built.
- **No database lock.** Collectors run by hand from a checklist, one at a time. The docs say FIRMS commands must not overlap. A lock is listed as a follow-up.
- **No new column on groupings.** Grouping matches come from the territory matches, which keeps `territories_groupings` unchanged and removed the slowest step.
- **Foreign key names match TypeORM's derived names,** so TypeORM's schema diff reports no drift.

### The spatial rules

1. **Inside:** the territory polygon contains the point (`ST_Contains`).
2. **Buffered:** the 10 km buffer contains the point. Buffered includes inside.
3. **Boundaries:** a point exactly on a polygon's edge is buffer-only, because `ST_Contains` excludes the boundary.
4. **Groupings:** a fire counts once per grouping, inside if any member territory contains it. Member counts are never added together, so overlapping buffers never double count.

## The three commands

```text
yarn collect --module=indicators firms load-yearly [--append=<year>]
yarn collect --module=indicators firms load-7day
yarn collect --module=indicators firms recompute
```

### `load-yearly`

Loads every year folder under `tmp/firms/`, or one year with `--append=<year>`, then runs a full recompute. For each year:

1. **Create the year's partition** if it does not exist. This runs before the year's transaction, because creating a partition locks the whole parent table.
2. **Begin a transaction.**
3. **Check every file's header.** `COPY` maps columns by position, so a file with reordered columns would load wrong values without any error. The header must match exactly.
4. **Stage the files** with `COPY` into a temporary text-only table that drops at commit.
5. **Validate every row** in SQL: date format and validity, time as four HHMM digits, latitude and longitude in range, satellite present, confidence one of the three known values. It uses `pg_input_is_valid` (PostgreSQL 16 and later) so a bad value is counted and reported, and never crashes a cast. Rows outside the folder's year are rejected.
6. **Replace the partition:** `TRUNCATE` it, then insert the accepted detections. The insert drops low confidence, groups by the five key columns, and sets confidence to high when any copy is high. A year with zero accepted detections fails.
7. **Commit.**

Any failure rolls back that year, and its previous detections stay exactly as they were.

### `load-7day`

1. Download NASA's 7-day CSV to the system temp folder.
2. In one transaction: stage and validate with the same shared rules (`FirmsStaging.ts`), then build the file's accepted detections in a temporary table.
3. **Find the file's span,** from its first detection time to its last. NASA's file is a rolling window, so its first and last dates are partial days. Reconciling whole dates would delete detections that came from yesterday's download.
4. **Guard the span.** A file covering more than eight UTC dates is rejected. One mistyped date would otherwise wipe every stored day between it and the rest of the file.
5. **Reconcile:** delete stored detections in the span that the file no longer lists, update changed confidence, and insert new detections with `ON CONFLICT DO NOTHING`. The delete skips the span's oldest minute, because NASA ages detections out of its window and two satellite passes can share a minute. Identical rows are left alone, so reloading the same file writes nothing.
6. **Commit,** then recompute only the years the file covers: one year, or two across New Year, plus the seven daily bars.

It never writes the yearly table.

### `recompute`

Rebuilds every match and count from `firms_detections_for_recompute`. Operators run it after any territory change. It reads no CSVs and downloads nothing.

1. **Open one transaction at `REPEATABLE READ`.** Every statement then sees the same snapshot of detections and territories, so a year that finishes loading mid-run cannot end up in the matches but missing from the counts.
2. **Delete the previous results** for the years being rebuilt. I use `DELETE` here and avoid `TRUNCATE`, because `TRUNCATE` takes an exclusive lock that would block every API request until commit. With `DELETE` the API keeps reading the previous results the whole time.
3. **Find the loaded years.** `SELECT DISTINCT` on the year would read 125 million rows. The query takes the first and last year, then runs one `EXISTS` per year in between, each answered by the primary key index.
4. **Match territories:** one spatial join, `territories JOIN detections ON ST_Contains(buffered_geometry, point)`, with `inside = ST_Contains(geometry, point)`.
5. **Match groupings** from the territory matches. Each territory maps to its groupings by the same tag rules grouping refresh uses. `DISTINCT ON (grouping, detection)` keeps one row per fire, sorted so the inside row wins.
6. **Write the counts:** a `CROSS JOIN` of every territory or grouping with every period, `LEFT JOIN` to the grouped matches, `COALESCE` to zero.
7. **Commit.** The API switches to the new results in one step. Any failure rolls back and the previous results stay.

The run date for the seven-day window comes from Node's clock, so tests can set it. Each step logs its duration, which is how I know where the time goes.

## The API

**`/firms/series`** reads one territory's or one grouping's counts by primary key. `fireCount` is `inside_count`, `fireBuffer` is `buffered_count`, and `total` sums the inside counts. Dates come back as `YYYY-MM-DD`, which removed the old two-day shift. A non-numeric territory id now returns 400. Everything else behaves as before, including unknown scopes and the default time mode.

**`/firms/tiles/{z}/{x}/{y}`** builds a Mapbox vector tile with `ST_AsMVT` from the detection tables. It clips to the tile with `ST_Intersects` on the GiST index and filters by scope, inside, and period. Each feature carries `inside` as 1 or 0 for the frontend's colours. The 7-day map uses exactly the days the chart shows. Below zoom 4 it returns 204, because one tile would span a large part of the world. Grouping maps now show each fire once. Tiles are cached in Redis for an hour.

## Tests first

I wrote the tests before any production code, as their own pull request.

- **End to end.** Each test does what an operator does: insert territories, run the real grouping refresh, stage CSVs in `tmp/firms/<year>/`, run the real collector, then call the HTTP API the way the frontend does and check the exact response. Tile tests decode the vector tile the way the frontend does.
- **Only three things are faked:** NASA's 7-day download, the clock, and the Google sign-in that grouping refresh never uses. The collectors, the database and the API are all real.
- **A database per test.** Each test touches three connections: the test's client, the collector's `pg` client, and the app's TypeORM pool. They cannot share one transaction, and the tests need to check the collectors' own commits and rollbacks. So each test copies a migrated template database, which takes under a second.
- **Fixtures.** Two fake territories, "Test Territory 130" and "Test Territory 131", with overlapping buffers, and seven fire positions placed at known spots: inside one, inside the other, in both buffers, on a boundary, outside everything.

The files map to the behaviour:

- `yearlyUpdate`: exact yearly counts, reloading a year changes nothing, files A, B, C replaced by A, C, D, a new year loads with no code change.
- `rollingUpdate`: reloading the same 7-day file changes nothing, overlapping files keep one copy of each day, the window moves with the clock, a New Year file cannot change the archived year.
- `territoryChanges`: a territory added later gets its history from stored detections, moving a territory moves fires between inside, buffer and outside, recomputing twice changes nothing.
- `spatialMeaning`: overlapping buffers counted once per grouping, boundaries are buffer-only, low confidence never stored, a detection listed twice counts once.
- `failures`: bad dates, coordinates, out-of-year rows, empty folders and empty years are rejected and the live data is unchanged, and a failed recompute leaves every result readable.
- `firmsApi`: the exact series format and the API edge cases.

On the old code, 4 of 19 tests passed. Each later pull request reported a before and after for every test. The suite grew to 25 tests as later fixes added cases, and all of them pass.

## How it shipped

Milestone 2 went out as a stack of small pull requests, each reviewed and merged before the next:

| PR | What it did | Merged |
| --- | --- | --- |
| #170 | End-to-end tests and fixtures | 13 Oct |
| #174 | Schema, models, and the yearly loader | 13 Oct |
| #178 | `firms recompute`, run at the end of `load-yearly` | 15 Oct |
| #179 | `/firms/series` reads the count tables | 15 Oct |
| #181 | `/firms/tiles` reads the detection tables | 15 Oct |
| #182 | `firms load-7day` and the shared staging code | 15 Oct |
| #184 | README, data-flow diagram, add-territory checklist, API docs | 15 Oct |

A grouping-geometry pull request (#176) was closed once the proof showed grouping matches could come from territory matches.

My working rules: every pull request under about 500 lines, an independent code review before every push, comments that explain the reason behind a choice, and every claim in a description backed by a test or a measurement.

## Production rollout

**15 October.** I confirmed a recent automated backup and ran the schema migration in production. It only added empty tables beside the old ones, so the live dashboard was unaffected.

**16 October.** I scaled the database to E4ds with 64 GB of storage and ran the loads on the collector VM inside `tmux`.

- `load-yearly` for 2019 to 2025: 85.6 minutes. About 62 minutes to load 124.5 million detections, and 23.7 minutes to recompute, 22.4 of them matching territories.
- `load-7day`: 25.6 minutes, 1.4 of them downloading and loading 302,596 detections.
- **Repeat check.** I fingerprinted every yearly count with an `md5` over the ordered rows, reloaded 2023 with `--append=2023`, and fingerprinted again. Identical.
- **Spot check.** For three territories I counted 2024 fires straight from the raw detections with `ST_Contains`. All three matched their stored rows exactly.
- **End-to-end check before deploying.** I ran the real backend and frontend locally against production with a read-only connection, and checked the charts and map.
- **Storage.** Usage peaked at 40.5 GB during the load and settled near 29 GB. A 32 GB server would have gone read-only.

**Explaining the drop.** The new numbers were about a third of the old ones. I proved that was a correction: deduplicating the old `fire_footprints` table and removing low confidence reproduced the new yearly counts. I gave my lead two read-only queries to run directly to see the duplicates.

**20 October.** I loaded the latest 7-day file, then deployed the new API. Loading first meant the new charts went live with fresh data.

## After launch

**Making the daily update cheap.** The plan was a daily job for the 7-day file on the smallest tier, B1ms. My lead's concern was that every `load-7day` ran the full 24-minute recompute, and scaling the database up every day was unrealistic. I measured the part a daily run needs: matching the 7-day detections to territories took 0.8 seconds. A 7-day file can only change the year it covers, since older years come from NASA's archive and never change. So I made the recompute take an optional list of years. `load-7day` passes the years its file covers. In production on B1ms the daily load now takes 2 minutes 6 seconds, about 30 seconds to download and load and 96 seconds to recompute the current year and the seven days. Tests check that the partial rebuild gives the same charts and tiles as a full one.

**The partial day.** My lead noticed today's bar looked complete. NASA's dates are UTC, the file is rebuilt hourly, and detections arrive about three hours after a satellite pass, so the newest day is always partial. Scheduling the daily job late in the UTC day captures every afternoon satellite pass over the territories, which is when most fires are detected.

**The scheduled job.** The daily run is an Azure Container Apps job using the backend image. Its first run failed with `ENOENT` because the image has no `tmp/` folder. The fix (#198) downloads to the system temp folder, and a new test deletes `tmp/` before a load. I also fixed `download()`, which crashed the process on a network error (#185).

**A frontend bug found along the way.** While testing a map layer, I found the fire chart refetching about three times a second forever: 32 requests in 10 seconds from one idle tab. An effect listed a callback prop as a dependency, the parent passed a new function on every render, and calling it re-rendered the parent. Every refetch also re-added every map layer, so raster layers never stayed long enough to draw. Removing the dependency fixed both.

**Cleanup.** On 29 October, two weeks after launch, I dropped the old objects (#200). The migration removes `fire_footprints` (365 MB), both materialized views, and their metadata rows. Its `down` recreates them empty for a rollback. The same pull request removed the unused `/firms/points` endpoint, the old entities and repository, and the seed rows. I ran it in production and checked that FIRMS v2 was intact afterwards. The proof server was deleted.

## Numbers to remember

| What | Number |
| --- | --- |
| Raw rows in the 2019 to 2025 archive | 140.3 million |
| Detections stored after filtering | 124.5 million |
| Low-confidence rows dropped | 15.7 million |
| Territories and groupings | 102 and 150 |
| Territory matches in production | about 561,000 |
| Grouping matches in production | about 3.77 million |
| Old over-count | about 3x (2.5 to 2.8 rows per fire) |
| Yearly partitions on disk | about 22 to 23 GB, plus about 3.3 GB per new year |
| Peak storage during the load | 40.5 GB of 64 GB |
| Prototype recompute | 3 h 7 min, 2 h 51 min of it the grouping join |
| Production full recompute | 24 min on E4ds, grouping step about 1.5 min |
| Daily `load-7day` | 2 min 6 s on B1ms |
| Full yearly load in production | 85.6 min |
| Tests | 19 at the start, 4 passing on the old code; 25 now, all passing |
| Timeline | design doc 14 Sep, proof 28 to 30 Sep, launch 20 Oct, cleanup 29 Oct |

## Trade-offs and what I would do next

- **No lock.** FIRMS commands rely on a documented rule that they never overlap. A PostgreSQL advisory lock is the next step once more jobs are scheduled.
- **Grouping rules exist in two places.** The recompute copies the tag rules from grouping refresh. A shared function would keep them in step.
- **Territory matching dominates the full recompute.** 22 of the 24 minutes are the territory join. When one territory changes, only that territory needs re-matching, so an incremental path would make territory updates take seconds.
- **The current day is partial.** The job timing handles it. Ending the chart at the last full UTC day is a small change if users want it.
- **Storage grows about 3.3 GB per year.** 64 GB covers years of growth. Older years could move to cheaper storage if that ever matters.

## Questions I expect, with answers

**Why store every fire in the world?**
Territories change. A new territory, or a redrawn boundary, needs its full fire history. With worldwide storage that is one recompute from the database. The proof measured the cost first: 22 GB for seven years.

**How do you guarantee idempotency?**
Natural primary keys, and every load replaces a defined scope inside one transaction. A yearly load replaces one partition. A 7-day load reconciles one time span and leaves identical rows untouched. The recompute deletes and rewrites its results in one transaction. I proved it in production by reloading 2023 and comparing an `md5` fingerprint of every count.

**What happens if a load fails halfway?**
Each year loads in its own transaction, so a failed year keeps its previous detections. Years that loaded before it stay loaded. The recompute does not run, and the operator fixes the files and reruns that year with `--append`. If only the recompute fails, the operator runs `firms recompute`.

**Why does the recompute use `DELETE`?**
`TRUNCATE` takes an `ACCESS EXCLUSIVE` lock held until commit, which would block every chart request for the whole recompute. `DELETE` lets readers see the old rows under MVCC until the new ones commit. The cost is dead rows for autovacuum and more WAL, which is fine at this size.

**Why `REPEATABLE READ`?**
Under the default `READ COMMITTED`, each statement sees whatever has been committed by then. The recompute runs several statements in sequence, and a load finishing in the middle could make the matches and the counts disagree. `REPEATABLE READ` pins one snapshot for the whole transaction.

**How did you make the recompute 8 times faster?**
I measured each phase in the prototype. The grouping spatial join was 91.5% of the time. Grouping matches can be derived from territory matches by tag membership, which is an integer join. That turned 2 hours 51 minutes into about 1.5 minutes.

**How do you know the new numbers are right, given they dropped by two thirds?**
Three ways. Exact tests on fixtures with known answers. Spot checks in production against raw `ST_Contains` counts. And the strongest: deduplicating the old table and removing low confidence reproduced the new yearly numbers. The drop was the over-count disappearing.

**Why partition by year?**
Replacing a year becomes `TRUNCATE` of one partition, which is instant and leaves no dead rows. A year's load only touches its own partition. Range checks on `acq_date` prune to the right partition.

**Why validate in SQL after `COPY`?**
`COPY` into a text staging table is the fastest way to get 140 million rows into PostgreSQL. Validating there in one pass with `pg_input_is_valid` reports every problem with counts, and a bad file never reaches the live table.

**What was the hardest part?**
Getting the 7-day reconcile right. NASA's file is a rolling window with partial first and last days, detections age out of it, and confidence can change between downloads. Reconciling by detection time with a guard on the span, and leaving identical rows alone, is what made overlapping daily downloads give one correct copy of each day.

**How did you work with review?**
I proved the design before writing code, wrote the tests as the contract, and shipped small pull requests with a before and after for every test. When my lead questioned a choice, I answered with a measurement. The recompute timing comment, for example, cites the measured 2 hours 51 minutes and the production 24 minutes.
