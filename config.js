// ============================================================================
// config.js — gedeelde Supabase-config en auth-helpers
//
// Laden op ELKE pagina, ná de supabase-js CDN-script-tag, en VÓÓR nav.js:
//
//   <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
//   <script src="config.js"></script>
//   <script src="nav.js"></script>
//
// LET OP: vul hieronder je eigen Supabase-project-URL en publishable/anon-key
// in (dezelfde die nu al hardcoded in receptoverzicht.html staan).
// ============================================================================

// TESTFASE: hardcoded credentials, net als voorheen in receptoverzicht.html.
// Verwijder dit zodra dit breder dan alleen jijzelf gebruikt wordt, of zet in
// elk geval RLS-policies aan in Supabase (staat nu nog overal uit).
const SUPABASE_URL = 'https://nrouqtxkeeoayqudkiud.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_ftz3c-3AVlRiYve4Y1V6fQ_hg_BdAm-';

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/**
 * Haalt de huidige ingelogde gebruiker op, inclusief rol uit de
 * `gebruikers`-tabel. Geeft `null` terug als niemand is ingelogd.
 */
async function getHuidigeGebruiker() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) return null;

  const { data: gebruiker, error } = await supabaseClient
    .from('gebruikers')
    .select('id, naam, rol, actief')
    .eq('id', session.user.id)
    .single();

  if (error) {
    console.error('Kon gebruikersgegevens niet ophalen uit gebruikers-tabel:', error);
    // Val terug op sessie-data zodat de app niet vastloopt als de tabel-rij
    // (nog) ontbreekt — bijvoorbeeld direct na een nieuwe invite.
    return { id: session.user.id, naam: session.user.email, rol: 'viewer', actief: true };
  }
  return gebruiker;
}

/** Roept `callback(session)` aan bij inloggen/uitloggen/token-refresh. */
function onAuthChange(callback) {
  supabaseClient.auth.onAuthStateChange((_event, session) => {
    callback(session);
  });
}

async function uitloggen() {
  await supabaseClient.auth.signOut();
  window.location.href = 'index.html';
}
