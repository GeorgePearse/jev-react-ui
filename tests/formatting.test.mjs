import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyDocument, MAX_FORMAT_LENGTH } from '../src/formatting.ts';

test('preserves source and joins source-code blocks without dropping blank lines', async () => {
  const document = 'Invoice check\n\nfrom datetime import date\n\ndef overdue(items):\n    return items\n\nReview accounts\nSend reminders';
  const roles = ['heading', 'code', 'code', 'list']; let index = 0;
  const runtime = { decide: async (text, questions) => questions.format_language ? {format_language:{type:'choice',choice:'python',confidence:1}} : {format_role:{type:'choice',choice:roles[index++],confidence:1}} };
  const result = await classifyDocument(runtime,document);
  assert.deepEqual(result.map(b=>b.kind),['title','python','list']);
  assert.equal(result.map(b=>b.text).join('\n\n'), document);
});

test('rejects unknown model labels rather than rendering an invented role', async () => {
  await assert.rejects(classifyDocument({decide:async()=>({format_role:{type:'choice',choice:'<script>'}})},'Hello'), /invalid document role/);
});

test('enforces size limits before invoking inference',async()=>{
  let calls=0; const runtime={decide:async()=>{calls++;return {};}};
  await assert.rejects(classifyDocument(runtime,'x'.repeat(MAX_FORMAT_LENGTH+1)),/Use up to/);
  await assert.rejects(classifyDocument(runtime,Array(17).fill('text').join('\n\n')),/Use up to/);
  assert.equal(calls,0);
  assert.deepEqual(await classifyDocument(runtime,''),[]);
});
