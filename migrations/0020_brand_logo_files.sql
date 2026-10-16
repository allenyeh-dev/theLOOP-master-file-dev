-- Point brand cards at the actual logo files in frontend/public/brands/ and match each tile
-- colour to its image background so the square logos blend in.
UPDATE brands SET logo_url = '/brands/clv.jpg',            bg_color = '#ffffff' WHERE key = 'clv';
UPDATE brands SET logo_url = '/brands/kor.jpeg',           bg_color = '#000000' WHERE key = 'kor';
UPDATE brands SET logo_url = '/brands/rancho.png',         bg_color = '#000000' WHERE key = 'rancho';
UPDATE brands SET logo_url = '/brands/santafe.png',        bg_color = '#000000' WHERE key = 'santafe';
UPDATE brands SET logo_url = '/brands/oncor.jpeg',         bg_color = '#191919' WHERE key IN ('oncor_xinyi', 'oncor_taichung');
UPDATE brands SET logo_url = '/brands/central_kitchen.svg' WHERE key = 'central_kitchen';
UPDATE brands SET logo_url = '/brands/spc.jpeg',           bg_color = '#f24824' WHERE key = 'spc';
UPDATE brands SET logo_url = '/brands/theloop.png',        bg_color = '#ffffff' WHERE key = 'theloop';
