// ============================================================================
// nav.js — gedeelde navigatiebalk
//
// Vereist op de pagina:
//   1. supabase-js + config.js al geladen (zie config.js voor volgorde)
//   2. Een leeg element ergens in de <body>:  <div id="jopen-nav"></div>
//
// Nieuwe module toevoegen? Voeg 'm hieronder toe aan JOPEN_MODULES — hij
// verschijnt dan automatisch in de navigatiebalk van elke pagina.
// ============================================================================

// Pagina's die iedereen (ook uitgelogd) moet kunnen bereiken -- anders kan
// niemand ooit meer inloggen of een uitnodiging accepteren.
const JOPEN_PUBLIEKE_PAGINAS = ['login.html', 'accept-invite.html'];

// Meteen (synchroon, dus vóór er ook maar iets van de rest van de pagina
// zichtbaar wordt) een overlay tonen die de hele pagina afdekt, op de
// publieke pagina's na. Wordt pas weer weggehaald zodra vereisIngelogd()
// bevestigt dat er een sessie is -- bij geen sessie blijft de overlay
// gewoon staan terwijl de pagina naar login.html doorstuurt.
if (!JOPEN_PUBLIEKE_PAGINAS.includes(window.location.pathname.split('/').pop())) {
  const overlay = document.createElement('div');
  overlay.id = 'jopen-auth-overlay';
  overlay.style.cssText = 'position:fixed; inset:0; background:#f4f4f2; z-index:99999;';
  document.documentElement.appendChild(overlay);
}

// Zelfde indeling als de homepage-tegels (index.html), zodat de navigatiebalk
// niet blijft groeien met losse links naarmate er modules bijkomen. Nieuwe
// module toevoegen? Voeg 'm toe aan de juiste groep hieronder (of maak een
// nieuwe groep als het ergens anders bij hoort) -- verschijnt dan automatisch
// als item in de bijbehorende dropdown.
const JOPEN_MODULE_GROEPEN = [
  { naam: 'Batches', items: [
      { naam: 'Batch Creation', href: 'batchcreation.html' },
  ]},
  { naam: 'Planning', items: [
      { naam: 'Brewing planning', href: 'brouwplanning.html' },
      { naam: 'Consumption forecast', href: 'verbruiksprognose.html' },
  ]},
  { naam: 'Databases', items: [
      { naam: 'Recipes', href: 'receptoverzicht.html' },
      { naam: 'Ingredients', href: 'ingredienten.html' },
  ]},
];

// Admin-only pagina's blijven in het gebruikersmenu rechts (account-achtig
// van aard, geen inhoudelijke module) -- zie renderNav().
const JOPEN_ADMIN_PAGINAS = [
  { naam: 'Users', href: 'gebruikers.html' },
  { naam: 'Settings', href: 'settings.html' },
  { naam: 'Status', href: 'status.html' },
];

/**
 * Stuurt direct door naar login.html als er geen ingelogde gebruiker is,
 * behalve op de paar pagina's die per definitie ook zonder login bereikbaar
 * moeten zijn. Haalt anders de overlay hierboven weer weg.
 *
 * Let op: dit is een UX-maatregel, geen beveiligingsgrens op zich -- de
 * daadwerkelijke bescherming van gegevens loopt via RLS-policies in
 * Supabase. Deze check voorkomt alleen dat de pagina's/navigatie zichtbaar
 * zijn zonder in te loggen.
 */
async function vereisIngelogd() {
  const huidigePagina = window.location.pathname.split('/').pop();
  if (JOPEN_PUBLIEKE_PAGINAS.includes(huidigePagina)) return true;

  const gebruiker = await getHuidigeGebruiker();
  if (!gebruiker) {
    const terugNaar = encodeURIComponent(huidigePagina + window.location.search);
    window.location.replace(`login.html?redirect=${terugNaar}`);
    return false;
  }
  const overlay = document.getElementById('jopen-auth-overlay');
  if (overlay) overlay.remove();
  return true;
}

