-- ============================================================================
-- pH Maische / pH Start koken: numeriek -> tekst
--
-- In Moederdata.xlsm staan deze twee velden voor de meeste recepten (88% van
-- de ingevulde recepten voor pH Maische) als bereik, bv. "5,4 - 5,5", niet
-- als los getal. De bulk-import kon dat niet in een numeriek veld kwijt en
-- liet het stilzwijgend leeg. Oplossing: vrije tekst toestaan, zodat zowel
-- een los getal (bv. "5,5") als een bereik (bv. "5,4-5,5") gewoon ingevoerd
-- kan worden, precies zoals het in de brewery al gebruikt wordt.
--
-- Veilig: numeric -> text via ::text is altijd lossless (elk getal is
-- weer te geven als tekst), dus geen dataverlies voor de ~9% recepten die
-- al wél een los getal hadden staan.
-- ============================================================================

alter table recipe_brouwspecificaties
  alter column ph_maische type text using ph_maische::text;

alter table recipe_brouwspecificaties
  alter column ph_start_koken type text using ph_start_koken::text;
