# Change Log
All notable changes to this project will be documented in this file.
Updates should follow the [Keep a CHANGELOG](https://keepachangelog.com/) principles.

## [2.0.1] - Unreleased

- Finalize the new repository metadata and centered, bounded README branding.
- Prepare the first npm 2.x publication from this exact source; preserve the existing `v2.0.0` Git tag.
- Includes the 2.0.0 API and lifecycle changes listed below.

## [2.0.0] - Git tag only; not published to npm

### Changed

- Declare native ESM packaging; use `import` or dynamic `import()` from CommonJS.
- Encode tokens in connection URLs; pass original tokens, not pre-encoded tokens.
- Ignore sends before the socket opens; report malformed incoming messages to `onError`.
- Refresh repository links and canonical Socket Conveyor branding.

### Fixed

- Stop heartbeat timers on disconnect, deduplicate reconnect timers, and ignore stale close events.
- Remove connection URL logging that exposed authentication tokens.

### Added

- `close(code, reason)` to stop the connection, heartbeat and reconnect timers.
- Dependency-free Node tests, coverage thresholds and Node 22/24/26 CI with pinned actions.
- Explicit npm package allowlist, license file and documented manual release procedure.

No runtime or development dependencies existed to upgrade; none were added.

## [1.2.1] - 2023-03-21

### Fixed

- Fixed reconnection functionality. The previous package had some constraints to browsers.

### Added

- Callback for closing connections events.

## [1.2.0] - 2022-09-24

### Added

- Adjusted Client to the latest version of Socket Conveyor - changed the listen command.
