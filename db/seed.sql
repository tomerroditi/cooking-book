-- Sample data for the Cooking Book

DELETE FROM recipe_tags;
DELETE FROM steps;
DELETE FROM ingredients;
DELETE FROM recipes;
DELETE FROM books;
DELETE FROM tags;

INSERT INTO books (id, title, author, description, color) VALUES
  ('bk_weeknight', 'Weeknight Favorites', 'The Kitchen',  'Fast, reliable dinners for busy evenings.', '#e07a5f'),
  ('bk_baking',    'Sweet & Baked',       'The Kitchen',  'Cookies, cakes and everything from the oven.', '#c9a227'),
  ('bk_world',     'Around the World',    'The Kitchen',  'Classic dishes from every corner of the globe.', '#3d7068');

INSERT INTO tags (name) VALUES
  ('vegetarian'), ('quick'), ('comfort'), ('spicy'), ('one-pot'),
  ('healthy'), ('classic'), ('kid-friendly'), ('gluten-free');

-- 1) Spaghetti Carbonara
INSERT INTO recipes (id, book_id, title, description, servings, prep_minutes, cook_minutes, difficulty, cuisine, category)
VALUES ('rc_carbonara','bk_world','Spaghetti Carbonara','Silky Roman pasta with egg, pecorino and crisp guanciale. No cream, ever.',4,10,15,'medium','Italian','Main');
INSERT INTO ingredients (recipe_id, position, quantity, unit, name, scalable) VALUES
  ('rc_carbonara',0,400,'g','spaghetti',1),
  ('rc_carbonara',1,150,'g','guanciale or pancetta',1),
  ('rc_carbonara',2,4,'piece','egg yolks',1),
  ('rc_carbonara',3,1,'piece','whole egg',1),
  ('rc_carbonara',4,60,'g','pecorino romano, grated',1),
  ('rc_carbonara',5,NULL,NULL,'black pepper, to taste',0),
  ('rc_carbonara',6,NULL,NULL,'salt for the pasta water',0);
INSERT INTO steps (recipe_id, position, instruction) VALUES
  ('rc_carbonara',0,'Bring a large pot of well-salted water to a boil and cook the spaghetti until al dente.'),
  ('rc_carbonara',1,'Meanwhile, dice the guanciale and render it in a cold pan over medium heat until crisp.'),
  ('rc_carbonara',2,'Whisk the egg yolks, whole egg and most of the pecorino with plenty of black pepper.'),
  ('rc_carbonara',3,'Toss drained pasta with the guanciale off the heat, then add the egg mix with a splash of pasta water, stirring fast to a glossy sauce.'),
  ('rc_carbonara',4,'Serve immediately with the remaining pecorino and more pepper.');
INSERT INTO recipe_tags (recipe_id, tag_id) SELECT 'rc_carbonara', id FROM tags WHERE name IN ('classic','comfort');

-- 2) Fluffy Buttermilk Pancakes
INSERT INTO recipes (id, book_id, title, description, servings, prep_minutes, cook_minutes, difficulty, cuisine, category)
VALUES ('rc_pancakes','bk_baking','Fluffy Buttermilk Pancakes','Tall, tender pancakes with crisp edges. A weekend staple.',4,10,15,'easy','American','Breakfast');
INSERT INTO ingredients (recipe_id, position, quantity, unit, name, scalable) VALUES
  ('rc_pancakes',0,250,'g','all-purpose flour',1),
  ('rc_pancakes',1,2,'tbsp','sugar',1),
  ('rc_pancakes',2,2,'tsp','baking powder',1),
  ('rc_pancakes',3,0.5,'tsp','baking soda',1),
  ('rc_pancakes',4,0.5,'tsp','salt',1),
  ('rc_pancakes',5,400,'ml','buttermilk',1),
  ('rc_pancakes',6,2,'piece','eggs',1),
  ('rc_pancakes',7,50,'g','butter, melted',1);
