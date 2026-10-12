# SANAD order receiver

`Code.gs` is a drop-in update for the Apps Script web app behind the existing
order endpoint. It keeps the live Google Sheet at its current 13 columns.

- The Vercel endpoint appends advertising attribution to the existing `Notes`
  value; the script stores that value without overwriting it.
- `LockService.getScriptLock()` makes the Order ID lookup and row append atomic
  across concurrent executions and serverless instances.
- The stable Order ID is the persistent idempotency key in the existing sheet.
- A readback check confirms the complete Notes value was stored before success.

After replacing the existing script, create a new version of the existing web
app deployment with the same execute-as and access settings. A safe GET of the
existing `/exec` URL must then return `"ready":true`,
`"persistentIdempotency":"script-lock+order-id"`, and
`"attributionStoredIn":"Notes"`. No Sheet columns or setup function are needed.
