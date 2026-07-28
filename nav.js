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
  { naam: 'Batch Creation', href: 'batchcreation.html' },
  { naam: 'Users', href: 'gebruikers.html', adminOnly: true },
  { naam: 'Settings', href: 'settings.html', adminOnly: true },
  { naam: 'Status', href: 'status.html', adminOnly: true },
];

function renderNav(huidigeGebruiker) {
  const container = document.getElementById('jopen-nav');
  if (!container) return;

  const huidigePagina = window.location.pathname.split('/').pop();
  const isAdmin = huidigeGebruiker?.rol === 'admin';

  const links = JOPEN_MODULES
    .filter(m => !m.adminOnly)
    .map(m => {
      const isActief = m.href === huidigePagina;
      return `<a href="${m.href}" class="jopen-nav-link${isActief ? ' actief' : ''}">${m.naam}</a>`;
    }).join('');

  const adminLinksHtml = isAdmin
    ? JOPEN_MODULES.filter(m => m.adminOnly).map(m => {
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

  const gebruikerBtn = document.getElementById('jopen-gebruiker-btn');
  const gebruikerMenu = document.getElementById('jopen-gebruiker-menu');
  if (gebruikerBtn && gebruikerMenu) {
    gebruikerBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      gebruikerMenu.style.display = gebruikerMenu.style.display === 'none' ? 'block' : 'none';
    });
    document.addEventListener('click', (e) => {
      if (!gebruikerMenu.contains(e.target) && e.target !== gebruikerBtn) {
        gebruikerMenu.style.display = 'none';
      }
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') gebruikerMenu.style.display = 'none';
    });
  }
}

function escapeHtmlNav(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
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
