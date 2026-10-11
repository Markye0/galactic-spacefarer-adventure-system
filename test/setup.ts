// CAP only looks for .ts service implementations when this is set. `cds watch` sets it itself;
// the Node.js test runner needs it set explicitly.
process.env.CDS_TYPESCRIPT = 'tsx'

// The UI5 tooling plugin serves the Fiori app in `cds watch`. API tests do not need it, and it
// keeps the test process from exiting.
process.env.CDS_PLUGIN_UI5_ACTIVE = 'false'
