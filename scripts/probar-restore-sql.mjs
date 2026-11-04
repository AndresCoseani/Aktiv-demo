// PostgreSQL embebido: comprobar que el drill detecta FKs rotas sin eliminar claves.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
const { PGlite } = await import(pathToFileURL(process.env.PGLITE_MODULE).href);
const db = new PGlite();
try {
  const sql = await readFile(new URL("./restore_fks.sql", import.meta.url), "utf8");
  await db.exec("create schema auth; create table auth.users(id int primary key); create table public.profiles(id int primary key references auth.users(id)); insert into auth.users values(1); insert into profiles values(1);");
  await db.exec(sql);
  await db.exec("create table public.datos(id int,usuario int); insert into datos values(1,99); alter table datos add constraint referencia foreign key(usuario) references profiles(id) not valid;");
  await assert.rejects(db.exec(sql), /Relaciones incompletas/);
  await db.exec("delete from datos; insert into datos values(2,null);");
  await db.exec(sql);
  console.log("OK: restore conserva y verifica relaciones con Auth, detecta huérfanos y admite claves opcionales nulas.");
} finally { await db.close(); }
