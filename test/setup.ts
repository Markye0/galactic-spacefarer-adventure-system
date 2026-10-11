// CAP only looks for .ts service implementations when this is set. `cds watch` sets it itself;
// the Node.js test runner needs it set explicitly.
process.env.CDS_TYPESCRIPT = 'tsx'
