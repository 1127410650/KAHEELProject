delete from product_price_history
 where source_line_item_id in (
   select li.id from invoice_line_items li join invoices i on i.id = li.invoice_id
   where i.invoice_no like 'TEST-TIV-%')
 or unified_product_id in (select id from unified_products where arabic_name like 'TEST-%');

delete from product_catalog where normalized_name like 'test tiv %';
delete from unified_products where arabic_name like 'TEST-%';
delete from invoice_line_items where invoice_id in (select id from invoices where invoice_no like 'TEST-TIV-%');
delete from invoice_verifications where invoice_id in (select id from invoices where invoice_no like 'TEST-TIV-%');
delete from invoices where invoice_no like 'TEST-TIV-%';