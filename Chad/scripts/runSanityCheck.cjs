const fs = require('fs');
const path = require('path');
const ts = require('typescript');
const Module = require('module');

Module._extensions['.ts'] = function (module, filename) {
  const source = fs.readFileSync(filename, 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
    },
    fileName: filename,
  }).outputText;
  module._compile(output, filename);
};

const resolveFilename = Module._resolveFilename;
Module._resolveFilename = function (request, parent, isMain, options) {
  if (typeof request === 'string' && request.startsWith('.')) {
    const base = path.resolve(path.dirname(parent.filename), request);
    if (fs.existsSync(`${base}.ts`)) return `${base}.ts`;
  }
  return resolveFilename.call(this, request, parent, isMain, options);
};

require(path.join(__dirname, 'sanityCheck.ts'));
