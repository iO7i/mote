// A JSON boundary with a concrete, reifiable type and a typed public API.
type IncomingWebhook={eventId:str,amountMinor:num,note:str?}

pub fn normalize(raw:str)->IncomingWebhook=json<IncomingWebhook>(raw)?
