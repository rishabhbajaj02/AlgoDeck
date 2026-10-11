import {spawnSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {loadEnvFile} from 'node:process';
import {createClient} from '@supabase/supabase-js';

const command=process.argv[2];
if(command==='migrate'){
  const local=process.argv.includes('--local');
  const result=spawnSync(process.platform==='win32'?'npx.cmd':'npx',['supabase','db','push',local?'--local':'--linked'],{stdio:'inherit',shell:process.platform==='win32'});
  process.exit(result.status??1);
}
if(command!=='seed'){process.stderr.write('Usage: node scripts/database.mjs migrate [--local] | seed\n');process.exit(1);}
try{loadEnvFile('backend/.env');}catch{/* Environment variables may be supplied by the terminal. */}
const {SUPABASE_URL,SUPABASE_PUBLIC_KEY,SEED_EMAIL,SEED_PASSWORD}=process.env;
if(!SUPABASE_URL||!SUPABASE_PUBLIC_KEY||!SEED_EMAIL||!SEED_PASSWORD){process.stderr.write('Set SUPABASE_URL, SUPABASE_PUBLIC_KEY, SEED_EMAIL and SEED_PASSWORD for a development account. See docs/setup.md.\n');process.exit(1);}
const db=createClient(SUPABASE_URL,SUPABASE_PUBLIC_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
try{
  const {data:auth,error}=await db.auth.signInWithPassword({email:SEED_EMAIL,password:SEED_PASSWORD});
  if(error||!auth.user)throw new Error('Development account sign-in failed.');
  const sample=JSON.parse(readFileSync(new URL('../examples/language-learning.json',import.meta.url),'utf8'));
  const {data:existing,error:lookupError}=await db.from('collections').select('id').eq('name','Language foundations').limit(1);
  if(lookupError)throw new Error('Cannot read collections. Apply the migration first.');
  let id=existing?.[0]?.id;
  if(!id){const {data,error:createError}=await db.from('collections').insert({name:'Language foundations',description:'A small multilingual starter collection.',user_id:auth.user.id,daily_target:5,new_question_limit:5}).select('id').single();if(createError)throw new Error('Cannot create seed collection.');id=data.id;}
  const {data,error:importError}=await db.rpc('import_questions',{p_collection:id,p_rows:sample.questions,p_request_id:'development-seed'});
  if(importError)throw new Error('Seed import failed. Confirm the migration and account permissions.');
  process.stdout.write(`Seed complete: ${data.inserted} inserted, ${data.duplicates} duplicates skipped.\n`);
  await db.auth.signOut();
}catch(error){process.stderr.write(`${error instanceof Error?error.message:'Seed failed.'}\n`);process.exitCode=1;}
