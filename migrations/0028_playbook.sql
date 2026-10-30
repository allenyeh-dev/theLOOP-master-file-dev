-- The Playbook: one ordered document of sections, edited from the admin console.
-- kind: 'heading' (small label, title only) | 'card' (body text) | 'behavior' (numbered rule: title, body, good / miss examples).
-- body is lightweight text: blank line = new paragraph, "- " = bullet, "# " = subheading.
CREATE TABLE IF NOT EXISTS playbook_sections (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  kind TEXT NOT NULL DEFAULT 'card',
  title TEXT NOT NULL DEFAULT '',
  title_zh TEXT,
  body TEXT NOT NULL DEFAULT '',
  body_zh TEXT,
  good TEXT,
  good_zh TEXT,
  miss TEXT,
  miss_zh TEXT
);

-- Per-user "I've read this section" ticks.
CREATE TABLE IF NOT EXISTS playbook_reads (
  section_id INTEGER NOT NULL REFERENCES playbook_sections(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  read_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (section_id, user_id)
);

INSERT INTO playbook_sections (sort_order, kind, title, body, good, miss) VALUES
  (0, 'heading', 'CORE VISION', '', NULL, NULL),
  (1, 'card', '', '# Hospitality first, not just SOPs.
- Simple, memorable, easy to spot in action
- Same rules for every role, every seniority
- Every team member meets a guest at some point — so it applies to all of us', NULL, NULL),
  (2, 'heading', 'THE PLAYBOOK — 9 BEHAVIORS', '', NULL, NULL),
  (3, 'behavior', 'Safety First, Always', '- Safety outranks friendliness, speed, and sales. No interaction matters if someone gets hurt.
- Recognize signs of intoxication, distress, or conflict early, and act — never wait to be told.
- Know your escalation path: when to loop in a manager or security, and do it without hesitation or embarrassment.
- There is no safety call that is "someone else''s job."', 'A server flags a visibly over-served guest to a manager immediately, before it becomes a problem.', 'Staff notice a guest in distress or a brewing conflict and hope someone else handles it.'),
  (4, 'behavior', 'Hospitality Begins With Each Other', '- Every team member acknowledges and greets fellow team members when entering the venue.
- The hospitality we give our guests starts with how we treat each other.
- Guests should never see staff conflict, frustration, or venting — settle it off the floor, never in front of the room.
- What happens at a table stays at the table. Guest privacy and confidentiality are part of how we care for people.', 'Greeting a coworker by name when you walk in, even mid-rush; taking a disagreement into the back instead of the floor.', 'Walking past a teammate without acknowledgment, or airing frustration with a coworker in front of guests.'),
  (5, 'behavior', 'The 3 × 3 Rule', '- Within 3 meters / 3 seconds, acknowledge anyone who crosses your path — guest or teammate.
- Eye contact, smile, and a genuine greeting.
- Use their name whenever you know it.
- Never allow a guest — or a coworker — to feel invisible in our space.', 'A cook in the hallway makes eye contact and greets a guest by name walking to the restroom.', 'Staff look down or turn away as a guest passes within arm''s reach.'),
  (6, 'behavior', 'See It Before They Ask', '- Notice the empty glass, the searching look, the guest patting their pockets for a card — before they have to ask.
- Anticipation is what makes hospitality feel effortless instead of transactional.
- If you''re not sure what someone needs, approach and ask — don''t wait for them to flag you down.', 'A server refills water or clears a plate before it''s requested.', 'A guest has to visibly search for staff to get something they clearly need.'),
  (7, 'behavior', 'Own It, Don''t Outsource It', '- If someone needs directions, take them there yourself — don''t point across the room.
- If someone has a problem, it''s yours until it''s solved or you''ve personally handed it to someone who can solve it.
- There is no "that''s not my job" and walking away. You stay until the handoff is complete.
- This applies to teammates too — a coworker who''s lost, overwhelmed, or stuck gets the same treatment.', 'A dishwasher notices a guest looking for the exit and walks them to the door instead of pointing.', 'Pointing a guest "that way" and turning back to your task without checking they made it.'),
  (8, 'behavior', 'Always Offer a Solution', '- Don''t stop at "No," "We can''t," or "That''s not possible."
- Explain what is possible and offer the best available alternative.
- We don''t promise what we cannot deliver — but we always try to find a way forward.', '"We''re out of that dish, but the chef recommends this instead — can I bring it out for you?"', '"Sorry, we don''t have that" with no follow-up offered.'),
  (9, 'behavior', 'Thank Every Guest', '- Every departing guest should be acknowledged whenever reasonably possible.
- Thank them genuinely, using their name whenever you know it, and invite them back.
- The final interaction matters just as much as the first.', 'Making eye contact and thanking a guest by the door, even during a busy close.', 'Letting guests leave unacknowledged because everyone''s focused on closing tasks.'),
  (10, 'behavior', 'Check on Each Other', '- If a teammate is overwhelmed and you have capacity, step in without waiting to be asked.
- Protect the team.
- Great hospitality is a team sport.', 'Jumping on a table run for a slammed teammate without being asked.', 'Standing idle while a coworker is visibly buried, waiting to be asked for help.'),
  (11, 'behavior', 'Leave It Better Than You Found It', '- Notice a spot that needs attention.
- Reset, straighten, replenish, clean, communicate, and prepare.
- Leave your station, section, venue, and team better than you found them.', 'Wiping down a station or restocking napkins on your way past, unprompted.', 'Walking past a mess or an empty station and leaving it for the next shift.'),
  (12, 'heading', 'THE OPERATING PHILOSOPHY', '', NULL, NULL),
  (13, 'card', '', 'We don''t just serve food and drinks. We create experiences people choose to come back to.

# Service vs. Hospitality
Service is getting the order right — the drink arrives, the table is bussed, the bill is correct. Hospitality is how getting it right makes someone feel. The Playbook exists to build hospitality, not just service; service is the baseline, hospitality is the standard.

# How We Prioritize Our People
Care starts on the inside. If our own team doesn''t feel looked after, there''s no version of us that can make a guest feel that way either — you can''t pour from an empty cup. So we''re deliberate about the order things flow in:
- Our team first. People who feel respected and backed by us are the only people who can genuinely make someone else feel welcome.
- Our guests next. Not served by a team running on fumes, but by one that''s already been taken care of.
- The neighborhoods we''re part of. Every venue exists inside a community, not apart from it.
- The people we work with outside our walls. Suppliers and partners are collaborators in this, not just line items.
- The business, last. Get the first four right and the numbers take care of themselves — not the other way around.

None of this is a ranking of who matters — everyone here matters. It''s an order of operations: take care of the people closest to the work, and everything past that gets easier. It also tells you who we hire. You can teach someone to pour, to plate, to run a POS system, in a week. You can''t as easily teach someone to actually care. We look for that instinct first and build the skill on top of it.', NULL, NULL),
  (14, 'heading', 'MANAGER''S PRE-SHIFT GUIDE', '', NULL, NULL),
  (15, 'card', '', 'Use this during daily pre-shift to keep The Playbook alive — not read verbatim, just as a 2-minute anchor. Default to the rotation order below, one rule per shift, cycling continuously. Break the rotation any day something notable just happened on the floor (a great save or a clear miss) — cover that rule instead, then resume the sequence where you left off.

# Pre-Shift Routine (2 minutes)
- Name today''s rule and read its core line.
- Give one real example from a recent shift — a win or a miss, no names needed unless it''s a direct coaching moment.
- Ask one team member to share their own example or how they''d apply it today.

# Rotation Reference
Cycles through Rules 1–9 in order, repeating continuously.', NULL, NULL),
  (16, 'heading', 'THE ACCOUNTABILITY LADDER', '', NULL, NULL),
  (17, 'card', '', 'This is how The Playbook moves from a poster on the wall to a standard staff are actually held to.

# 1. In-the-Moment Coaching (first miss)
A private, immediate, non-written correction, same day: "Hey, that was a Rule [#] moment — here''s what it should''ve looked like." This is coaching, not discipline.

# 2. Logged Miss (repeated or serious)
A repeated miss of the same rule, or one serious miss (e.g. ignoring a guest complaint outright), gets logged: date, rule number, what happened. One line is enough — the point is visibility over time, not paperwork.

# 3. Formal Conversation (pattern)
Three logged misses across any rules within a 60-day window triggers a formal, documented conversation. This gives a concrete pattern to point to instead of a vague impression.

# 4. Recognition (the other side of the ladder)
Log standout moments against a rule number too, the same lightweight way. This is what feeds recognition, reviews, and eventually shows who is actually living The Playbook — not just avoiding misses.', NULL, NULL);