INSERT INTO steps (recipe_id, position, instruction) VALUES
  ('rc_pancakes',0,'Whisk the dry ingredients in a large bowl.'),
  ('rc_pancakes',1,'In another bowl, whisk buttermilk, eggs and melted butter.'),
  ('rc_pancakes',2,'Fold wet into dry until just combined — lumps are fine. Rest 5 minutes.'),
  ('rc_pancakes',3,'Cook 1/4-cup portions on a buttered griddle over medium heat until bubbles form, then flip and finish.'),
  ('rc_pancakes',4,'Serve warm with maple syrup.');
INSERT INTO recipe_tags (recipe_id, tag_id) SELECT 'rc_pancakes', id FROM tags WHERE name IN ('vegetarian','kid-friendly','quick');

-- 3) Weeknight Turkey Chili
INSERT INTO recipes (id, book_id, title, description, servings, prep_minutes, cook_minutes, difficulty, cuisine, category)
VALUES ('rc_chili','bk_weeknight','Weeknight Turkey Chili','A hearty one-pot chili that only gets better the next day.',6,15,40,'easy','Mexican','Main');
INSERT INTO ingredients (recipe_id, position, quantity, unit, name, scalable) VALUES
  ('rc_chili',0,1,'tbsp','olive oil',1),
  ('rc_chili',1,1,'piece','onion, diced',1),
  ('rc_chili',2,3,'clove','garlic, minced',1),
  ('rc_chili',3,500,'g','ground turkey',1),
  ('rc_chili',4,2,'tbsp','chili powder',1),
  ('rc_chili',5,1,'tsp','ground cumin',1),
  ('rc_chili',6,800,'g','canned crushed tomatoes',1),
  ('rc_chili',7,400,'g','kidney beans, drained',1),
  ('rc_chili',8,250,'ml','chicken stock',1),
  ('rc_chili',9,NULL,NULL,'salt and pepper, to taste',0);
INSERT INTO steps (recipe_id, position, instruction) VALUES
  ('rc_chili',0,'Soften the onion in oil, then add garlic and cook until fragrant.'),
  ('rc_chili',1,'Add the turkey and brown, breaking it up.'),
  ('rc_chili',2,'Stir in chili powder and cumin for 30 seconds.'),
  ('rc_chili',3,'Add tomatoes, beans and stock. Simmer 30–40 minutes until thick.'),
  ('rc_chili',4,'Season and serve with your favorite toppings.');
INSERT INTO recipe_tags (recipe_id, tag_id) SELECT 'rc_chili', id FROM tags WHERE name IN ('one-pot','spicy','comfort','healthy');

-- 4) Brown Butter Chocolate Chip Cookies
INSERT INTO recipes (id, book_id, title, description, servings, prep_minutes, cook_minutes, difficulty, cuisine, category)
VALUES ('rc_cookies','bk_baking','Brown Butter Chocolate Chip Cookies','Nutty brown butter and pools of dark chocolate. Makes about 24.',24,20,12,'medium','American','Dessert');
INSERT INTO ingredients (recipe_id, position, quantity, unit, name, scalable) VALUES
  ('rc_cookies',0,225,'g','butter',1),
  ('rc_cookies',1,200,'g','brown sugar',1),
  ('rc_cookies',2,100,'g','white sugar',1),
  ('rc_cookies',3,2,'piece','eggs',1),
  ('rc_cookies',4,2,'tsp','vanilla extract',1),
  ('rc_cookies',5,315,'g','all-purpose flour',1),
  ('rc_cookies',6,1,'tsp','baking soda',1),
  ('rc_cookies',7,1,'tsp','salt',1),
  ('rc_cookies',8,300,'g','dark chocolate, chopped',1);
