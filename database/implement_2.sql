-- Adjust default currency to USD for existing deployments
alter table public.settings
  alter column currency set default 'USD';

-- Normalize existing settings rows that still use the legacy THB default
update public.settings
  set currency = 'USD'
  where currency is null
     or currency = 'THB';
