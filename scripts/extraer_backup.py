"""Extraer una copia descifrada dentro de un directorio nuevo, sin enlaces ni escapes."""
from pathlib import Path
import sys
import tarfile


def extraer(archivo, destino):
    destino = Path(destino).resolve()
    destino.mkdir(mode=0o700, parents=True, exist_ok=False)
    with tarfile.open(archivo, 'r:gz') as tar:
        miembros = tar.getmembers()
        vistos = set()
        for miembro in miembros:
            ruta = Path(miembro.name)
            if ruta.is_absolute() or '..' in ruta.parts or '\\' in miembro.name:
                raise ValueError('Ruta inválida en el paquete de backup')
            if not miembro.isfile() and not miembro.isdir():
                raise ValueError('No se permiten enlaces ni archivos especiales en el backup')
            objetivo = (destino / ruta).resolve()
            if not objetivo.is_relative_to(destino) or objetivo in vistos:
                raise ValueError('Ruta repetida o fuera del directorio de recuperación')
            vistos.add(objetivo)
        for miembro in miembros:
            objetivo = destino / miembro.name
            if miembro.isdir():
                objetivo.mkdir(mode=0o700, parents=True, exist_ok=True)
            else:
                objetivo.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
                with tar.extractfile(miembro) as entrada, objetivo.open('xb') as salida:
                    while bloque := entrada.read(1024 * 1024):
                        salida.write(bloque)
        if not (destino / 'manifest.json').is_file():
            raise ValueError('El backup no contiene manifiesto')


if __name__ == '__main__':
    extraer(sys.argv[1], sys.argv[2])
