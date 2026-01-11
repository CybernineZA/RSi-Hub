-- Extend shipment_status enum to match UI states
alter type shipment_status add value if not exists 'loading';
alter type shipment_status add value if not exists 'arrived';
alter type shipment_status add value if not exists 'unloaded';
alter type shipment_status add value if not exists 'aborted';
