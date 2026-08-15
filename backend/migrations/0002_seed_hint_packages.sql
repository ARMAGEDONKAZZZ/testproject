-- Seed the fixed hint-package catalog (from docs/design-audit/toolboard.md paywall).
INSERT INTO hint_packages (label, hint_count, price_credits, is_featured, sort_order) VALUES
    ('5 подсказок',  5,    49, false, 1),
    ('10 подсказок', 10,  129, true,  2),
    ('Безлимит',     NULL, 299, false, 3);
