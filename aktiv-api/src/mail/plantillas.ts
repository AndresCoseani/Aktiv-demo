const escapar = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

/**
 * Mail de invitación. Todo lo que viene de personas (nombres) se escapa para
 * que nadie pueda meter HTML en el mail de otro.
 */
export function mailInvitacion(datos: { alumno: string; profe: string; enlace: string; dias: number }) {
  const alumno = escapar(datos.alumno);
  const profe = escapar(datos.profe);
  const enlace = escapar(datos.enlace);
  const asunto = `${datos.profe} te invitó a Aktiv`;

  const texto = [
    `Hola ${datos.alumno},`,
    "",
    `${datos.profe} te creó una cuenta en Aktiv, donde vas a ver tu plan de entrenamiento y tus carreras.`,
    "",
    "Creá tu contraseña y entrá desde este enlace:",
    datos.enlace,
    "",
    `El enlace sirve una sola vez y vence en ${datos.dias} días.`,
    "Si no esperabas este mail, ignoralo: no se crea nada hasta que elijas una contraseña.",
  ].join("\n");

  const html = `<!doctype html>
<html lang="es">
  <body style="margin:0;padding:24px;background:#f4f7f8;font-family:Arial,Helvetica,sans-serif;color:#0b1820;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr><td align="center">
        <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:12px;overflow:hidden;">
          <tr><td style="background:#050a12;padding:20px 28px;color:#ffffff;font-size:18px;font-weight:bold;letter-spacing:1px;">
            AKTIV <span style="color:#3ec6d6;font-weight:normal;font-size:13px;">· Entrenamiento integral y running</span>
          </td></tr>
          <tr><td style="padding:28px;">
            <p style="margin:0 0 12px;font-size:16px;">Hola <strong>${alumno}</strong>,</p>
            <p style="margin:0 0 20px;font-size:15px;line-height:1.5;">
              <strong>${profe}</strong> te creó una cuenta en Aktiv, donde vas a ver tu plan de entrenamiento y tus carreras.
            </p>
            <p style="margin:0 0 24px;text-align:center;">
              <a href="${enlace}" style="display:inline-block;background:#1fa5b8;color:#ffffff;text-decoration:none;font-weight:bold;padding:12px 24px;border-radius:8px;">
                Crear mi contraseña
              </a>
            </p>
            <p style="margin:0 0 8px;font-size:13px;color:#51626b;line-height:1.5;">
              El enlace sirve una sola vez y vence en ${datos.dias} días. Si el botón no funciona, copiá esta dirección en el navegador:
            </p>
            <p style="margin:0 0 20px;font-size:12px;word-break:break-all;color:#51626b;">${enlace}</p>
            <p style="margin:0;font-size:12px;color:#7a8a92;">Si no esperabas este mail, ignoralo: no se crea nada hasta que elijas una contraseña.</p>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;

  return { asunto, html, texto };
}
