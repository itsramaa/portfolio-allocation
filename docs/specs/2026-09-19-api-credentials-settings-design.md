# API Credentials in Settings

## Goal

Allow users to configure Binance API credentials from Settings while keeping the API key and secret out of the form after submission. Existing credentials must be replaceable by submitting a new key and secret.

## Design

- The Settings form uses the dedicated `/api/credentials` endpoint rather than the generic settings endpoint.
- The server validates the submitted credentials with Binance, encrypts the credential payload with AES-256-GCM, and upserts the encrypted value into SQLite.
- The credentials status endpoint returns only configuration state, source, and a masked API key. It never returns the API secret or decryptable credential payload.
- After a successful save, the frontend clears both input fields and shows a configured status.
- A subsequent save with non-empty fields replaces the previous database credential record.
- Disconnect deletes database credentials and refreshes the status. Environment credentials remain available as a server-side fallback.
- Legacy plaintext credential values remain readable by the backend for compatibility, but newly saved credentials use encrypted storage.

## Error handling

- Empty values are rejected client-side and server-side.
- Binance validation failures are shown in the Settings form and do not overwrite the stored credential.
- Save failures keep the entered values available for correction, while successful saves clear them.
- The frontend credential cache stores only configuration state for this flow and never stores the secret after the save completes.

## Verification

- Add backend tests for encrypted credential persistence, update behavior, and masked status responses where the existing Go test setup permits.
- Run the frontend TypeScript build and lint checks.
- Run the Go test suite and build the server.
