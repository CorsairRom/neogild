-- Cartola emails: stage with pending_attachment + store PDF path (F4 prep)

alter table email_movements drop constraint if exists email_movements_status_check;
alter table email_movements add constraint email_movements_status_check
  check (status in ('pending', 'promoted', 'discarded', 'error', 'pending_attachment'));

alter table email_movements add column if not exists attachment_path text;

insert into storage.buckets (id, name, public)
values ('email-attachments', 'email-attachments', false)
on conflict (id) do nothing;

create policy "Users read own email attachments" on storage.objects
  for select using (
    bucket_id = 'email-attachments'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "Service role upload email attachments" on storage.objects
  for insert with check (bucket_id = 'email-attachments');

create policy "Service role update email attachments" on storage.objects
  for update using (bucket_id = 'email-attachments');
