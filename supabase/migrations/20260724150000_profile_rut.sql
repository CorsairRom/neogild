-- RUT del titular: contraseña de cartolas BancoEstado = últimos 4 dígitos del cuerpo (sin DV)

alter table profiles add column if not exists rut text;

comment on column profiles.rut is
  'RUT chileno normalizado (ej. 12345678-9). Usado para abrir PDFs de cartola encriptados.';