function renderNav(huidigeGebruiker) {
  const container = document.getElementById('jopen-nav');
  if (!container) return;

  const huidigePagina = window.location.pathname.split('/').pop();
  const isAdmin = huidigeGebruiker?.rol === 'admin';

  const categorieenHtml = JOPEN_MODULE_GROEPEN.map((groep, i) => {
    const bevatActieve = groep.items.some(m => m.href === huidigePagina);
    const itemsHtml = groep.items.map(m => {
      const isActief = m.href === huidigePagina;
      return `<a href="${m.href}" class="jopen-nav-dropdown-item${isActief ? ' actief' : ''}">${m.naam}</a>`;
    }).join('');
    return `
      <div class="jopen-nav-categorie-wrap">
        <button type="button" class="jopen-nav-categorie-btn${bevatActieve ? ' actief' : ''}" data-categorie-idx="${i}">
          ${groep.naam} <span class="jopen-nav-categorie-caret">&#9662;</span>
        </button>
        <div class="jopen-nav-dropdown jopen-nav-categorie-menu" data-categorie-idx="${i}" style="display:none;">
          ${itemsHtml}
        </div>
      </div>`;
  }).join('');

  const adminLinksHtml = isAdmin
    ? JOPEN_ADMIN_PAGINAS.map(m => {
        const isActief = m.href === huidigePagina;
        return `<a href="${m.href}" class="jopen-nav-dropdown-item${isActief ? ' actief' : ''}">${m.naam}</a>`;
      }).join('')
    : '';

  const rechterkant = huidigeGebruiker
    ? `<div class="jopen-nav-gebruiker-wrap">
         <button id="jopen-gebruiker-btn" class="jopen-nav-gebruiker-btn">
           ${escapeHtmlNav(huidigeGebruiker.naam)} <span class="jopen-nav-rol">(${escapeHtmlNav(huidigeGebruiker.rol)})</span>
           <span class="jopen-nav-caret">&#9662;</span>
         </button>
         <div id="jopen-gebruiker-menu" class="jopen-nav-dropdown" style="display:none;">
           ${adminLinksHtml}
           ${adminLinksHtml ? '<div class="jopen-nav-dropdown-divider"></div>' : ''}
           <button id="jopen-uitloggen-btn" class="jopen-nav-dropdown-item">Log out</button>
         </div>
       </div>`
    : `<a href="login.html" class="jopen-nav-link">Log in</a>`;

  container.innerHTML = `
    <nav class="jopen-nav">
      <a href="index.html" class="jopen-nav-merk" style="text-decoration:none; color:inherit;">
        <span class="jopen-nav-logo-wrap"><img src="jopen-logo.png" alt="Jopen" class="jopen-nav-logo" /></span>
        Jopen
      </a>
      <div class="jopen-nav-links">${categorieenHtml}</div>
      <div class="jopen-nav-rechts">${rechterkant}</div>
    </nav>
  `;

  const uitlogBtn = document.getElementById('jopen-uitloggen-btn');
  if (uitlogBtn) uitlogBtn.addEventListener('click', uitloggen);

  // Alle open dropdowns (categorieën + gebruikersmenu) sluiten, op een
  // eventuele uitzondering na -- gebruikt bij het openen van een nieuwe.
  function sluitAlleMenus(exceptEl) {
    document.querySelectorAll('.jopen-nav-categorie-menu').forEach(menu => {
      if (menu !== exceptEl) menu.style.display = 'none';
    });
    const gebruikerMenu = document.getElementById('jopen-gebruiker-menu');
    if (gebruikerMenu && gebruikerMenu !== exceptEl) gebruikerMenu.style.display = 'none';
  }

  container.querySelectorAll('.jopen-nav-categorie-btn').forEach(btn => {
    const idx = btn.dataset.categorieIdx;
    const menu = container.querySelector(`.jopen-nav-categorie-menu[data-categorie-idx="${idx}"]`);
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const wasOpen = menu.style.display !== 'none';
      sluitAlleMenus();
      menu.style.display = wasOpen ? 'none' : 'block';
    });
  });

  const gebruikerBtn = document.getElementById('jopen-gebruiker-btn');
  const gebruikerMenu = document.getElementById('jopen-gebruiker-menu');
  if (gebruikerBtn && gebruikerMenu) {
    gebruikerBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const wasOpen = gebruikerMenu.style.display !== 'none';
      sluitAlleMenus();
      gebruikerMenu.style.display = wasOpen ? 'none' : 'block';
    });
  }

  document.addEventListener('click', () => sluitAlleMenus());
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') sluitAlleMenus();
  });
}

function escapeHtmlNav(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}

async function initJopenNav() {
  const magDoorgaan = await vereisIngelogd();
  if (!magDoorgaan) return; // pagina stuurt door naar login.html, verder niets doen

  const gebruiker = await getHuidigeGebruiker();
  renderNav(gebruiker);

  onAuthChange(async () => {
    const opnieuw = await getHuidigeGebruiker();
    renderNav(opnieuw);
  });
}

document.addEventListener('DOMContentLoaded', initJopenNav);
