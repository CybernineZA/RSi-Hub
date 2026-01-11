-- Extend order_status enum to support the production board lanes
alter type order_status add value if not exists 'ready';
