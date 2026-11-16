/* LilieVET · conexión con Supabase
   Pega aquí los dos datos de tu proyecto (Supabase → Project Settings → API Keys / Data API):
   - Project URL
   - La clave "publishable" (sb_publishable_…). Esta clave SÍ puede ir en la app: no da acceso a ninguna
     tabla; todo pasa por funciones que revisan quién eres.
   NUNCA pegues aquí la clave "secret", la "service_role" ni nada de Mercado Pago: esas van en
   Supabase → Edge Functions → Secrets.

   Mientras no la conectes, la app ofrece una vista de muestra con datos de ejemplo
   (index.html?demo=tutor, ?demo=mvz o ?demo=admin). */
window.LV_CONFIG = {
  supabaseUrl: 'https://wqxirebttvrodhqddsag.supabase.co',
  supabaseKey: 'sb_publishable_4DeMNS1QI-dhj4C77ZA67g_mBp9qHnS',
  // Enlaces a tus documentos publicados (déjalos vacíos mientras no existan)
  terminosUrl: '',
  privacidadUrl: '',
  cartaUrl: '',
  // Contacto de soporte que se muestra en la app
  soporteWhatsapp: '5548031238',
};
