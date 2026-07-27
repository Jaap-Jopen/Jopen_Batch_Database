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

const JOPEN_MODULES = [
  { naam: 'Home', href: 'index.html' },
  { naam: 'Recipes', href: 'receptoverzicht.html' },
  { naam: 'Ingredients', href: 'ingredienten.html' },
  { naam: 'Users', href: 'gebruikers.html', adminOnly: true },
  { naam: 'Settings', href: 'settings.html', adminOnly: true },
];

function renderNav(huidigeGebruiker) {
  const container = document.getElementById('jopen-nav');
  if (!container) return;

  const huidigePagina = window.location.pathname.split('/').pop();
  const isAdmin = huidigeGebruiker?.rol === 'admin';

  const links = JOPEN_MODULES
    .filter(m => !m.adminOnly || isAdmin)
    .map(m => {
      const isActief = m.href === huidigePagina;
      return `<a href="${m.href}" class="jopen-nav-link${isActief ? ' actief' : ''}">${m.naam}</a>`;
    }).join('');

  const rechterkant = huidigeGebruiker
    ? `<span class="jopen-nav-gebruiker">${huidigeGebruiker.naam} <span class="jopen-nav-rol">(${huidigeGebruiker.rol})</span></span>
       <button id="jopen-uitloggen-btn" class="jopen-nav-uitloggen">Log out</button>`
    : `<a href="login.html" class="jopen-nav-link">Log in</a>`;

  container.innerHTML = `
    <nav class="jopen-nav">
      <div class="jopen-nav-merk">
        <span class="jopen-nav-logo-wrap"><img src="jopen-logo.png" alt="Jopen" class="jopen-nav-logo" /></span>
        Jopen
      </div>
      <div class="jopen-nav-links">${links}</div>
      <div class="jopen-nav-rechts">${rechterkant}</div>
    </nav>
  `;

  const uitlogBtn = document.getElementById('jopen-uitloggen-btn');
  if (uitlogBtn) uitlogBtn.addEventListener('click', uitloggen);
}

async function initJopenNav() {
  const gebruiker = await getHuidigeGebruiker();
  renderNav(gebruiker);

  onAuthChange(async () => {
    const opnieuw = await getHuidigeGebruiker();
    renderNav(opnieuw);
  });
}

document.addEventListener('DOMContentLoaded', initJopenNav);
