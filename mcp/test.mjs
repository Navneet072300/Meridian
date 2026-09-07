import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { unzipSync } from 'fflate';

test('real MCP handshake, workspace boundary, secret rejection and ZIP upload', async () => {
 const workspace=await mkdtemp(join(tmpdir(),'meridian-mcp-test-'));
 let uploaded=false;
 const http=createServer(async(req,res)=>{assert.equal(req.headers.authorization,'Bearer mrd_launch_test');const chunks=[];for await(const c of req)chunks.push(c);if(req.url.endsWith('/sources')){const files=unzipSync(Buffer.concat(chunks));assert.equal(Buffer.from(files['index.html']).toString(),'<h1>Hello</h1>');uploaded=true;}res.setHeader('content-type','application/json');res.end(JSON.stringify({projects:[],revision_id:'saved'}));});
 await new Promise(resolve=>http.listen(0,'127.0.0.1',resolve));
 const transport=new StdioClientTransport({command:process.execPath,args:[fileURLToPath(new URL('./server.mjs',import.meta.url))],env:{...process.env,MERIDIAN_URL:`http://127.0.0.1:${http.address().port}`,MERIDIAN_AGENT_KEY:'mrd_launch_test',MERIDIAN_WORKSPACE:workspace}});
 const client=new Client({name:'test',version:'1.0.0'});
 try{
  await client.connect(transport);
  const {tools}=await client.listTools();assert.equal(tools.length,7);assert.ok(!tools.some(t=>t.name.includes('production')));
  const id='10000000-0000-4000-8000-000000000001';
  const outside=await client.callTool({name:'meridian_upload_project',arguments:{project_id:id,folder:'..'}});assert.equal(outside.isError,true);
  await writeFile(join(workspace,'.env'),'SECRET=do-not-upload');
  const secret=await client.callTool({name:'meridian_upload_project',arguments:{project_id:id,folder:'.'}});assert.equal(secret.isError,true);assert.equal(uploaded,false);
  await rm(join(workspace,'.env'));await writeFile(join(workspace,'index.html'),'<h1>Hello</h1>');
  const result=await client.callTool({name:'meridian_upload_project',arguments:{project_id:id,folder:'.'}});assert.ok(!result.isError);assert.equal(uploaded,true);
 }finally{await client.close();await new Promise(resolve=>http.close(resolve));await rm(workspace,{recursive:true,force:true});}
});
