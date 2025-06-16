CREATE POLICY \
Enable
select
for
service
role\ ON public.users AS PERMISSIVE FOR SELECT TO service_role USING (true);

CREATE POLICY \Enable
update
for
service
role\ ON public.users AS PERMISSIVE FOR UPDATE TO service_role USING (true);

CREATE POLICY \Enable
delete
for
service
role\ ON public.users AS PERMISSIVE FOR DELETE TO service_role USING (true);
