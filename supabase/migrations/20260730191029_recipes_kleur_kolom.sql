-- ============================================================================
-- Receptkleur
--
-- Vrij te kiezen kleur per recept (hex-code), gekozen via een ronde
-- kleurenselectie in recept-invoer.html. Wordt gebruikt om geplande
-- brouwsels in brouwplanning.html sneller herkenbaar te maken (kleur vult
-- de balk van het item i.p.v. steeds de tekst te moeten lezen).
--
-- Bewust een vrij tekstveld (geen enum/check op hex-formaat): zowel de
-- vaste paletkeuzes als een custom kleur (native <input type="color">)
-- schrijven hier gewoon een "#rrggbb"-string in.
-- ============================================================================

alter table recipes add column if not exists kleur text;
