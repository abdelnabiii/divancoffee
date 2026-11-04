-- OPTIONAL: the demo coupon from the demo version (10 % off orders of 100 ج or more, unlimited uses).
-- Run only if you want it live. You can also create/edit/delete coupons from the dashboard → الكوبونات.
insert into public.coupons (code, type, value, min_order, max_uses, active)
values ('DIVAN10', 'percent', 10, 100, 0, true)
on conflict (code) do nothing;
