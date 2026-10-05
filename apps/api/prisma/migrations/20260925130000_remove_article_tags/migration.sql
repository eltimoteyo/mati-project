-- Las etiquetas de los articulos se han eliminado: clasificar incidencias
-- corresponde a las categorias, y filtrar por etiquetas no aportaba suficiente
-- para justificar su mantenimiento.
ALTER TABLE "articles" DROP COLUMN IF EXISTS "tags";
