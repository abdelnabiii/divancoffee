-- Removes what tests/rpc.test.js leaves on a real project (test orders + test customers).
-- Test data is recognisable: customer names / order names start with "اختبار" and phones start with 0155.
-- Review the counts first:
select (select count(*) from public.orders where name like 'اختبار%') as test_orders,
       (select count(*) from public.customers where name like 'اختبار%' and phone like '0155%') as test_customers;
-- Then delete:
-- delete from public.orders where name like 'اختبار%';
-- delete from public.customers where name like 'اختبار%' and phone like '0155%';
