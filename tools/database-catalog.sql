-- Read-only application metadata. Excludes member rows, object paths, tokens and job commands.
with catalog as (
select jsonb_build_object(
'tables', (select jsonb_agg(jsonb_build_object('name',c.relname,'owner',pg_get_userbyid(c.relowner),'rls',c.relrowsecurity,'force_rls',c.relforcerowsecurity,'replica_identity',c.relreplident,'options',c.reloptions,'acl',c.relacl::text,
'columns',(select jsonb_agg(jsonb_build_object('name',a.attname,'type',format_type(a.atttypid,a.atttypmod),'not_null',a.attnotnull,'default',pg_get_expr(d.adbin,d.adrelid),'identity',a.attidentity,'generated',a.attgenerated,'acl',a.attacl::text) order by a.attnum) from pg_attribute a left join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum where a.attrelid=c.oid and a.attnum>0 and not a.attisdropped))
order by c.relname) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind in ('r','p')),
'constraints',(select jsonb_agg(jsonb_build_object('table',c.conrelid::regclass::text,'name',c.conname,'definition',pg_get_constraintdef(c.oid),'validated',c.convalidated) order by c.conrelid::regclass::text,c.conname) from pg_constraint c join pg_namespace n on n.oid=c.connamespace where n.nspname='public' and c.conrelid<>0),
'indexes',(select jsonb_agg(jsonb_build_object('name',c.relname,'definition',pg_get_indexdef(c.oid),'valid',i.indisvalid) order by c.relname) from pg_index i join pg_class c on c.oid=i.indexrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public'),
'functions',(select jsonb_agg(jsonb_build_object('name',p.proname,'arguments',pg_get_function_identity_arguments(p.oid),'owner',pg_get_userbyid(p.proowner),'definition',pg_get_functiondef(p.oid),'acl',p.proacl::text) order by p.proname,pg_get_function_identity_arguments(p.oid)) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prokind='f' and not exists(select 1 from pg_depend d where d.classid='pg_proc'::regclass and d.objid=p.oid and d.deptype='e')),
'triggers',(select jsonb_agg(jsonb_build_object('table',c.oid::regclass::text,'name',t.tgname,'definition',pg_get_triggerdef(t.oid),'enabled',t.tgenabled) order by c.oid::regclass::text,t.tgname) from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace join pg_proc p on p.oid=t.tgfoid join pg_namespace fn on fn.oid=p.pronamespace where not t.tgisinternal and (n.nspname='public' or fn.nspname='public')),
'policies',(select jsonb_agg(to_jsonb(p) order by p.schemaname,p.tablename,p.policyname) from pg_policies p where p.schemaname='public' or p.schemaname='storage' and p.tablename='objects'),
'schema_acl',(select n.nspacl::text from pg_namespace n where n.nspname='public'),
'default_acl',(select jsonb_agg(jsonb_build_object('owner',pg_get_userbyid(d.defaclrole),'kind',d.defaclobjtype,'acl',d.defaclacl::text) order by pg_get_userbyid(d.defaclrole),d.defaclobjtype) from pg_default_acl d join pg_namespace n on n.oid=d.defaclnamespace where n.nspname='public'),
'extensions',(select jsonb_agg(jsonb_build_object('name',e.extname,'schema',n.nspname,'version',e.extversion) order by e.extname) from pg_extension e join pg_namespace n on n.oid=e.extnamespace),
'publications',(select jsonb_agg(to_jsonb(p) order by p.pubname,p.tablename) from pg_publication_tables p where p.schemaname='public'),
'buckets',(select jsonb_agg(jsonb_build_object('id',b.id,'name',b.name,'public',b.public,'file_size_limit',b.file_size_limit,'allowed_mime_types',b.allowed_mime_types) order by b.id) from storage.buckets b where b.id in ('gallery-media','gallery-athletics','profile-pictures'))
) as snapshot
)
select snapshot, md5(snapshot::text) as fingerprint from catalog;
