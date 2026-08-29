-- سجل تنبيهات انتهاء الاشتراك (منع التكرار لكل فترة)
create table if not exists subscription_alert_log (
  id          bigint primary key generated always as identity,
  tenant_id   uuid not null references tenants(id) on delete cascade,
  alert_type  text not null,
  expires_at  date,
  recipient   text,
  sent_at     timestamptz not null default now()
);

create unique index if not exists idx_subscription_alert_unique
  on subscription_alert_log(tenant_id, alert_type, expires_at);

create index if not exists idx_subscription_alert_sent on subscription_alert_log(sent_at desc);

alter table subscription_alert_log enable row level security;
