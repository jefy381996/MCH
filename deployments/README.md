# Deployments

`npm run chain:deploy` writes one file per network here, e.g. `preprod.json`.
They hold public information only (script hashes, addresses, transaction ids),
so they are committed: anyone can verify the deployment against the source.

Signing keys never go here. They live in `secrets/` (git-ignored) or in
environment variables.