INSERT INTO steps (recipe_id, position, instruction) VALUES
  ('rc_cookies',0,'Brown the butter until nutty and amber, then cool slightly.'),
  ('rc_cookies',1,'Whisk in both sugars, then the eggs and vanilla.'),
  ('rc_cookies',2,'Fold in flour, baking soda and salt, then the chocolate.'),
  ('rc_cookies',3,'Chill the dough 30 minutes. Scoop onto lined trays.'),
  ('rc_cookies',4,'Bake at 180°C / 350°F for 11–13 minutes until edges set.');
INSERT INTO recipe_tags (recipe_id, tag_id) SELECT 'rc_cookies', id FROM tags WHERE name IN ('vegetarian','classic','kid-friendly');

-- 5) Greek Salad
INSERT INTO recipes (id, book_id, title, description, servings, prep_minutes, cook_minutes, difficulty, cuisine, category)
VALUES ('rc_greek','bk_world','Village Greek Salad','Crisp vegetables, good olive oil and a slab of feta. No lettuce.',4,15,0,'easy','Greek','Salad');
INSERT INTO ingredients (recipe_id, position, quantity, unit, name, scalable) VALUES
  ('rc_greek',0,4,'piece','ripe tomatoes, wedged',1),
  ('rc_greek',1,1,'piece','cucumber, chunked',1),
  ('rc_greek',2,1,'piece','green pepper, sliced',1),
  ('rc_greek',3,0.5,'piece','red onion, sliced',1),
  ('rc_greek',4,100,'g','kalamata olives',1),
  ('rc_greek',5,200,'g','feta, in one slab',1),
  ('rc_greek',6,4,'tbsp','extra-virgin olive oil',1),
  ('rc_greek',7,1,'tsp','dried oregano',1);
INSERT INTO steps (recipe_id, position, instruction) VALUES
  ('rc_greek',0,'Combine tomatoes, cucumber, pepper and onion in a bowl.'),
  ('rc_greek',1,'Add the olives and toss gently.'),
  ('rc_greek',2,'Lay the feta slab on top, drizzle with olive oil and sprinkle oregano.'),
  ('rc_greek',3,'Serve with crusty bread to mop the juices.');
INSERT INTO recipe_tags (recipe_id, tag_id) SELECT 'rc_greek', id FROM tags WHERE name IN ('vegetarian','healthy','quick','gluten-free');

-- 6) Ginger Chicken Stir-Fry
INSERT INTO recipes (id, book_id, title, description, servings, prep_minutes, cook_minutes, difficulty, cuisine, category)
VALUES ('rc_stirfry','bk_weeknight','Ginger Chicken Stir-Fry','Fast, glossy stir-fry with a punch of ginger and garlic.',4,15,10,'easy','Asian','Main');
INSERT INTO ingredients (recipe_id, position, quantity, unit, name, scalable) VALUES
  ('rc_stirfry',0,500,'g','chicken thigh, sliced',1),
  ('rc_stirfry',1,2,'tbsp','soy sauce',1),
  ('rc_stirfry',2,1,'tbsp','cornstarch',1),
  ('rc_stirfry',3,2,'tbsp','vegetable oil',1),
  ('rc_stirfry',4,1,'tbsp','fresh ginger, grated',1),
  ('rc_stirfry',5,3,'clove','garlic, minced',1),
  ('rc_stirfry',6,1,'piece','red pepper, sliced',1),
  ('rc_stirfry',7,200,'g','broccoli florets',1),
  ('rc_stirfry',8,2,'tbsp','oyster sauce',1);
INSERT INTO steps (recipe_id, position, instruction) VALUES
  ('rc_stirfry',0,'Toss the chicken with soy sauce and cornstarch.'),
  ('rc_stirfry',1,'Sear the chicken in hot oil until golden, then set aside.'),
  ('rc_stirfry',2,'Fry ginger and garlic briefly, add the vegetables and stir-fry until crisp-tender.'),
  ('rc_stirfry',3,'Return the chicken, add oyster sauce and toss to coat. Serve over rice.');
INSERT INTO recipe_tags (recipe_id, tag_id) SELECT 'rc_stirfry', id FROM tags WHERE name IN ('quick','healthy');
