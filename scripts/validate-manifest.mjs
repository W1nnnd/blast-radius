// Offline check of manifest.yml against the JSON schema shipped in @forge/manifest (no login needed).
import fs from 'fs'; import Ajv from 'ajv'; import addFormats from 'ajv-formats';
import YAML from 'yaml';
const schema=JSON.parse(fs.readFileSync('node_modules/@forge/manifest/out/schema/manifest-schema.json','utf8'));
const ajv=new Ajv({strict:false,allErrors:true}); addFormats(ajv);
const v=ajv.compile(schema); const m=YAML.parse(fs.readFileSync('manifest.yml','utf8'));
console.log(v(m)?'MANIFEST SCHEMA VALID':JSON.stringify(v.errors.slice(0,10),null,1));
